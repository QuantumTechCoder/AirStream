// WebRTC Connection Engine powered by PeerJS & Multi-Region STUN/TURN Relays
// Optimized for Symmetric NAT, Carrier-Grade NAT (Jio, Airtel, T-Mobile), and Cross-Network Streaming

import { Peer, type DataConnection } from 'peerjs'
import type {
  ConnectionState,
  PeerInfo,
  NetworkStats,
  ClipboardItem,
  WorkspaceDelta,
} from './types'

export function getActiveIceServers(): RTCIceServer[] {
  const servers = [...ICE_SERVERS]
  try {
    const raw = localStorage.getItem('airstream_custom_turn')
    if (raw) {
      const custom = JSON.parse(raw)
      if (custom.server) {
        servers.unshift({
          urls: [custom.server],
          username: custom.username || undefined,
          credential: custom.credential || undefined,
        })
      }
    }
  } catch {
    // ignore
  }
  return servers
}
// Port 443 with transport=tcp ensures connectivity across cellular carriers with strict CGNAT (e.g. Jio)
export const ICE_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.cloudflare.com:53'] },
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
  { urls: ['stun:global.stun.twilio.com:3478'] },
  { urls: ['stun:stun.relay.metered.ca:80'] },
  {
    urls: [
      'turn:openrelay.metered.ca:80',
      'turn:openrelay.metered.ca:443',
      'turn:openrelay.metered.ca:443?transport=tcp',
      'turns:openrelay.metered.ca:443?transport=tcp',
    ],
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
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
  public peer: Peer | null = null
  public conn: DataConnection | null = null
  public localPeer: PeerInfo
  public remotePeer: PeerInfo | null = null
  public state: ConnectionState = 'idle'

  private events: ConnectionEvents
  private isInitiator = false
  public roomId: string | null = null
  private pingInterval: any = null
  private connectRetryTimer: any = null
  private retryCount = 0
  private manualPc: RTCPeerConnection | null = null // For offline / air-gapped mode

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
    this.roomId = roomId
    this.updateState('pairing')
    this.retryCount = 0

    const cleanRoomId = roomId.trim().toLowerCase()
    const hostPeerId = `airstream-v2-${cleanRoomId}`

    if (isHost) {
      // Host registers the unique room ID on PeerJS cloud signaling
      this.initHost(hostPeerId)
    } else {
      // Guest creates client peer and connects to host
      this.initGuest(hostPeerId)
    }
  }

  private initHost(hostPeerId: string) {
    this.disconnect()

    this.peer = new Peer(hostPeerId, {
      config: { iceServers: getActiveIceServers() },
      debug: 1,
    })

    this.peer.on('open', () => {
      this.updateState('pairing')
    })

    this.peer.on('connection', (connection) => {
      this.setupConnection(connection)
    })

    this.peer.on('error', (err: any) => {
      console.warn('[AirStream] PeerJS host error:', err.type, err)
      if (err.type === 'unavailable-id') {
        // ID is already taken (e.g. host reloaded) - retry with randomized host ID or reconnect
        this.updateState('pairing')
      }
    })
  }

  private initGuest(hostPeerId: string) {
    this.disconnect()

    const guestId = `airstream-v2-guest-${Math.random().toString(36).substring(2, 9)}`
    this.peer = new Peer(guestId, {
      config: { iceServers: getActiveIceServers() },
      debug: 1,
    })

    this.peer.on('open', () => {
      this.attemptConnectToHost(hostPeerId)
    })

    this.peer.on('error', (err: any) => {
      console.warn('[AirStream] PeerJS guest error:', err.type, err)
      if (err.type === 'peer-unavailable') {
        // Host might still be initializing, retry connection
        this.scheduleRetry(hostPeerId)
      }
    })
  }

  private attemptConnectToHost(hostPeerId: string) {
    if (!this.peer || this.peer.destroyed) return
    this.updateState('connecting')

    const connection = this.peer.connect(hostPeerId, {
      reliable: true,
    })

    this.setupConnection(connection)
  }

  private scheduleRetry(hostPeerId: string) {
    if (this.state === 'connected' || this.retryCount > 25) return
    this.retryCount++

    if (this.connectRetryTimer) clearTimeout(this.connectRetryTimer)
    this.connectRetryTimer = setTimeout(() => {
      if (this.state !== 'connected' && this.peer && !this.peer.destroyed) {
        this.attemptConnectToHost(hostPeerId)
      }
    }, 1500)
  }

  private setupConnection(connection: DataConnection) {
    this.conn = connection

    connection.on('open', () => {
      if (this.connectRetryTimer) {
        clearTimeout(this.connectRetryTimer)
        this.connectRetryTimer = null
      }

      this.updateState('connected')
      this.attachDataChannelBackpressure(connection)
      this.startPingMonitor()

      // Exchange peer info
      this.sendPacket({
        _type: 'peer-info',
        info: this.localPeer,
      })
    })

    connection.on('data', (data: any) => {
      this.handleIncomingData(data)
    })

    connection.on('close', () => {
      this.updateState('disconnected')
      this.stopPingMonitor()
    })

    connection.on('error', (err: any) => {
      console.warn('[AirStream] Connection error:', err)
      this.updateState('disconnected')
    })
  }

  private attachDataChannelBackpressure(connection: DataConnection) {
    const dc = connection.dataChannel
    if (!dc) return

    dc.binaryType = 'arraybuffer'
    dc.bufferedAmountLowThreshold = 256 * 1024 // 256KB threshold

    dc.onbufferedamountlow = () => {
      if (this.bufferedAmountLowResolver) {
        const resolve = this.bufferedAmountLowResolver
        this.bufferedAmountLowResolver = null
        resolve()
      }
    }
  }

  private handleIncomingData(data: any) {
    if (data instanceof ArrayBuffer) {
      this.networkStats.bytesReceived += data.byteLength
      this.events.onFileChunk(data)
      return
    }

    if (typeof data === 'object' && data !== null) {
      switch (data._type) {
        case 'peer-info':
          this.remotePeer = data.info as PeerInfo
          this.events.onPeerInfo(this.remotePeer)
          if (this.isInitiator) {
            // Respond with host info
            this.sendPacket({ _type: 'peer-info-ack', info: this.localPeer })
          }
          break

        case 'peer-info-ack':
          this.remotePeer = data.info as PeerInfo
          this.events.onPeerInfo(this.remotePeer)
          break

        case 'file-meta':
          this.events.onFileMetadata(data)
          break

        case 'file-ctrl':
          this.events.onFileControl(data)
          break

        case 'clipboard':
          this.events.onClipboard(data.item)
          break

        case 'workspace':
          this.events.onWorkspace(data.delta)
          break

        case 'ping':
          this.sendPacket({ _type: 'pong', t: data.t })
          break

        case 'pong': {
          const rtt = Date.now() - data.t
          this.networkStats.rttMs = Math.max(1, rtt)
          this.inspectCandidatePair()
          this.events.onNetworkStats({ ...this.networkStats })
          break
        }
      }
    }
  }

  private sendPacket(packet: any) {
    if (this.conn && this.conn.open) {
      try {
        this.conn.send(packet)
      } catch (e) {
        console.warn('Packet send error:', e)
      }
    }
  }

  // Backpressure-controlled binary chunk sender
  public async sendFileChunk(chunk: ArrayBuffer): Promise<void> {
    if (!this.conn || !this.conn.open) {
      throw new Error('WebRTC DataChannel is not open')
    }

    const dc = this.conn.dataChannel
    // If buffer exceeds 1MB, wait for bufferedamountlow event before sending more
    if (dc && dc.bufferedAmount > 1024 * 1024) {
      await new Promise<void>((resolve) => {
        this.bufferedAmountLowResolver = resolve
      })
    }

    this.conn.send(chunk)
    this.networkStats.bytesSent += chunk.byteLength
  }

  public sendFileMetadata(meta: any): void {
    this.sendPacket({ _type: 'file-meta', ...meta })
  }

  public sendFileControl(control: any): void {
    this.sendPacket({ _type: 'file-ctrl', ...control })
  }

  public sendClipboard(item: ClipboardItem): void {
    this.sendPacket({ _type: 'clipboard', item })
  }

  public sendWorkspace(delta: WorkspaceDelta): void {
    this.sendPacket({ _type: 'workspace', delta })
  }

  private startPingMonitor() {
    this.stopPingMonitor()
    this.pingInterval = setInterval(() => {
      if (this.conn && this.conn.open) {
        this.sendPacket({ _type: 'ping', t: Date.now() })
      }
    }, 2000)
  }

  private stopPingMonitor() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
  }

  private async inspectCandidatePair() {
    if (!this.conn || !this.conn.peerConnection) return
    try {
      const stats = await this.conn.peerConnection.getStats()
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
      // stats ignore
    }
  }

  // Offline / Air-Gapped manual SDP exchange support
  public async generateManualOffer(): Promise<string> {
    this.manualPc = new RTCPeerConnection({ iceServers: getActiveIceServers() })
    const channel = this.manualPc.createDataChannel('files', { ordered: true })
    this.attachDataChannelBackpressure({ dataChannel: channel } as any)

    const offer = await this.manualPc.createOffer()
    await this.manualPc.setLocalDescription(offer)

    await new Promise<void>((resolve) => {
      if (this.manualPc!.iceGatheringState === 'complete') {
        resolve()
      } else {
        const check = () => {
          if (this.manualPc?.iceGatheringState === 'complete') {
            this.manualPc.removeEventListener('icegatheringstatechange', check)
            resolve()
          }
        }
        this.manualPc!.addEventListener('icegatheringstatechange', check)
        setTimeout(resolve, 1500)
      }
    })

    return btoa(JSON.stringify(this.manualPc!.localDescription))
  }

  public async applyManualOffer(offerBase64: string): Promise<string> {
    this.manualPc = new RTCPeerConnection({ iceServers: getActiveIceServers() })
    this.manualPc.ondatachannel = (e) => {
      this.attachDataChannelBackpressure({ dataChannel: e.channel } as any)
      this.updateState('connected')
    }

    const sdp = JSON.parse(atob(offerBase64))
    await this.manualPc.setRemoteDescription(new RTCSessionDescription(sdp))
    const answer = await this.manualPc.createAnswer()
    await this.manualPc.setLocalDescription(answer)

    await new Promise<void>((resolve) => {
      if (this.manualPc!.iceGatheringState === 'complete') {
        resolve()
      } else {
        const check = () => {
          if (this.manualPc?.iceGatheringState === 'complete') {
            this.manualPc.removeEventListener('icegatheringstatechange', check)
            resolve()
          }
        }
        this.manualPc!.addEventListener('icegatheringstatechange', check)
        setTimeout(resolve, 1500)
      }
    })

    return btoa(JSON.stringify(this.manualPc!.localDescription))
  }

  public async applyManualAnswer(answerBase64: string): Promise<void> {
    if (!this.manualPc) return
    const sdp = JSON.parse(atob(answerBase64))
    await this.manualPc.setRemoteDescription(new RTCSessionDescription(sdp))
    this.updateState('connected')
  }

  public disconnect() {
    this.stopPingMonitor()
    if (this.connectRetryTimer) {
      clearTimeout(this.connectRetryTimer)
      this.connectRetryTimer = null
    }

    if (this.conn) {
      try {
        this.conn.close()
      } catch {
        // ignore
      }
      this.conn = null
    }

    if (this.peer && !this.peer.destroyed) {
      try {
        this.peer.destroy()
      } catch {
        // ignore
      }
      this.peer = null
    }

    if (this.manualPc) {
      try {
        this.manualPc.close()
      } catch {
        // ignore
      }
      this.manualPc = null
    }

    this.remotePeer = null
    this.updateState('idle')
  }
}
