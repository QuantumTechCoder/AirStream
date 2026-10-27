// Main AirStream Application Layout

import React, { useState } from 'react'
import {
  FileUp,
  Clipboard,
  Code2,
  Activity,
  Layers,
  Shield,
  Zap,
} from 'lucide-react'
import { Header } from './components/Header'
import { RoomModal } from './components/RoomModal'
import { FileDropZone } from './components/FileTransfer/FileDropZone'
import { TransferList } from './components/FileTransfer/TransferList'
import { ClipboardPanel } from './components/Clipboard/ClipboardPanel'
import { CodeEditorPanel } from './components/Workspace/CodeEditorPanel'
import { InstallBanner } from './components/PWA/InstallBanner'
import { useAirStream } from './context/AirStreamContext'
import { formatBytes } from './utils/device'

export const AppContent: React.FC = () => {
  const {
    connectionState,
    networkStats,
    transfers,
    clipboardHistory,
  } = useAirStream()

  const [activeTab, setActiveTab] = useState<'files' | 'clipboard' | 'workspace'>('files')
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false)

  const activeTransfersCount = transfers.filter(
    (t) => t.status === 'transferring' || t.status === 'paused'
  ).length

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Navigation Header */}
      <Header onOpenRoomModal={() => setIsRoomModalOpen(true)} />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Disconnected Hero Banner */}
        {connectionState === 'idle' && (
          <div className="relative overflow-hidden rounded-3xl border border-cyan-500/20 bg-gradient-to-r from-cyan-950/40 via-blue-950/20 to-indigo-950/30 p-6 sm:p-8 shadow-2xl">
            <div className="relative z-10 max-w-3xl space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold">
                <Zap className="w-3.5 h-3.5 text-cyan-400" />
                <span>Next-Gen WebRTC Peer-to-Peer</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
                Stream Gigabytes in Seconds.{' '}
                <span className="bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-300 bg-clip-text text-transparent">
                  Zero Cloud. Zero Limits.
                </span>
              </h1>
              <p className="text-sm sm:text-base text-slate-300">
                Direct browser-to-browser encrypted file transfers at local Wi-Fi speeds, real-time
                shared clipboard, and collaborative code workspace. No accounts, no uploads to slow
                servers.
              </p>
              <div className="pt-2">
                <button
                  onClick={() => setIsRoomModalOpen(true)}
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-cyan-500/25 transition-all active:scale-95 flex items-center gap-2"
                >
                  <Layers className="w-4 h-4" />
                  <span>Start Streaming Now</span>
                </button>
              </div>
            </div>
            {/* Ambient Background Grid Decor */}
            <div className="absolute right-0 top-0 -bottom-10 w-96 bg-gradient-to-l from-cyan-500/10 to-transparent pointer-events-none rounded-full blur-3xl" />
          </div>
        )}

        {/* Feature Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            {/* Tab: Files */}
            <button
              onClick={() => setActiveTab('files')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                activeTab === 'files'
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-lg shadow-cyan-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <FileUp className="w-4 h-4" />
              <span>File Stream</span>
              {activeTransfersCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-cyan-400 text-slate-950 text-[10px] font-mono font-bold animate-pulse">
                  {activeTransfersCount}
                </span>
              )}
            </button>

            {/* Tab: Live Clipboard */}
            <button
              onClick={() => setActiveTab('clipboard')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                activeTab === 'clipboard'
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-lg shadow-cyan-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Clipboard className="w-4 h-4" />
              <span>Live Clipboard</span>
              {clipboardHistory.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 text-[10px] font-mono">
                  {clipboardHistory.length}
                </span>
              )}
            </button>

            {/* Tab: Collaborative Workspace */}
            <button
              onClick={() => setActiveTab('workspace')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                activeTab === 'workspace'
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-lg shadow-cyan-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Code2 className="w-4 h-4" />
              <span>Code Workspace</span>
            </button>
          </div>

          {/* Quick Connect trigger if not connected */}
          {connectionState !== 'connected' && (
            <button
              onClick={() => setIsRoomModalOpen(true)}
              className="text-xs font-semibold text-cyan-400 hover:underline flex items-center gap-1"
            >
              <span>Pair Devices</span>
              <span>&rarr;</span>
            </button>
          )}
        </div>

        {/* Tab Views */}
        <div className="space-y-6">
          {activeTab === 'files' && (
            <div className="space-y-6">
              <FileDropZone onOpenRoomModal={() => setIsRoomModalOpen(true)} />
              <TransferList />
            </div>
          )}

          {activeTab === 'clipboard' && <ClipboardPanel />}

          {activeTab === 'workspace' && <CodeEditorPanel />}
        </div>

        {/* Real-time Diagnostics & Network Info */}
        <div className="rounded-2xl glass-panel p-4 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span className="font-semibold text-slate-300">WebRTC Tunnel:</span>
              <span className="capitalize font-mono text-cyan-400">{connectionState}</span>
            </div>

            {connectionState === 'connected' && (
              <>
                <span className="text-slate-700">|</span>
                <div className="flex items-center gap-1.5 font-mono">
                  <span>Routing:</span>
                  <span className="text-slate-200 font-bold uppercase">
                    {networkStats.connectionType === 'local'
                      ? 'Direct LAN (Local Network)'
                      : networkStats.connectionType === 'stun'
                      ? 'Direct P2P (NAT Punch)'
                      : 'WebRTC Relay'}
                  </span>
                </div>
                <span className="text-slate-700">|</span>
                <div className="flex items-center gap-1 font-mono">
                  <span>RTT Latency:</span>
                  <span className="text-emerald-400 font-bold">
                    {networkStats.rttMs > 0 ? `${networkStats.rttMs} ms` : '< 5 ms'}
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-4 font-mono text-[11px]">
            <span>Sent: {formatBytes(networkStats.bytesSent)}</span>
            <span>Received: {formatBytes(networkStats.bytesReceived)}</span>
            <div className="flex items-center gap-1 text-slate-500">
              <Shield className="w-3.5 h-3.5 text-cyan-500/80" />
              <span>DTLS-SRTP 256-bit</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/60 bg-[#090d16] py-4 px-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>
            AirStream &bull; Direct Peer-to-Peer File Transfer &amp; Workspace powered by WebRTC
            RTCDataChannel &amp; Cloudflare Pages Functions.
          </p>
          <div className="flex items-center gap-3">
            <span className="text-slate-400">Zero Cloud Storage</span>
            <span>&bull;</span>
            <span className="text-slate-400">PWA Ready</span>
            <span>&bull;</span>
            <span className="text-slate-400">Unlimited Size</span>
          </div>
        </div>
      </footer>

      {/* Room Modal */}
      <RoomModal isOpen={isRoomModalOpen} onClose={() => setIsRoomModalOpen(false)} />

      {/* PWA Install Banner */}
      <InstallBanner />
    </div>
  )
}

export default function App() {
  return <AppContent />
}
