// Device detection and formatting utilities

import type { PeerInfo } from '../core/webrtc/types'

const ADJECTIVES = ['Swift', 'Cyber', 'Neon', 'Cosmic', 'Solar', 'Hyper', 'Quantum', 'Vivid', 'Sonic', 'Astral', 'Orbit', 'Pulse']
const NOUNS = ['Falcon', 'Phoenix', 'Dolphin', 'Tiger', 'Eagle', 'Otter', 'Lynx', 'Orion', 'Nova', 'Comet', 'Vortex', 'Hawk']

export function generatePeerName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]
  const num = Math.floor(Math.random() * 900) + 100
  return `${adj} ${noun} ${num}`
}

export function detectPeerInfo(peerId: string, isHost = false): PeerInfo {
  const ua = navigator.userAgent
  let os = 'Unknown OS'
  if (/Windows/i.test(ua)) os = 'Windows'
  else if (/Macintosh|Mac OS X/i.test(ua)) os = 'macOS'
  else if (/Linux/i.test(ua)) os = 'Linux'
  else if (/Android/i.test(ua)) os = 'Android'
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS'

  let browser = 'Unknown Browser'
  if (/Edg/i.test(ua)) browser = 'Edge'
  else if (/Chrome/i.test(ua)) browser = 'Chrome'
  else if (/Firefox/i.test(ua)) browser = 'Firefox'
  else if (/Safari/i.test(ua)) browser = 'Safari'

  const isMobile = /Android|iPhone|iPod/i.test(ua)
  const isTablet = /iPad/i.test(ua) || (isMobile && window.innerWidth >= 768)
  const deviceType: 'desktop' | 'mobile' | 'tablet' = isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop'

  // Persist local name in sessionStorage or localStorage
  let savedName = localStorage.getItem('airstream_peer_name')
  if (!savedName) {
    savedName = generatePeerName()
    localStorage.setItem('airstream_peer_name', savedName)
  }

  return {
    id: peerId,
    name: savedName,
    os,
    browser,
    deviceType,
    isHost,
  }
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

export function formatSpeed(bytesPerSec: number): string {
  return `${formatBytes(bytesPerSec)}/s`
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '--'
  if (seconds < 60) return `${Math.ceil(seconds)}s`
  const mins = Math.floor(seconds / 60)
  const secs = Math.ceil(seconds % 60)
  if (mins < 60) return `${mins}m ${secs}s`
  const hours = Math.floor(mins / 60)
  return `${hours}h ${mins % 60}m`
}

export function generateRoomId(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
  let result = ''
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}
