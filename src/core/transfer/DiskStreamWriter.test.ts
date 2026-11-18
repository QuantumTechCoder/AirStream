import { describe, it, expect, vi } from 'vitest'
import { createDiskStreamWriter } from './DiskStreamWriter'
import { FileReceiver } from './FileReceiver'
import type { FileMetadata } from '../webrtc/types'

describe('DiskStreamWriter & Zero-RAM Direct Streaming', () => {
  it('writes and finalizes in-memory fallback for small files', async () => {
    const writer = await createDiskStreamWriter('test-1', 'small.txt', 'text/plain', 1024)
    expect(writer.storageMode).toBe('ram')

    const chunk = new Uint8Array([1, 2, 3, 4, 5])
    await writer.write(chunk)

    const res = await writer.close()
    expect(res.savedToDisk).toBe(false)
    expect(typeof res.downloadUrl).toBe('string')
  })

  it('routes directly to FSA when preferred file handle is provided', async () => {
    const mockWrite = vi.fn().mockResolvedValue(undefined)
    const mockClose = vi.fn().mockResolvedValue(undefined)
    const mockHandle = {
      createWritable: vi.fn().mockResolvedValue({
        write: mockWrite,
        close: mockClose,
      }),
    }

    const writer = await createDiskStreamWriter(
      'test-fsa',
      'large.iso',
      'application/octet-stream',
      500 * 1024 * 1024,
      mockHandle
    )

    expect(writer.storageMode).toBe('fsa')
    const chunk = new Uint8Array([10, 20, 30])
    await writer.write(chunk)
    expect(mockWrite).toHaveBeenCalledWith(chunk)

    const res = await writer.close()
    expect(mockClose).toHaveBeenCalled()
    expect(res.savedToDisk).toBe(true)
  })

  it('FileReceiver coordinates chunk streaming and calls onProgress correctly', async () => {
    const updates: any[] = []
    const receiver = new FileReceiver((item) => updates.push({ ...item }))

    const fileId = 'test-file-99'
    const meta: FileMetadata = {
      id: fileId,
      name: 'hello.txt',
      size: 10,
      type: 'text/plain',
      totalChunks: 1,
      chunkSize: 10,
      senderId: 'peer1',
      senderName: 'Alice',
    }

    receiver.handleMetadata(meta)
    expect(updates.length).toBeGreaterThan(0)
    expect(updates[0].id).toBe(fileId)
    expect(updates[0].status).toBe('transferring')

    // Create 1 framed packet: 4 bytes index, 4 bytes len, fileId bytes, payload
    const idEncoded = new TextEncoder().encode(fileId)
    const headerLen = 8 + idEncoded.byteLength
    const payload = new Uint8Array([65, 66, 67, 68, 69, 70, 71, 72, 73, 74]) // 10 bytes
    const packet = new Uint8Array(headerLen + payload.byteLength)
    const view = new DataView(packet.buffer)

    view.setUint32(0, 0, false)
    view.setUint32(4, idEncoded.byteLength, false)
    packet.set(idEncoded, 8)
    packet.set(payload, headerLen)

    receiver.handleChunk(packet.buffer)

    // Wait microtask for async writes to complete
    await new Promise((r) => setTimeout(r, 50))

    const finalItem = receiver.getTransfer(fileId)
    expect(finalItem).toBeDefined()
    expect(finalItem?.status).toBe('completed')
    expect(finalItem?.progress).toBe(100)
    expect(finalItem?.bytesTransferred).toBe(10)
  })
})
