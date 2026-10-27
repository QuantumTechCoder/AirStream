import { describe, it, expect } from 'vitest'

describe('WebRTC Binary Chunk Framing', () => {
  it('correctly frames and un-frames chunk index, file ID, and binary payload', () => {
    const chunkIndex = 42
    const fileId = 'file_12345_test'
    const rawData = new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80])

    // Frame packet
    const fileIdEncoded = new TextEncoder().encode(fileId)
    const headerLength = 8 + fileIdEncoded.byteLength
    const packet = new Uint8Array(headerLength + rawData.byteLength)
    const view = new DataView(packet.buffer)

    view.setUint32(0, chunkIndex, false)
    view.setUint32(4, fileIdEncoded.byteLength, false)
    packet.set(fileIdEncoded, 8)
    packet.set(rawData, headerLength)

    // Un-frame packet
    const parseView = new DataView(packet.buffer)
    const parsedChunkIndex = parseView.getUint32(0, false)
    const parsedFileIdLen = parseView.getUint32(4, false)
    const parsedFileId = new TextDecoder().decode(packet.subarray(8, 8 + parsedFileIdLen))
    const parsedPayload = packet.subarray(8 + parsedFileIdLen)

    expect(parsedChunkIndex).toBe(chunkIndex)
    expect(parsedFileIdLen).toBe(fileIdEncoded.byteLength)
    expect(parsedFileId).toBe(fileId)
    expect(Array.from(parsedPayload)).toEqual(Array.from(rawData))
  })
})
