// Main AirStream React Context & Provider

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import confetti from 'canvas-confetti'
import type {
  ConnectionState,
  PeerInfo,
  NetworkStats,
  TransferItem,
  ClipboardItem,
  WorkspaceDelta,
} from '../core/webrtc/types'
import { WebRTCConnection } from '../core/webrtc/WebRTCConnection'
import { FileSender } from '../core/transfer/FileSender'
import { FileReceiver } from '../core/transfer/FileReceiver'
import { detectPeerInfo, generateRoomId } from '../utils/device'

interface AirStreamContextType {
  connectionState: ConnectionState
  roomId: string | null
  localPeer: PeerInfo
  remotePeer: PeerInfo | null
  networkStats: NetworkStats
  transfers: TransferItem[]
  clipboardHistory: ClipboardItem[]
  workspaceDoc: { content: string; language: string; version: number }
  isHost: boolean
  createRoom: () => Promise<string>
  joinRoom: (id: string) => Promise<void>
  disconnect: () => void
  sendFiles: (files: FileList | File[]) => Promise<void>
  pauseTransfer: (id: string) => void
  resumeTransfer: (id: string) => void
  cancelTransfer: (id: string) => void
  clearTransfers: () => void
  broadcastClipboard: (text: string, type?: 'text' | 'code' | 'url') => void
  clearClipboard: () => void
  updateWorkspaceDoc: (content: string, language?: string) => void
  generateOfflineOffer: () => Promise<string>
  applyOfflineOffer: (offerBase64: string) => Promise<string>
  applyOfflineAnswer: (answerBase64: string) => Promise<void>
}

const AirStreamContext = createContext<AirStreamContextType | null>(null)

export const AirStreamProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const localPeerRef = useRef<PeerInfo>(
    detectPeerInfo(`peer_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`)
  )
  const [localPeer] = useState<PeerInfo>(localPeerRef.current)
  const [remotePeer, setRemotePeer] = useState<PeerInfo | null>(null)
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle')
  const [roomId, setRoomId] = useState<string | null>(null)
  const [isHost, setIsHost] = useState(false)
  const [networkStats, setNetworkStats] = useState<NetworkStats>({
    rttMs: 0,
    bytesReceived: 0,
    bytesSent: 0,
    connectionType: 'unknown',
  })

  const [transfers, setTransfers] = useState<TransferItem[]>([])
  const [clipboardHistory, setClipboardHistory] = useState<ClipboardItem[]>([])
  const [workspaceDoc, setWorkspaceDoc] = useState<{ content: string; language: string; version: number }>({
    content: '// AirStream Collaborative Scratchpad\n// Changes sync instantly with connected peers via RTCDataChannel!\n\nfunction calculateSpeed(bytes, seconds) {\n  return (bytes / (1024 * 1024)) / seconds;\n}\n\nconsole.log("Ready to stream!");\n',
    language: 'javascript',
    version: 1,
  })

  const connectionRef = useRef<WebRTCConnection | null>(null)
  const receiverRef = useRef<FileReceiver | null>(null)
  const sendersRef = useRef<Map<string, FileSender>>(new Map())

  // Sound effect on completion
  const playChime = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(587.33, ctx.currentTime) // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1) // A5
      gain.gain.setValueAtTime(0.15, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.3)
    } catch {
      // AudioContext not allowed before user interaction
    }
  }, [])

  // Update or append transfer item
  const updateTransfer = useCallback((item: TransferItem) => {
    setTransfers((prev) => {
      const idx = prev.findIndex((t) => t.id === item.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = item
        return next
      }
      return [item, ...prev]
    })

    if (item.status === 'completed' && !item.isSender) {
      playChime()
      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.8 },
          colors: ['#06b6d4', '#3b82f6', '#8b5cf6'],
        })
      } catch {
        // ignore
      }
    }
  }, [playChime])

  // Initialize WebRTC connection instance
  const initConnection = useCallback(() => {
    if (connectionRef.current) {
      connectionRef.current.disconnect()
    }

    receiverRef.current = new FileReceiver(updateTransfer)

    const conn = new WebRTCConnection(localPeerRef.current, {
      onStateChange: (state) => setConnectionState(state),
      onPeerInfo: (peer) => setRemotePeer(peer),
      onNetworkStats: (stats) => setNetworkStats(stats),
      onFileMetadata: (meta) => receiverRef.current?.handleMetadata(meta),
      onFileChunk: (chunk) => receiverRef.current?.handleChunk(chunk),
      onFileControl: (control) => receiverRef.current?.handleControl(control),
      onClipboard: (item) => {
        setClipboardHistory((prev) => [item, ...prev.slice(0, 49)])
      },
      onWorkspace: (delta) => {
        setWorkspaceDoc((prev) => {
          if (delta.version > prev.version) {
            return {
              content: delta.content,
              language: delta.language || prev.language,
              version: delta.version,
            }
          }
          return prev
        })
      },
    })

    connectionRef.current = conn
    return conn
  }, [updateTransfer])

  // Create room (Host)
  const createRoom = useCallback(async (): Promise<string> => {
    const id = generateRoomId()
    setRoomId(id)
    setIsHost(true)
    const conn = initConnection()
    await conn.start(id, true)
    return id
  }, [initConnection])

  // Join room (Guest)
  const joinRoom = useCallback(
    async (id: string): Promise<void> => {
      const cleanId = id.trim().toUpperCase()
      setRoomId(cleanId)
      setIsHost(false)
      const conn = initConnection()
      await conn.start(cleanId, false)
    },
    [initConnection]
  )

  // Disconnect
  const disconnect = useCallback(() => {
    connectionRef.current?.disconnect()
    connectionRef.current = null
    setConnectionState('idle')
    setRoomId(null)
    setRemotePeer(null)
    setNetworkStats({ rttMs: 0, bytesReceived: 0, bytesSent: 0, connectionType: 'unknown' })
  }, [])

  // Send Files
  const sendFiles = useCallback(
    async (files: FileList | File[]): Promise<void> => {
      if (!connectionRef.current || connectionState !== 'connected') {
        throw new Error('Not connected to a peer')
      }

      const fileList = Array.from(files)
      for (const file of fileList) {
        const sender = new FileSender(file, connectionRef.current, updateTransfer)
        sendersRef.current.set(sender.item.id, sender)
        updateTransfer(sender.item)
        // Send file asynchronously in background
        sender.start().then(() => {
          playChime()
          try {
            confetti({
              particleCount: 40,
              spread: 50,
              origin: { y: 0.8 },
              colors: ['#06b6d4', '#10b981'],
            })
          } catch {
            // ignore
          }
        })
      }
    },
    [connectionState, updateTransfer, playChime]
  )

  const pauseTransfer = useCallback((id: string) => {
    sendersRef.current.get(id)?.pause()
  }, [])

  const resumeTransfer = useCallback((id: string) => {
    sendersRef.current.get(id)?.resume()
  }, [])

  const cancelTransfer = useCallback((id: string) => {
    sendersRef.current.get(id)?.cancel()
  }, [])

  const clearTransfers = useCallback(() => {
    setTransfers((prev) => prev.filter((t) => t.status === 'transferring' || t.status === 'paused'))
  }, [])

  // Clipboard sync
  const broadcastClipboard = useCallback(
    (text: string, type: 'text' | 'code' | 'url' = 'text') => {
      if (!text.trim()) return

      // Auto detect URLs
      let detectedType = type
      if (type === 'text') {
        if (/^https?:\/\//i.test(text.trim())) {
          detectedType = 'url'
        } else if (text.includes('\n') && (text.includes('{') || text.includes('function') || text.includes('import '))) {
          detectedType = 'code'
        }
      }

      const item: ClipboardItem = {
        id: `clip_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        text,
        type: detectedType,
        timestamp: Date.now(),
        senderId: localPeer.id,
        senderName: localPeer.name,
      }

      setClipboardHistory((prev) => [item, ...prev.slice(0, 49)])
      connectionRef.current?.sendClipboard(item)
    },
    [localPeer]
  )

  const clearClipboard = useCallback(() => {
    setClipboardHistory([])
  }, [])

  // Shared Workspace
  const updateWorkspaceDoc = useCallback(
    (content: string, language?: string) => {
      setWorkspaceDoc((prev) => {
        const nextVersion = prev.version + 1
        const nextLang = language || prev.language
        const delta: WorkspaceDelta = {
          docId: 'shared-pad',
          content,
          language: nextLang,
          version: nextVersion,
          senderId: localPeer.id,
        }
        connectionRef.current?.sendWorkspace(delta)
        return { content, language: nextLang, version: nextVersion }
      })
    },
    [localPeer]
  )

  // Offline SDP Air-Gapped mode
  const generateOfflineOffer = useCallback(async () => {
    const conn = initConnection()
    return await conn.generateManualOffer()
  }, [initConnection])

  const applyOfflineOffer = useCallback(
    async (offerBase64: string) => {
      const conn = initConnection()
      return await conn.applyManualOffer(offerBase64)
    },
    [initConnection]
  )

  const applyOfflineAnswer = useCallback(async (answerBase64: string) => {
    if (connectionRef.current) {
      await connectionRef.current.applyManualAnswer(answerBase64)
    }
  }, [])

  // Check URL hash for direct room invite on startup e.g. #room=ABC123
  useEffect(() => {
    const hash = window.location.hash
    if (hash && hash.includes('room=')) {
      const match = hash.match(/room=([A-Za-z0-9_-]+)/)
      if (match && match[1]) {
        joinRoom(match[1])
      }
    }
  }, [joinRoom])

  return (
    <AirStreamContext.Provider
      value={{
        connectionState,
        roomId,
        localPeer,
        remotePeer,
        networkStats,
        transfers,
        clipboardHistory,
        workspaceDoc,
        isHost,
        createRoom,
        joinRoom,
        disconnect,
        sendFiles,
        pauseTransfer,
        resumeTransfer,
        cancelTransfer,
        clearTransfers,
        broadcastClipboard,
        clearClipboard,
        updateWorkspaceDoc,
        generateOfflineOffer,
        applyOfflineOffer,
        applyOfflineAnswer,
      }}
    >
      {children}
    </AirStreamContext.Provider>
  )
}

export function useAirStream() {
  const context = useContext(AirStreamContext)
  if (!context) {
    throw new Error('useAirStream must be used within an AirStreamProvider')
  }
  return context
}
