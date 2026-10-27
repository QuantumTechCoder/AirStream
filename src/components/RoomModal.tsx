// Modal for Pairing Devices, QR Codes, and Offline Signaling

import React, { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  X,
  Copy,
  Check,
  QrCode,
  ArrowRight,
  ShieldCheck,
  Cpu,
  WifiOff,
} from 'lucide-react'
import { useAirStream } from '../context/AirStreamContext'

interface RoomModalProps {
  isOpen: boolean
  onClose: () => void
}

export const RoomModal: React.FC<RoomModalProps> = ({ isOpen, onClose }) => {
  const {
    roomId,
    createRoom,
    joinRoom,
    connectionState,
    generateOfflineOffer,
    applyOfflineOffer,
    applyOfflineAnswer,
  } = useAirStream()

  const [activeTab, setActiveTab] = useState<'qr' | 'join' | 'offline'>('qr')
  const [joinInput, setJoinInput] = useState('')
  const [copiedLink, setCopiedLink] = useState(false)
  const [loading, setLoading] = useState(false)

  // Offline SDP states
  const [offlineStep, setOfflineStep] = useState<'offer' | 'answer'>('offer')
  const [offlineOffer, setOfflineOffer] = useState('')
  const [offlineAnswer, setOfflineAnswer] = useState('')
  const [copiedOffline, setCopiedOffline] = useState(false)

  if (!isOpen) return null

  const inviteUrl = roomId
    ? `${window.location.origin}${window.location.pathname}#room=${roomId}`
    : ''

  const handleCreateRoom = async () => {
    setLoading(true)
    try {
      await createRoom()
    } finally {
      setLoading(false)
    }
  }

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!joinInput.trim()) return

    setLoading(true)
    try {
      // If user pasted full URL with hash
      let code = joinInput.trim()
      if (code.includes('room=')) {
        const match = code.match(/room=([A-Za-z0-9_-]+)/)
        if (match && match[1]) {
          code = match[1]
        }
      }
      await joinRoom(code)
      onClose()
    } finally {
      setLoading(false)
    }
  }

  const handleCopyLink = () => {
    if (!inviteUrl) return
    navigator.clipboard.writeText(inviteUrl)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const handleGenerateOfflineOffer = async () => {
    setLoading(true)
    try {
      const offer = await generateOfflineOffer()
      setOfflineOffer(offer)
    } finally {
      setLoading(false)
    }
  }

  const handleApplyOfflineOffer = async () => {
    if (!offlineOffer.trim()) return
    setLoading(true)
    try {
      const answer = await applyOfflineOffer(offlineOffer.trim())
      setOfflineAnswer(answer)
    } finally {
      setLoading(false)
    }
  }

  const handleApplyOfflineAnswer = async () => {
    if (!offlineAnswer.trim()) return
    setLoading(true)
    try {
      await applyOfflineAnswer(offlineAnswer.trim())
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl glass-panel-glow bg-[#0f172a] border border-cyan-500/20 shadow-2xl p-6 overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-black bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-300 bg-clip-text text-transparent">
            Pair Devices
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Direct browser-to-browser encrypted WebRTC tunnel
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-3 gap-1 p-1 bg-slate-900/90 rounded-xl mb-6 border border-slate-800">
          <button
            onClick={() => setActiveTab('qr')}
            className={`flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'qr'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>QR & Share</span>
          </button>
          <button
            onClick={() => setActiveTab('join')}
            className={`flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'join'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ArrowRight className="w-3.5 h-3.5" />
            <span>Join Room</span>
          </button>
          <button
            onClick={() => setActiveTab('offline')}
            className={`flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'offline'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <WifiOff className="w-3.5 h-3.5" />
            <span>Air-Gapped</span>
          </button>
        </div>

        {/* Tab 1: QR & Share */}
        {activeTab === 'qr' && (
          <div className="flex flex-col items-center text-center space-y-4">
            {roomId ? (
              <>
                <div className="p-3 bg-white rounded-2xl shadow-xl shadow-cyan-500/10">
                  <QRCodeSVG
                    value={inviteUrl}
                    size={180}
                    level="M"
                    includeMargin={false}
                  />
                </div>

                <div className="space-y-1">
                  <div className="text-xs text-slate-400 uppercase tracking-widest font-mono">
                    Room Code
                  </div>
                  <div className="text-3xl font-black font-mono tracking-widest text-cyan-400">
                    {roomId}
                  </div>
                </div>

                {/* Link Box */}
                <div className="w-full flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800">
                  <input
                    type="text"
                    readOnly
                    value={inviteUrl}
                    className="w-full bg-transparent text-xs text-slate-300 font-mono px-2 outline-none select-all"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-colors shrink-0"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-slate-400 bg-slate-900/50 px-3 py-1.5 rounded-full border border-slate-800">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Scan with your phone camera or open the link on another device</span>
                </div>
              </>
            ) : (
              <div className="py-8 space-y-4">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <Cpu className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">
                    Start a New P2P Stream Room
                  </h3>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1">
                    Instantly create a room code and QR code for phone, tablet, or another laptop.
                  </p>
                </div>
                <button
                  onClick={handleCreateRoom}
                  disabled={loading}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-sm shadow-lg shadow-cyan-500/25 transition-all active:scale-95"
                >
                  {loading ? 'Generating Room...' : 'Create Instant Room'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Join Room */}
        {activeTab === 'join' && (
          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Enter Room Code or Invitation Link
              </label>
              <input
                type="text"
                placeholder="e.g. 7X9K2A or https://..."
                value={joinInput}
                onChange={(e) => setJoinInput(e.target.value)}
                autoFocus
                className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 focus:border-cyan-500 text-slate-100 placeholder-slate-500 font-mono text-center text-lg uppercase tracking-wider outline-none transition-all shadow-inner"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !joinInput.trim()}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-white font-bold text-sm shadow-lg shadow-cyan-500/25 transition-all flex items-center justify-center gap-2"
            >
              <span>Connect to Peer</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 space-y-1">
              <p className="font-semibold text-slate-300">How to connect:</p>
              <p>1. Open AirStream on Device A and click "Pair Devices".</p>
              <p>2. Copy the 6-character room code or share link.</p>
              <p>3. Enter it here on Device B to establish a direct WebRTC tunnel.</p>
            </div>
          </form>
        )}

        {/* Tab 3: Air-Gapped / Offline SDP */}
        {activeTab === 'offline' && (
          <div className="space-y-4 text-left">
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
              <WifiOff className="w-4 h-4 shrink-0" />
              <span>
                No internet? Connect two devices on the same local network or ad-hoc WiFi by manually swapping SDP tokens!
              </span>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOfflineStep('offer')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg ${
                  offlineStep === 'offer'
                    ? 'bg-slate-700 text-cyan-300 border border-cyan-500/30'
                    : 'bg-slate-900 text-slate-400'
                }`}
              >
                Device A (Host Offer)
              </button>
              <button
                type="button"
                onClick={() => setOfflineStep('answer')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg ${
                  offlineStep === 'answer'
                    ? 'bg-slate-700 text-cyan-300 border border-cyan-500/30'
                    : 'bg-slate-900 text-slate-400'
                }`}
              >
                Device B (Peer Answer)
              </button>
            </div>

            {offlineStep === 'offer' ? (
              <div className="space-y-3">
                <button
                  onClick={handleGenerateOfflineOffer}
                  disabled={loading}
                  className="w-full py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs transition-colors"
                >
                  {loading ? 'Generating...' : '1. Generate SDP Offer Token'}
                </button>

                {offlineOffer && (
                  <div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                      <span>Copy this token to Device B:</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(offlineOffer)
                          setCopiedOffline(true)
                          setTimeout(() => setCopiedOffline(false), 2000)
                        }}
                        className="text-cyan-400 hover:underline flex items-center gap-1"
                      >
                        {copiedOffline ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedOffline ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                    <textarea
                      readOnly
                      rows={3}
                      value={offlineOffer}
                      className="w-full p-2 bg-slate-900 border border-slate-800 rounded-lg text-[10px] font-mono text-slate-300 select-all"
                    />
                  </div>
                )}

                <div className="pt-2">
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Paste Answer Token received from Device B:
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Paste Device B answer here..."
                    value={offlineAnswer}
                    onChange={(e) => setOfflineAnswer(e.target.value)}
                    className="w-full p-2 bg-slate-900 border border-slate-800 rounded-lg text-[10px] font-mono text-slate-300"
                  />
                  <button
                    onClick={handleApplyOfflineAnswer}
                    disabled={!offlineAnswer.trim() || loading}
                    className="w-full mt-2 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs"
                  >
                    Complete Connection
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="block text-[11px] text-slate-400">
                  Paste Device A's Offer Token here:
                </label>
                <textarea
                  rows={3}
                  placeholder="Paste Offer from Device A..."
                  value={offlineOffer}
                  onChange={(e) => setOfflineOffer(e.target.value)}
                  className="w-full p-2 bg-slate-900 border border-slate-800 rounded-lg text-[10px] font-mono text-slate-300"
                />
                <button
                  onClick={handleApplyOfflineOffer}
                  disabled={!offlineOffer.trim() || loading}
                  className="w-full py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-medium text-xs"
                >
                  Generate Answer Token
                </button>

                {offlineAnswer && (
                  <div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                      <span>Send this Answer Token back to Device A:</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(offlineAnswer)
                          setCopiedOffline(true)
                          setTimeout(() => setCopiedOffline(false), 2000)
                        }}
                        className="text-cyan-400 hover:underline flex items-center gap-1"
                      >
                        {copiedOffline ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedOffline ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                    <textarea
                      readOnly
                      rows={3}
                      value={offlineAnswer}
                      className="w-full p-2 bg-slate-900 border border-slate-800 rounded-lg text-[10px] font-mono text-slate-300 select-all"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Current status footer */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
          <span>Connection Status:</span>
          <span
            className={`font-semibold capitalize ${
              connectionState === 'connected'
                ? 'text-emerald-400'
                : connectionState === 'pairing'
                ? 'text-amber-400'
                : 'text-slate-400'
            }`}
          >
            {connectionState}
          </span>
        </div>
      </div>
    </div>
  )
}
