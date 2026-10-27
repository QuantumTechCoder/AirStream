// WebRTC DataChannel Connection Manager with Backpressure & Latency Monitor

import type {
  ConnectionState,
  PeerInfo,
  NetworkStats,
  ClipboardItem,
  WorkspaceDelta,
  SignalingMessage,
} from './types'
import { SignalingClient } from '../signaling/SignalingClient'

const ICE_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.cloudflare.com:53'] },
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  { urls: ['stun:global.stun.twilio.com:3478'] },
]

export interface ConnectionEvents {
  onStateChange: (state: ConnectionState) => void
  onPeerInfo: (info: PeerInfo) => void
  onNetworkStats: (stats: NetworkStats) => void
  onFileMetadata: (meta: any) => void
  onFileChunk: (chunk: ArrayBuffer) => void
  onFileControl: (control: any) => void
  onClipboard: (item: ClipboardItem) => void
  onWorkspace: (delta: WorkspaceDelta) => void
}

export class WebRTCConnection {
  public pc: RTCPeerConnection | null = null
  public localPeer: PeerInfo
  public remotePeer: PeerInfo | null = null
  public state: ConnectionState = 'idle'
  
  private signaling: SignalingClient | null = null
  private fileChannel: RTCDataChannel | null = null
  private clipboardChannel: RTCDataChannel | null = null
  private workspaceChannel: RTCDataChannel | null = null
  private pingChannel: RTCDataChannel | null = null

  private events: ConnectionEvents
  private isInitiator = false
  private pingInterval: any = null
  private networkStats: NetworkStats = {
    rttMs: 0,
    bytesReceived: 0,
    bytesSent: 0,
    connectionType: 'unknown',
  }

  // Backpressure resolver for high-speed file chunk sender
  private bufferedAmountLowResolver: (() => void) | null = null

  constructor(localPeer: PeerInfo, events: ConnectionEvents) {
    this.localPeer = localPeer
    this.events = events
  }

  private updateState(newState: ConnectionState) {
    this.state = newState
    this.events.onStateChange(newState)
  }

  public async start(roomId: string, isHost: boolean): Promise<void> {
    this.isInitiator = isHost
    this.updateState('pairing')

    // Initialize signaling client
    this.signaling = new SignalingClient(this.localPeer.id, this.handleSignalingMessage.bind(this))
    await this.signaling.init(roomId, isHost)

    this.createPeerConnection()

    if (this.isInitiator) {
      // Host creates DataChannels upfront
      this.setupDataChannels()
      const offer = await this.pc!.createOffer()
      await this.pc!.setLocalDescription(offer)
      await this.signaling.send({
        type: 'offer',
        data: offer,
      })
      await this.signaling.send({
        type: 'peer-info',
        data: this.localPeer,
      })
    } else {
      // Guest sends peer-info and join notification
      await this.signaling.send({
        type: 'join',
        data: { peerId: this.localPeer.id },
      })
      await this.signaling.send({
        type: 'peer-info',
        data: this.localPeer,
      })
    }
  }

  private createPeerConnection() {
    this.pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      iceCandidatePoolSize: 2,
    })

    this.pc.onicecandidate = (event) => {
      if (event.candidate && this.signaling) {
        this.signaling.send({
          type: 'candidate',
          data: event.candidate,
        })
      }
    }

    this.pc.oniceconnectionstatechange = () => {
      if (!this.pc) return
      const iceState = this.pc.iceConnectionState

      if (iceState === 'connected' || iceState === 'completed') {
        this.updateState('connected')
        this.startPingMonitor()
        this.inspectSelectedCandidatePair()
      } else if (iceState === 'disconnected') {
        this.updateState('reconnecting')
      } else if (iceState === 'failed' || iceState === 'closed') {
        this.updateState('disconnected')
        this.stopPingMonitor()
      }
    }

    this.pc.ondatachannel = (event) => {
      this.attachDataChannel(event.channel)
    }
  }

  private setupDataChannels() {
    if (!this.pc) return

    // 1. Files Channel: Binary arraybuffer, ordered, reliable
    this.fileChannel = this.pc.createDataChannel('files', {
      ordered: true,
    })
    this.attachDataChannel(this.fileChannel)

    // 2. Clipboard Channel: High speed reliable
    this.clipboardChannel = this.pc.createDataChannel('clipboard', {
      ordered: true,
    })
    this.attachDataChannel(this.clipboardChannel)

    // 3. Workspace Channel: Collaborative editor sync
    this.workspaceChannel = this.pc.createDataChannel('workspace', {
      ordered: true,
    })
    this.attachDataChannel(this.workspaceChannel)

    // 4. Ping Channel: RTT measurement
    this.pingChannel = this.pc.createDataChannel('ping', {
      ordered: false,
      maxRetransmits: 0,
    })
    this.attachDataChannel(this.pingChannel)
  }

  private attachDataChannel(channel: RTCDataChannel) {
    if (channel.label === 'files') {
      this.fileChannel = channel
      channel.binaryType = 'arraybuffer'
      // Set 256KB threshold for backpressure event
      channel.bufferedAmountLowThreshold = 256 * 1024

      channel.onbufferedamountlow = () => {
        if (this.bufferedAmountLowResolver) {
          const resolve = this.bufferedAmountLowResolver
          this.bufferedAmountLowResolver = null
          resolve()
        }
      }

      channel.onmessage = (event) => {
        if (typeof event.data === 'string') {
          try {
            const parsed = JSON.parse(event.data)
            if (parsed._type === 'file-meta') {
              this.events.onFileMetadata(parsed)
            } else if (parsed._type === 'file-ctrl') {
              this.events.onFileControl(parsed)
            }
          } catch {
            // ignore
          }
        } else if (event.data instanceof ArrayBuffer) {
          this.networkStats.bytesReceived += event.data.byteLength
          this.events.onFileChunk(event.data)
        }
      }
    } else if (channel.label === 'clipboard') {
      this.clipboardChannel = channel
      channel.onmessage = (event) => {
        try {
          const item = JSON.parse(event.data) as ClipboardItem
          this.events.onClipboard(item)
        } catch {
          // ignore
        }
      }
    } else if (channel.label === 'workspace') {
      this.workspaceChannel = channel
      channel.onmessage = (event) => {
        try {
          const delta = JSON.parse(event.data) as WorkspaceDelta
          this.events.onWorkspace(delta)
        } catch {
          // ignore
        }
      }
    } else if (channel.label === 'ping') {
      this.pingChannel = channel
      channel.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'ping') {
            channel.send(JSON.stringify({ type: 'pong', t: data.t }))
          } else if (data.type === 'pong') {
            const rtt = Date.now() - data.t
            this.networkStats.rttMs = Math.max(1, rtt)
            this.events.onNetworkStats({ ...this.networkStats })
          }
        } catch {
          // ignore
        }
      }
    }
  }

  private async handleSignalingMessage(msg: SignalingMessage) {
    if (!this.pc) return

    if (msg.type === 'peer-info') {
      this.remotePeer = msg.data as PeerInfo
      this.events.onPeerInfo(this.remotePeer)
      // Send back local peer info if we haven't already
      if (!this.isInitiator && this.signaling) {
        this.signaling.send({
          type: 'peer-info',
          data: this.localPeer,
        })
      }
    } else if (msg.type === 'offer') {
      this.updateState('connecting')
      await this.pc.setRemoteDescription(new RTCSessionDescription(msg.data))
      const answer = await this.pc.createAnswer()
      await this.pc.setLocalDescription(answer)
      if (this.signaling) {
        await this.signaling.send({
          type: 'answer',
          data: answer,
        })
      }
    } else if (msg.type === 'answer') {
      this.updateState('connecting')
      await this.pc.setRemoteDescription(new RTCSessionDescription(msg.data))
    } else if (msg.type === 'candidate') {
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(msg.data))
      } catch (err) {
        console.warn('ICE candidate addition failed', err)
      }
    } else if (msg.type === 'join' && this.isInitiator) {
      // Re-trigger offer if peer joined late
      if (this.pc.signalingState === 'stable') {
        const offer = await this.pc.createOffer()
        await this.pc.setLocalDescription(offer)
        if (this.signaling) {
          await this.signaling.send({
            type: 'offer',
            data: offer,
          })
        }
      }
    }
  }

  // Backpressure-controlled binary chunk sender
  public async sendFileChunk(chunk: ArrayBuffer): Promise<void> {
    if (!this.fileChannel || this.fileChannel.readyState !== 'open') {
      throw new Error('File DataChannel is not open')
    }

    // If buffer exceeds 1MB, wait for bufferedamountlow event before sending more
    if (this.fileChannel.bufferedAmount > 1024 * 1024) {
      await new Promise<void>((resolve) => {
        this.bufferedAmountLowResolver = resolve
      })
    }

    this.fileChannel.send(chunk)
    this.networkStats.bytesSent += chunk.byteLength
  }

  public sendFileMetadata(meta: any): void {
    if (this.fileChannel && this.fileChannel.readyState === 'open') {
      this.fileChannel.send(JSON.stringify({ _type: 'file-meta', ...meta }))
    }
  }

  public sendFileControl(control: any): void {
    if (this.fileChannel && this.fileChannel.readyState === 'open') {
      this.fileChannel.send(JSON.stringify({ _type: 'file-ctrl', ...control }))
    }
  }

  public sendClipboard(item: ClipboardItem): void {
    if (this.clipboardChannel && this.clipboardChannel.readyState === 'open') {
      this.clipboardChannel.send(JSON.stringify(item))
    }
  }

  public sendWorkspace(delta: WorkspaceDelta): void {
    if (this.workspaceChannel && this.workspaceChannel.readyState === 'open') {
      this.workspaceChannel.send(JSON.stringify(delta))
    }
  }

  private startPingMonitor() {
    this.stopPingMonitor()
    this.pingInterval = setInterval(() => {
      if (this.pingChannel && this.pingChannel.readyState === 'open') {
        this.pingChannel.send(JSON.stringify({ type: 'ping', t: Date.now() }))
      }
    }, 2000)
  }

  private stopPingMonitor() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
  }

  private async inspectSelectedCandidatePair() {
    if (!this.pc) return
    try {
      const stats = await this.pc.getStats()
      stats.forEach((report) => {
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          const remoteCandidate = stats.get(report.remoteCandidateId)
          if (remoteCandidate) {
            if (remoteCandidate.candidateType === 'host') {
              this.networkStats.connectionType = 'local'
            } else if (remoteCandidate.candidateType === 'srflx') {
              this.networkStats.connectionType = 'stun'
            } else if (remoteCandidate.candidateType === 'relay') {
              this.networkStats.connectionType = 'turn'
            }
            this.events.onNetworkStats({ ...this.networkStats })
          }
        }
      })
    } catch {
      // stats error
    }
  }

  // Offline / Air-gapped manual SDP exchange support
  public async generateManualOffer(): Promise<string> {
    this.createPeerConnection()
    this.setupDataChannels()
    const offer = await this.pc!.createOffer()
    await this.pc!.setLocalDescription(offer)
    // Wait for ICE gathering to complete so all candidates are in SDP
    await new Promise<void>((resolve) => {
      if (this.pc!.iceGatheringState === 'complete') {
        resolve()
      } else {
        const check = () => {
          if (this.pc?.iceGatheringState === 'complete') {
            this.pc.removeEventListener('icegatheringstatechange', check)
            resolve()
          }
        }
        this.pc!.addEventListener('icegatheringstatechange', check)
        // Fallback timeout
        setTimeout(resolve, 1500)
      }
    })
    return btoa(JSON.stringify(this.pc!.localDescription))
  }

  public async applyManualOffer(offerBase64: string): Promise<string> {
    this.createPeerConnection()
    const sdp = JSON.parse(atob(offerBase64))
    await this.pc!.setRemoteDescription(new RTCSessionDescription(sdp))
    const answer = await this.pc!.createAnswer()
    await this.pc!.setLocalDescription(answer)
    // Wait for ICE gathering
    await new Promise<void>((resolve) => {
      if (this.pc!.iceGatheringState === 'complete') {
        resolve()
      } else {
        const check = () => {
          if (this.pc?.iceGatheringState === 'complete') {
            this.pc.removeEventListener('icegatheringstatechange', check)
            resolve()
          }
        }
        this.pc!.addEventListener('icegatheringstatechange', check)
        setTimeout(resolve, 1500)
      }
    })
    return btoa(JSON.stringify(this.pc!.localDescription))
  }

  public async applyManualAnswer(answerBase64: string): Promise<void> {
    if (!this.pc) return
    const sdp = JSON.parse(atob(answerBase64))
    await this.pc.setRemoteDescription(new RTCSessionDescription(sdp))
  }

  public disconnect() {
    this.stopPingMonitor()
    if (this.signaling) {
      this.signaling.destroy()
      this.signaling = null
    }

    this.fileChannel?.close()
    this.clipboardChannel?.close()
    this.workspaceChannel?.close()
    this.pingChannel?.close()

    if (this.pc) {
      this.pc.close()
      this.pc = null
    }

    this.remotePeer = null
    this.updateState('disconnected')
  }
}
