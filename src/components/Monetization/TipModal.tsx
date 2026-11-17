// Non-Intrusive Tip & Support Modal for AirStream (Base & Polygon USDC)
// Allows 1-click Web3 tipping via Rabby/MetaMask or QR code / address copy with on-chain verification

import React, { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  X,
  Copy,
  Check,
  Heart,
  Wallet,
  ExternalLink,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import confetti from 'canvas-confetti'
import {
  RECIPIENT_WALLET,
  NETWORKS,
  type SupportedChain,
  verifyOnChainPayment,
} from '../../utils/paymentVerifier'

interface TipModalProps {
  isOpen: boolean
  onClose: () => void
  defaultAmount?: number
}

export const TipModal: React.FC<TipModalProps> = ({ isOpen, onClose, defaultAmount = 2 }) => {
  const [chain, setChain] = useState<SupportedChain>('base')
  const [amount, setAmount] = useState<number>(defaultAmount)
  const [copied, setCopied] = useState(false)
  const [txHashInput, setTxHashInput] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [verifiedSuccess, setVerifiedSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSendingWeb3, setIsSendingWeb3] = useState(false)

  if (!isOpen) return null

  const handleCopy = () => {
    navigator.clipboard.writeText(RECIPIENT_WALLET)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  // 1-Click Send with Injected Web3 Wallet (Rabby, MetaMask, Coinbase)
  const handleWeb3Pay = async () => {
    const ethereum = (window as any).ethereum
    if (!ethereum) {
      setErrorMessage('No Web3 wallet detected (e.g. Rabby or MetaMask). Please copy the address below to send from your wallet or exchange.')
      return
    }

    setErrorMessage(null)
    setIsSendingWeb3(true)

    try {
      // 1. Request accounts
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' })
      const from = accounts[0]
      const targetNetwork = NETWORKS[chain]

      // 2. Switch or add chain
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

      // 3. Prepare ERC-20 transfer call for USDC
      // transfer(address,uint256) method signature: 0xa9059cbb
      const cleanTo = RECIPIENT_WALLET.toLowerCase().replace('0x', '')
      const paddedTo = cleanTo.padStart(64, '0')
      const rawUnits = BigInt(Math.round(amount * 1e6))
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
        // Automatically verify
        await handleVerifyHash(hash)
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Transaction was cancelled or failed.')
    } finally {
      setIsSendingWeb3(false)
    }
  }

  // Zero-Trust On-Chain Verification
  const handleVerifyHash = async (hashToVerify?: string) => {
    const targetHash = (hashToVerify || txHashInput).trim()
    if (!targetHash) {
      setErrorMessage('Please enter a transaction hash to verify.')
      return
    }

    setErrorMessage(null)
    setIsVerifying(true)

    try {
      const result = await verifyOnChainPayment(targetHash, chain, amount > 0 ? 0.5 : 0.1)
      if (result.valid) {
        setVerifiedSuccess(true)
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#00f0ff', '#8b5cf6', '#10b981'],
        })
      } else {
        setErrorMessage(result.error || 'Transaction verification failed.')
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Verification error. Please retry.')
    } finally {
      setIsVerifying(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-3xl glass-panel-glow bg-[#0f172a] border border-cyan-500/30 shadow-2xl p-6 overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {verifiedSuccess ? (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Sparkles className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-100">Thank You So Much!</h3>
              <p className="text-xs text-slate-300 mt-1 max-w-xs mx-auto">
                Your on-chain contribution on {NETWORKS[chain].name} keeps AirStream 100% free, fast, and open-source for everyone worldwide.
              </p>
            </div>
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-emerald-500/20"
            >
              Back to AirStream
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Header */}
            <div className="text-center space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/30 text-pink-400 text-xs font-semibold">
                <Heart className="w-3.5 h-3.5 fill-pink-500 text-pink-500" />
                <span>Fuel the Developer</span>
              </div>
              <h3 className="text-xl font-black bg-gradient-to-r from-pink-400 via-purple-300 to-cyan-300 bg-clip-text text-transparent">
                Tip with USDC
              </h3>
              <p className="text-xs text-slate-400">
                AirStream saves hours and cloud fees. Tip a few USDC on Base or Polygon!
              </p>
            </div>

            {/* Network Selector */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-900 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setChain('base')}
                className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                  chain === 'base'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                🔵 Base (Gas &lt; $0.01)
              </button>
              <button
                type="button"
                onClick={() => setChain('polygon')}
                className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                  chain === 'polygon'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                🟣 Polygon (Gas &lt; $0.01)
              </button>
            </div>

            {/* Amount Presets */}
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 5, 10].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setAmount(amt)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition-all ${
                    amount === amt
                      ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/25'
                      : 'bg-slate-900 border border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  {amt} USDC
                </button>
              ))}
            </div>

            {/* 1-Click Web3 Send Button */}
            <button
              onClick={handleWeb3Pay}
              disabled={isSendingWeb3}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs shadow-xl shadow-cyan-500/25 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
            >
              <Wallet className="w-4 h-4" />
              <span>{isSendingWeb3 ? 'Confirm in Wallet...' : `Send ${amount} USDC with Rabby / MetaMask`}</span>
            </button>

            {/* QR Code & Direct Copy Box */}
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-900/90 border border-slate-800">
              <div className="p-1.5 bg-white rounded-xl shrink-0">
                <QRCodeSVG value={RECIPIENT_WALLET} size={64} level="M" />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">
                  Developer EVM Address ({NETWORKS[chain].name})
                </div>
                <div className="text-xs font-mono font-semibold text-slate-200 truncate select-all">
                  {RECIPIENT_WALLET}
                </div>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-[11px] text-cyan-400 hover:underline font-medium"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Address Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy Address</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Manual Tx Hash Verification */}
            <div className="space-y-1.5 pt-1">
              <label className="block text-[11px] font-semibold text-slate-400">
                Sent from an exchange or external app? Verify Tx Hash:
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
                  onClick={() => handleVerifyHash()}
                  disabled={isVerifying || !txHashInput.trim()}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs font-bold text-slate-200 transition-colors shrink-0"
                >
                  {isVerifying ? 'Checking...' : 'Verify'}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                {errorMessage}
              </div>
            )}

            {/* Trust Footer */}
            <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800/80">
              <div className="flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                <span>Zero-Trust On-Chain Verification</span>
              </div>
              <a
                href={`${NETWORKS[chain].explorerUrl}/address/${RECIPIENT_WALLET}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 hover:text-cyan-400"
              >
                <span>View on Explorer</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
