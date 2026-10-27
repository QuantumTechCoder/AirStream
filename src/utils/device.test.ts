import { describe, it, expect } from 'vitest'
import { formatBytes, formatDuration, formatSpeed, generateRoomId } from './device'

describe('Device and Formatting Utilities', () => {
  it('formats bytes correctly', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(1024)).toBe('1 KB')
    expect(formatBytes(1048576)).toBe('1 MB')
    expect(formatBytes(1073741824)).toBe('1 GB')
    expect(formatBytes(52428800)).toBe('50 MB')
  })

  it('formats speeds correctly', () => {
    expect(formatSpeed(1048576)).toBe('1 MB/s')
    expect(formatSpeed(52428800)).toBe('50 MB/s')
  })

  it('formats duration ETA correctly', () => {
    expect(formatDuration(0)).toBe('0s')
    expect(formatDuration(15)).toBe('15s')
    expect(formatDuration(90)).toBe('1m 30s')
    expect(formatDuration(3665)).toBe('1h 1m')
    expect(formatDuration(-1)).toBe('--')
    expect(formatDuration(Infinity)).toBe('--')
  })

  it('generates a 6-character uppercase room ID', () => {
    const id = generateRoomId()
    expect(id).toHaveLength(6)
    expect(id).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/)
  })
})
