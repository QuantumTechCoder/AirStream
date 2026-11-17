// Firewall-Bypass TURN Relay Pro Pass Modal (5 USDC Lifetime / Month)
// Unlocks custom TURN credentials and high-bandwidth priority relay routing with on-chain verification

import React, { useState, useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  X,
  Copy,
  Check,
  Shield,
  Zap,
  Lock,
  Wallet,
  Server,
  ExternalLink,
  Sparkles,
} from 'lucide-react'
import confetti from 'canvas-confetti'
import {
  RECIPIENT_WALLET,
  NETWORKS,
  type SupportedChain,
  verifyOnChainPayment,
  getSavedProLicense,
  saveProLicense,
} from '../../utils/paymentVerifier'

interface TurnPassModalProps {
  isOpen: boolean
  onClose: () => void
  onUnlocked: () => void
}

export const TurnPassModal: React.FC<TurnPassModalProps> = ({ isOpen, onClose, onUnlocked }) => {
  const [chain, setChain] = useState<SupportedChain>('base')
  const [copied, setCopied] = useState(false)
  const [txHashInput, setTxHashInput] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSendingWeb3, setIsSendingWeb3] = useState(false)

  // Custom TURN inputs
  const [customServer, setCustomServer] = useState('')
  const [customUsername, setCustomUsername] = useState('')
  const [customCredential, setCustomCredential] = useState('')
  const [customSaved, setCustomSaved] = useState(false)

  useEffect(() => {
    const saved = getSavedProLicense()
    if (saved && saved.active) {
      setIsUnlocked(true)
    }

    const savedTurn = localStorage.getItem('airstream_custom_turn')
    if (savedTurn) {
      try {
        const parsed = JSON.parse(savedTurn)
        setCustomServer(parsed.server || '')
        setCustomUsername(parsed.username || '')
        setCustomCredential(parsed.credential || '')
      } catch {
        // ignore
      }
    }
  }, [])

  if (!isOpen) return null

  const handleCopy = () => {
    navigator.clipboard.writeText(RECIPIENT_WALLET)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const handleWeb3Pay = async () => {
    const ethereum = (window as any).ethereum
    if (!ethereum) {
      setErrorMessage('No Web3 wallet found (Rabby / MetaMask). Please send 5 USDC to the address below and verify the transaction hash.')
      return
    }

    setErrorMessage(null)
    setIsSendingWeb3(true)

    try {
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' })
      const from = accounts[0]
      const targetNetwork = NETWORKS[chain]

      try {
        await ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: targetNetwork.chainIdHex }],
        })
      } catch (switchError: any) {
        if (switchError.code === 4902) {
          await ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: targetNetwork.chainIdHex,
                chainName: targetNetwork.name,
                rpcUrls: targetNetwork.rpcUrls,
                blockExplorerUrls: [targetNetwork.explorerUrl],
              },
            ],
          })
        } else {
          throw switchError
        }
      }

      const cleanTo = RECIPIENT_WALLET.toLowerCase().replace('0x', '')
      const paddedTo = cleanTo.padStart(64, '0')
      const rawUnits = BigInt(5 * 1e6) // 5 USDC
      const paddedAmount = rawUnits.toString(16).padStart(64, '0')
      const data = `0xa9059cbb${paddedTo}${paddedAmount}`

      const txParams = {
        from,
        to: targetNetwork.usdcAddress,
        data,
      }

      const hash = await ethereum.request({
        method: 'eth_sendTransaction',
        params: [txParams],
      })

      if (hash) {
        setTxHashInput(hash)
        await handleVerify(hash)
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Transaction was rejected or failed.')
    } finally {
      setIsSendingWeb3(false)
    }
  }

  const handleVerify = async (hash?: string) => {
    const targetHash = (hash || txHashInput).trim()
    if (!targetHash) {
      setErrorMessage('Please enter transaction hash.')
      return
    }

    setErrorMessage(null)
    setIsVerifying(true)

    try {
      const result = await verifyOnChainPayment(targetHash, chain, 5)
      if (result.valid) {
        saveProLicense({
          active: true,
          txHash: targetHash,
          chain,
          verifiedAt: Date.now(),
          tier: 'turn_pass',
        })
        setIsUnlocked(true)
        onUnlocked()
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#00f0ff', '#a855f7', '#10b981'],
        })
      } else {
        setErrorMessage(result.error || 'Payment not verified on-chain. Minimum 5 USDC required.')
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Verification error occurred.')
    } finally {
      setIsVerifying(false)
    }
  }

  const handleSaveCustomTurn = (e: React.FormEvent) => {
    e.preventDefault()
    localStorage.setItem(
      'airstream_custom_turn',
      JSON.stringify({
        server: customServer.trim(),
        username: customUsername.trim(),
        credential: customCredential.trim(),
      })
    )
    setCustomSaved(true)
    setTimeout(() => setCustomSaved(false), 2000)
    onUnlocked()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl glass-panel-glow bg-[#0f172a] border border-cyan-500/30 shadow-2xl p-6 overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="space-y-5">
          {/* Header */}
          <div className="text-center space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold">
              <Shield className="w-3.5 h-3.5 text-cyan-400" />
              <span>Firewall-Bypass Relay Pro Pass</span>
            </div>
            <h3 className="text-xl font-black bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-300 bg-clip-text text-transparent">
              Guaranteed P2P on Strict Firewalls
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Behind an aggressive university firewall, corporate proxy, or symmetric mobile NAT? Unlock dedicated TURN relays & custom server slots.
            </p>
          </div>

          {isUnlocked ? (
            <div className="space-y-4">
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-emerald-300">Pro License Active & Verified</h4>
                  <p className="text-[11px] text-slate-300">
                    High-bandwidth priority TURN relays and custom server configurations are enabled.
                  </p>
                </div>
              </div>

              {/* Custom TURN Server Configuration */}
              <form onSubmit={handleSaveCustomTurn} className="space-y-3 p-4 rounded-2xl bg-slate-900 border border-slate-800">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                  <Server className="w-4 h-4 text-cyan-400" />
                  <span>Configure Private / Enterprise TURN Server</span>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    TURN Server URL (e.g. turn:turn.mycompany.com:443 or coturn)
                  </label>
                  <input
                    type="text"
                    placeholder="turn:turn.mycompany.com:443?transport=tcp"
                    value={customServer}
                    onChange={(e) => setCustomServer(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">Username</label>
                    <input
                      type="text"
                      placeholder="turn-user"
                      value={customUsername}
                      onChange={(e) => setCustomUsername(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">Credential / Password</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={customCredential}
                      onChange={(e) => setCustomCredential(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  {customSaved ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Saved & Applied!</span>
                    </>
                  ) : (
                    <span>Save Custom Credentials</span>
                  )}
                </button>
              </form>

              <button
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors"
              >
                Close
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Features Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start gap-2">
                  <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-slate-200 block">Firewall Penetration</span>
                    <span className="text-[11px] text-slate-400">Port 443 TCP fallback bypassing restrictive DPI filters.</span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start gap-2">
                  <Lock className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-slate-200 block">Enterprise Custom TURN</span>
                    <span className="text-[11px] text-slate-400">Plug in your own Twilio, Metered, or private coturn.</span>
                  </div>
                </div>
              </div>

              {/* Price Tag */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-gradient-to-r from-cyan-950/40 to-blue-950/40 border border-cyan-500/20">
                <div>
                  <span className="text-xs text-slate-400 uppercase font-mono">One-Time Lifetime Access</span>
                  <div className="text-xl font-black text-cyan-400">5 USDC</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setChain('base')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                      chain === 'base' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    Base
                  </button>
                  <button
                    onClick={() => setChain('polygon')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                      chain === 'polygon' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    Polygon
                  </button>
                </div>
              </div>

              {/* 1-Click Web3 Send */}
              <button
                onClick={handleWeb3Pay}
                disabled={isSendingWeb3}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs shadow-xl shadow-cyan-500/25 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
              >
                <Wallet className="w-4 h-4" />
                <span>{isSendingWeb3 ? 'Confirm in Wallet...' : `Pay 5 USDC with Rabby / MetaMask (${NETWORKS[chain].name})`}</span>
              </button>

              {/* QR Code & Direct Copy Box */}
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-900/90 border border-slate-800">
                <div className="p-1.5 bg-white rounded-xl shrink-0">
                  <QRCodeSVG value={RECIPIENT_WALLET} size={64} level="M" />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">
                    Recipient Address ({NETWORKS[chain].name})
                  </div>
                  <div className="text-xs font-mono font-semibold text-slate-200 truncate select-all">
                    {RECIPIENT_WALLET}
                  </div>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 text-[11px] text-cyan-400 hover:underline font-medium"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? 'Copied' : 'Copy Address'}</span>
                  </button>
                </div>
              </div>

              {/* Verification input */}
              <div className="space-y-1.5 pt-1">
                <label className="block text-[11px] font-semibold text-slate-400">
                  Paid externally? Enter Transaction Hash to unlock:
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    placeholder="0x... (64-char transaction hash)"
                    value={txHashInput}
                    onChange={(e) => setTxHashInput(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 focus:border-cyan-500 text-xs font-mono text-slate-200 outline-none"
                  />
                  <button
                    onClick={() => handleVerify()}
                    disabled={isVerifying || !txHashInput.trim()}
                    className="px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-colors shrink-0 disabled:opacity-40"
                  >
                    {isVerifying ? 'Verifying...' : 'Verify'}
                  </button>
                </div>
              </div>

              {errorMessage && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                  {errorMessage}
                </div>
              )}

              <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800/80">
                <span>Zero-Trust Cryptographic Verification</span>
                <a
                  href={`${NETWORKS[chain].explorerUrl}/address/${RECIPIENT_WALLET}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 hover:text-cyan-400"
                >
                  <span>View Contract</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
