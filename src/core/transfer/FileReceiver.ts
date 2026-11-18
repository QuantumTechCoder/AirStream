// Resilient File Receiver Engine with Direct-to-Disk Stream & Blob Assembly
// Eliminates receiver-side memory ceilings by streaming chunks directly to disk (FSA / OPFS)

import type { TransferItem, FileMetadata } from '../webrtc/types'
import { createDiskStreamWriter, type DiskWriter } from './DiskStreamWriter'

interface ActiveReceive {
  meta: FileMetadata
  item: TransferItem
  writerPromise: Promise<DiskWriter>
  writer?: DiskWriter
  writeQueue: Promise<void>
  receivedBytes: number
  lastBytes: number
  lastTime: number
  speedSamples: number[]
}

export class FileReceiver {
  private activeTransfers = new Map<string, ActiveReceive>()
  private onProgress: (item: TransferItem) => void

  constructor(onProgress: (item: TransferItem) => void) {
    this.onProgress = onProgress
  }

  public handleMetadata(meta: FileMetadata, preferredFsaHandle?: any): void {
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
      storageMode: meta.size >= 50 * 1024 * 1024 ? 'opfs' : 'ram',
      startedAt: Date.now(),
    }

    const writerPromise = createDiskStreamWriter(
      meta.id,
      meta.name,
      meta.type,
      meta.size,
      preferredFsaHandle
    )

    // Update storageMode once writer resolves
    writerPromise.then((w) => {
      const active = this.activeTransfers.get(meta.id)
      if (active) {
        active.writer = w
        active.item.storageMode = w.storageMode
        this.onProgress({ ...active.item })
      }
    })

    this.activeTransfers.set(meta.id, {
      meta,
      item,
      writerPromise,
      writeQueue: Promise.resolve(),
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

    // Stream chunk directly to disk or buffer via sequential queue
    active.writeQueue = active.writeQueue
      .then(async () => {
        const writer = active.writer || (active.writer = await active.writerPromise)
        await writer.write(payloadBytes)
      })
      .catch((err) => {
        console.error(`Error streaming chunk to disk for ${fileId}:`, err)
      })

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
      active.writeQueue = active.writeQueue.then(async () => {
        try {
          const writer = active.writer || (await active.writerPromise)
          await writer.abort()
        } catch {
          // ignore
        }
      })
      this.onProgress({ ...active.item })
    } else if (control.action === 'complete') {
      if (active.item.status !== 'completed') {
        this.finalizeTransfer(active)
      }
    }
  }

  private async finalizeTransfer(active: ActiveReceive) {
    active.item.status = 'completed'
    active.item.progress = 100
    active.item.bytesTransferred = active.meta.size
    active.item.speedMBps = 0
    active.item.etaSeconds = 0
    active.item.completedAt = Date.now()

    try {
      // Ensure all queued chunks have flushed to disk
      await active.writeQueue
      const writer = active.writer || (await active.writerPromise)
      const res = await writer.close()

      active.item.storageMode = writer.storageMode
      if (res.savedToDisk) {
        active.item.savedDirectlyToDisk = true
      } else if (res.downloadUrl) {
        active.item.blobUrl = res.downloadUrl
        active.item.downloadUrl = res.downloadUrl
      }
    } catch (e: any) {
      console.error('Failed to finalize file transfer stream:', e)
      active.item.status = 'failed'
      active.item.error = e?.message || 'Failed to finalize stream on disk'
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
