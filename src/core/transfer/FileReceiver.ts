// Resilient File Receiver Engine with Direct Stream & Blob Assembly

import type { TransferItem, FileMetadata } from '../webrtc/types'

interface ActiveReceive {
  meta: FileMetadata
  item: TransferItem
  chunks: Uint8Array[]
  receivedBytes: number
  lastBytes: number
  lastTime: number
  speedSamples: number[]
  writableStream?: any // FileSystemWritableFileStream if available
}

export class FileReceiver {
  private activeTransfers = new Map<string, ActiveReceive>()
  private onProgress: (item: TransferItem) => void

  constructor(onProgress: (item: TransferItem) => void) {
    this.onProgress = onProgress
  }

  public handleMetadata(meta: FileMetadata): void {
    const item: TransferItem = {
      id: meta.id,
      name: meta.name,
      size: meta.size,
      type: meta.type,
      bytesTransferred: 0,
      progress: 0,
      speedMBps: 0,
      etaSeconds: 0,
      status: 'transferring',
      isSender: false,
      startedAt: Date.now(),
    }

    this.activeTransfers.set(meta.id, {
      meta,
      item,
      chunks: [],
      receivedBytes: 0,
      lastBytes: 0,
      lastTime: Date.now(),
      speedSamples: [],
    })

    this.onProgress({ ...item })
  }

  public handleChunk(packetBuffer: ArrayBuffer): void {
    if (packetBuffer.byteLength < 8) return

    const view = new DataView(packetBuffer)
    const fileIdLen = view.getUint32(4, false)

    if (packetBuffer.byteLength < 8 + fileIdLen) return

    const fileIdBytes = new Uint8Array(packetBuffer, 8, fileIdLen)
    const fileId = new TextDecoder().decode(fileIdBytes)
    const payloadBytes = new Uint8Array(packetBuffer, 8 + fileIdLen)

    const active = this.activeTransfers.get(fileId)
    if (!active) return

    // Store chunk payload
    active.chunks.push(payloadBytes)
    active.receivedBytes += payloadBytes.byteLength
    active.item.bytesTransferred = active.receivedBytes
    active.item.progress = Math.min(100, Math.round((active.receivedBytes / active.meta.size) * 100))

    this.updateMetrics(active)

    if (active.receivedBytes >= active.meta.size) {
      this.finalizeTransfer(active)
    } else {
      this.onProgress({ ...active.item })
    }
  }

  public handleControl(control: { fileId: string; action: string }): void {
    const active = this.activeTransfers.get(control.fileId)
    if (!active) return

    if (control.action === 'pause') {
      active.item.status = 'paused'
      this.onProgress({ ...active.item })
    } else if (control.action === 'resume') {
      active.item.status = 'transferring'
      active.lastTime = Date.now()
      this.onProgress({ ...active.item })
    } else if (control.action === 'cancel') {
      active.item.status = 'cancelled'
      active.chunks = []
      this.onProgress({ ...active.item })
    } else if (control.action === 'complete') {
      if (active.item.status !== 'completed') {
        this.finalizeTransfer(active)
      }
    }
  }

  private finalizeTransfer(active: ActiveReceive) {
    active.item.status = 'completed'
    active.item.progress = 100
    active.item.bytesTransferred = active.meta.size
    active.item.speedMBps = 0
    active.item.etaSeconds = 0
    active.item.completedAt = Date.now()

    // Assemble blob for download
    try {
      const blob = new Blob(active.chunks as unknown as BlobPart[], {
        type: active.meta.type || 'application/octet-stream',
      })
      const url = URL.createObjectURL(blob)
      active.item.blobUrl = url
      active.item.downloadUrl = url

      // Clean up chunk memory now that blob is created
      active.chunks = []
    } catch (e) {
      console.error('Failed to create Blob from chunks', e)
    }

    this.onProgress({ ...active.item })
  }

  private updateMetrics(active: ActiveReceive) {
    const now = Date.now()
    const elapsed = (now - active.lastTime) / 1000

    if (elapsed >= 0.5) {
      const bytesInWindow = active.receivedBytes - active.lastBytes
      const currentSpeed = bytesInWindow / elapsed

      active.speedSamples.push(currentSpeed)
      if (active.speedSamples.length > 5) active.speedSamples.shift()

      const avgSpeed = active.speedSamples.reduce((a, b) => a + b, 0) / active.speedSamples.length
      active.item.speedMBps = avgSpeed / (1024 * 1024)

      const remainingBytes = active.meta.size - active.receivedBytes
      active.item.etaSeconds = avgSpeed > 0 ? remainingBytes / avgSpeed : 0

      active.lastBytes = active.receivedBytes
      active.lastTime = now
    }
  }

  public getTransfer(fileId: string): TransferItem | undefined {
    return this.activeTransfers.get(fileId)?.item
  }
}
