// WebRTC Core Type Definitions for AirStream

export type ConnectionState =
  | 'idle'
  | 'pairing'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'failed'

export interface PeerInfo {
  id: string
  name: string
  os: string
  browser: string
  deviceType: 'desktop' | 'mobile' | 'tablet'
  isHost: boolean
}

export interface SignalingMessage {
  id?: string
  from: string
  to?: string
  type: 'offer' | 'answer' | 'candidate' | 'join' | 'leave' | 'peer-info' | 'ping'
  data: any
  timestamp?: number
}

export interface FileMetadata {
  id: string
  name: string
  size: number
  type: string
  totalChunks: number
  chunkSize: number
  checksum?: string
  senderId: string
  senderName: string
}

export type TransferStatus =
  | 'queued'
  | 'transferring'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled'

export interface TransferItem {
  id: string
  name: string
  size: number
  type: string
  bytesTransferred: number
  progress: number // 0 to 100
  speedMBps: number
  etaSeconds: number
  status: TransferStatus
  isSender: boolean
  error?: string
  blobUrl?: string
  downloadUrl?: string
  startedAt: number
  completedAt?: number
}

export interface ClipboardItem {
  id: string
  text: string
  type: 'text' | 'code' | 'url'
  timestamp: number
  senderId: string
  senderName: string
}

export interface WorkspaceDelta {
  docId: string
  content: string
  language: string
  version: number
  senderId: string
  cursor?: {
    line: number
    ch: number
  }
}

export interface NetworkStats {
  rttMs: number
  bytesReceived: number
  bytesSent: number
  connectionType: 'local' | 'stun' | 'turn' | 'unknown'
}
