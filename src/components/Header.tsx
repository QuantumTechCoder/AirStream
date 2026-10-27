// Sleek Navigation & Status Header

import React, { useState } from 'react'
import {
  Radio,
  Wifi,
  WifiOff,
  QrCode,
  Copy,
  Check,
  LogOut,
  Smartphone,
  Laptop,
  Tablet,
  Activity,
  Share2,
} from 'lucide-react'
import { useAirStream } from '../context/AirStreamContext'

interface HeaderProps {
  onOpenRoomModal: () => void
}

export const Header: React.FC<HeaderProps> = ({ onOpenRoomModal }) => {
  const {
    connectionState,
    roomId,
    localPeer,
    remotePeer,
    networkStats,
    disconnect,
  } = useAirStream()

  const [copiedLink, setCopiedLink] = useState(false)

  const handleCopyLink = () => {
    if (!roomId) return
    const url = `${window.location.origin}${window.location.pathname}#room=${roomId}`
    navigator.clipboard.writeText(url)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const getDeviceIcon = (deviceType?: string) => {
    switch (deviceType) {
      case 'mobile':
        return <Smartphone className="w-3.5 h-3.5" />
      case 'tablet':
        return <Tablet className="w-3.5 h-3.5" />
      default:
        return <Laptop className="w-3.5 h-3.5" />
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#090d16]/85 backdrop-blur-xl px-4 lg:px-8 py-3.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 shadow-lg shadow-cyan-500/20">
            <Radio className="w-5 h-5 text-white animate-pulse" />
            <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  connectionState === 'connected' ? 'bg-emerald-400' : 'bg-cyan-400'
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-3 w-3 ${
                  connectionState === 'connected' ? 'bg-emerald-500' : 'bg-cyan-500'
                }`}
              />
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-xl tracking-tight bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-300 bg-clip-text text-transparent">
                AirStream
              </span>
              <span className="px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase rounded border border-cyan-500/30 text-cyan-400 bg-cyan-500/10">
                P2P
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Zero-Limit WebRTC File Stream
            </p>
          </div>
        </div>

        {/* Center / Status Bar */}
        <div className="flex items-center gap-2.5">
          {connectionState === 'connected' && remotePeer ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <div className="flex items-center gap-1.5">
                {getDeviceIcon(remotePeer.deviceType)}
                <span className="font-semibold text-slate-200">{remotePeer.name}</span>
                <span className="text-slate-400 hidden md:inline">({remotePeer.os})</span>
              </div>
              <span className="text-slate-600">|</span>
              <div className="flex items-center gap-1 text-slate-300">
                <Activity className="w-3 h-3 text-cyan-400" />
                <span>{networkStats.rttMs > 0 ? `${networkStats.rttMs}ms` : '< 5ms'}</span>
                {networkStats.connectionType === 'local' && (
                  <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-1 py-0.2 rounded font-mono">
                    LAN
                  </span>
                )}
              </div>
            </div>
          ) : connectionState === 'pairing' || connectionState === 'connecting' ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium animate-pulse">
              <Wifi className="w-3.5 h-3.5 text-amber-400 animate-spin" />
              <span>Waiting for peer...</span>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/60 border border-slate-700/60 text-slate-400 text-xs">
              <WifiOff className="w-3.5 h-3.5 text-slate-500" />
              <span>Standby — Pair with another device</span>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {roomId ? (
            <>
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-colors"
                title="Copy Pairing Link"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-mono font-bold text-cyan-400">{roomId}</span>
                  </>
                )}
              </button>

              <button
                onClick={onOpenRoomModal}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors"
                title="Show QR Code"
              >
                <QrCode className="w-4 h-4" />
              </button>

              <button
                onClick={disconnect}
                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 transition-colors"
                title="Disconnect Session"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button
              onClick={onOpenRoomModal}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium text-xs shadow-lg shadow-cyan-500/25 transition-all active:scale-95"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Pair Devices</span>
            </button>
          )}

          {/* Local User Badge */}
          <div className="hidden lg:flex items-center gap-1.5 pl-2 border-l border-slate-800 text-xs text-slate-400">
            {getDeviceIcon(localPeer.deviceType)}
            <span className="font-medium text-slate-300 truncate max-w-[120px]">
              {localPeer.name}
            </span>
          </div>
        </div>
      </div>
    </header>
  )
}
