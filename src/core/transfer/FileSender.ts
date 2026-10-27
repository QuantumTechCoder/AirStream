// High-Performance Backpressure File Sender Engine

import type { TransferItem, FileMetadata } from '../webrtc/types'
import type { WebRTCConnection } from '../webrtc/WebRTCConnection'

const CHUNK_SIZE = 64 * 1024 // 64 KB optimal chunk size for WebRTC DataChannel

export class FileSender {
  public item: TransferItem
  private file: File
  private connection: WebRTCConnection
  private onProgress: (item: TransferItem) => void
  private isPaused = false
  private isCancelled = false
  private currentChunk = 0
  private totalChunks = 0

  // Speed calculation sliding window
  private lastBytes = 0
  private lastTime = 0
  private speedSamples: number[] = []

  constructor(
    file: File,
    connection: WebRTCConnection,
    onProgress: (item: TransferItem) => void
  ) {
    this.file = file
    this.connection = connection
    this.onProgress = onProgress
    this.totalChunks = Math.ceil(file.size / CHUNK_SIZE)

    const fileId = `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`

    this.item = {
      id: fileId,
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      bytesTransferred: 0,
      progress: 0,
      speedMBps: 0,
      etaSeconds: 0,
      status: 'queued',
      isSender: true,
      startedAt: Date.now(),
    }
  }

  public async start(): Promise<void> {
    this.item.status = 'transferring'
    this.item.startedAt = Date.now()
    this.lastTime = Date.now()
    this.lastBytes = 0

    // 1. Broadcast file metadata
    const meta: FileMetadata = {
      id: this.item.id,
      name: this.item.name,
      size: this.item.size,
      type: this.item.type,
      totalChunks: this.totalChunks,
      chunkSize: CHUNK_SIZE,
      senderId: this.connection.localPeer.id,
      senderName: this.connection.localPeer.name,
    }

    this.connection.sendFileMetadata(meta)

    // Brief pause to allow receiver to open file stream
    await new Promise((r) => setTimeout(r, 100))

    // 2. Stream chunks sequentially with backpressure
    while (this.currentChunk < this.totalChunks && !this.isCancelled) {
      if (this.isPaused) {
        await new Promise((r) => setTimeout(r, 200))
        continue
      }

      const start = this.currentChunk * CHUNK_SIZE
      const end = Math.min(start + CHUNK_SIZE, this.file.size)
      const sliceBlob = this.file.slice(start, end)
      const buffer = await sliceBlob.arrayBuffer()

      // Create framed packet: [Uint32 chunkIndex, Uint32 fileIdLength, fileIdBytes, chunkPayload]
      const fileIdEncoded = new TextEncoder().encode(this.item.id)
      const headerLength = 8 + fileIdEncoded.byteLength
      const packet = new Uint8Array(headerLength + buffer.byteLength)
      const view = new DataView(packet.buffer)

      view.setUint32(0, this.currentChunk, false) // Big-endian chunk index
      view.setUint32(4, fileIdEncoded.byteLength, false)
      packet.set(fileIdEncoded, 8)
      packet.set(new Uint8Array(buffer), headerLength)

      try {
        await this.connection.sendFileChunk(packet.buffer)
      } catch (err: any) {
        if (!this.isCancelled) {
          this.item.status = 'failed'
          this.item.error = err.message || 'DataChannel transfer error'
          this.onProgress({ ...this.item })
        }
        return
      }

      this.currentChunk++
      this.item.bytesTransferred = end
      this.item.progress = Math.round((end / this.file.size) * 100)

      this.updateMetrics()
      this.onProgress({ ...this.item })
    }

    if (this.isCancelled) {
      this.item.status = 'cancelled'
      this.connection.sendFileControl({ fileId: this.item.id, action: 'cancel' })
    } else {
      this.item.status = 'completed'
      this.item.completedAt = Date.now()
      this.item.speedMBps = 0
      this.item.etaSeconds = 0
      this.connection.sendFileControl({ fileId: this.item.id, action: 'complete' })
    }

    this.onProgress({ ...this.item })
  }

  private updateMetrics() {
    const now = Date.now()
    const elapsed = (now - this.lastTime) / 1000

    if (elapsed >= 0.5) {
      const bytesInWindow = this.item.bytesTransferred - this.lastBytes
      const currentSpeed = bytesInWindow / elapsed // bytes/sec

      this.speedSamples.push(currentSpeed)
      if (this.speedSamples.length > 5) this.speedSamples.shift()

      const avgSpeed = this.speedSamples.reduce((a, b) => a + b, 0) / this.speedSamples.length
      this.item.speedMBps = avgSpeed / (1024 * 1024)

      const remainingBytes = this.file.size - this.item.bytesTransferred
      this.item.etaSeconds = avgSpeed > 0 ? remainingBytes / avgSpeed : 0

      this.lastBytes = this.item.bytesTransferred
      this.lastTime = now
    }
  }

  public pause(): void {
    this.isPaused = true
    this.item.status = 'paused'
    this.connection.sendFileControl({ fileId: this.item.id, action: 'pause' })
    this.onProgress({ ...this.item })
  }

  public resume(): void {
    this.isPaused = false
    this.item.status = 'transferring'
    this.lastTime = Date.now()
    this.connection.sendFileControl({ fileId: this.item.id, action: 'resume' })
    this.onProgress({ ...this.item })
  }

  public cancel(): void {
    this.isCancelled = true
    this.item.status = 'cancelled'
    this.connection.sendFileControl({ fileId: this.item.id, action: 'cancel' })
    this.onProgress({ ...this.item })
  }
}
