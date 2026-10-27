// Signaling Client with Cloudflare Pages Functions & local BroadcastChannel fallback

import type { SignalingMessage } from '../webrtc/types'

export type SignalHandler = (message: SignalingMessage) => void

export class SignalingClient {
  private roomId: string | null = null
  private peerId: string
  private onMessage: SignalHandler
  private polling = false
  private pollTimer: any = null
  private lastPollTimestamp = 0
  private broadcastChannel: BroadcastChannel | null = null
  private useBroadcastOnly = false

  constructor(peerId: string, onMessage: SignalHandler) {
    this.peerId = peerId
    this.onMessage = onMessage
  }

  public async init(roomId: string, isHost: boolean): Promise<boolean> {
    this.roomId = roomId

    // Initialize local cross-tab BroadcastChannel for instant local dev & multi-tab test
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        this.broadcastChannel = new BroadcastChannel(`airstream_room_${roomId}`)
        this.broadcastChannel.onmessage = (event) => {
          const msg = event.data as SignalingMessage
          if (msg && msg.from !== this.peerId) {
            if (!msg.to || msg.to === this.peerId) {
              this.onMessage(msg)
            }
          }
        }
      }
    } catch {
      // BroadcastChannel not available
    }

    // Attempt registration with Cloudflare Pages Functions signaling endpoint
    try {
      const res = await fetch('/api/signal/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: isHost ? 'create' : 'join',
          roomId,
          peerId: this.peerId,
        }),
      })

      if (res.ok) {
        this.startPolling()
        return true
      }
    } catch {
      // Server signaling unavailable, fallback to BroadcastChannel
      console.info('[Signaling] Cloudflare Pages Function unavailable, using BroadcastChannel')
    }

    this.useBroadcastOnly = true
    return false
  }

  public async send(msg: Omit<SignalingMessage, 'from' | 'timestamp'>): Promise<void> {
    if (!this.roomId) return

    const payload: SignalingMessage = {
      ...msg,
      from: this.peerId,
      timestamp: Date.now(),
    }

    // Always mirror to BroadcastChannel for local peers/tabs
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(payload)
      } catch (e) {
        console.error('BroadcastChannel send error', e)
      }
    }

    // Send to remote Cloudflare Pages Functions endpoint if available
    if (!this.useBroadcastOnly) {
      try {
        await fetch('/api/signal/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId: this.roomId,
            ...payload,
          }),
        })
      } catch {
        this.useBroadcastOnly = true
      }
    }
  }

  private startPolling() {
    if (this.polling) return
    this.polling = true

    const poll = async () => {
      if (!this.polling || !this.roomId) return

      try {
        const url = `/api/signal/poll?roomId=${encodeURIComponent(this.roomId)}&peerId=${encodeURIComponent(
          this.peerId
        )}&since=${this.lastPollTimestamp}`

        const res = await fetch(url)
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data.messages)) {
            for (const msg of data.messages) {
              this.lastPollTimestamp = Math.max(this.lastPollTimestamp, msg.timestamp || 0)
              this.onMessage(msg)
            }
          }
        }
      } catch {
        // Polling transient failure
      }

      if (this.polling) {
        // Poll every 800ms while active
        this.pollTimer = setTimeout(poll, 800)
      }
    }

    poll()
  }

  public destroy() {
    this.polling = false
    if (this.pollTimer) {
      clearTimeout(this.pollTimer)
      this.pollTimer = null
    }

    if (this.roomId && !this.useBroadcastOnly) {
      try {
        navigator.sendBeacon?.(
          '/api/signal/leave',
          JSON.stringify({ roomId: this.roomId, peerId: this.peerId })
        )
      } catch {
        // Ignore
      }
    }

    if (this.broadcastChannel) {
      this.broadcastChannel.close()
      this.broadcastChannel = null
    }
    this.roomId = null
  }
}
