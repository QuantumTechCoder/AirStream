// White-Label Deployment Showcase Banner & Modal for Agencies & Startups (30 USDC)

import React, { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  Building2,
  Sparkles,
  ArrowRight,
  X,
  Mail,
  CheckCircle2,
  Copy,
  Check,
  Wallet,
  ShieldCheck,
} from 'lucide-react'
import {
  RECIPIENT_WALLET,
  NETWORKS,
  type SupportedChain,
  verifyOnChainPayment,
  saveProLicense,
} from '../../utils/paymentVerifier'
import confetti from 'canvas-confetti'

export const WhiteLabelBanner: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      {/* Eye-catching responsive banner */}
      <div className="relative overflow-hidden rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-indigo-950/60 via-slate-900/80 to-cyan-950/50 p-4 sm:p-5 shadow-xl transition-all hover:border-indigo-500/50">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-indigo-500 to-cyan-500 text-white shadow-lg shadow-indigo-500/25 shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-slate-100">
                  Custom White-Label Deployment for Teams &amp; Agencies
                </h4>
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  30 USDC
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Want AirStream deployed on your own domain (e.g. <span className="text-cyan-300 font-mono">transfer.yourcompany.com</span>) with your brand logo &amp; private TURN relays?
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-400 hover:to-cyan-400 text-slate-950 text-xs font-black shadow-lg shadow-indigo-500/25 transition-all active:scale-95 shrink-0"
          >
            <span>Get 24h Setup</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Modal */}
      {isOpen && <WhiteLabelModal onClose={() => setIsOpen(false)} />}
    </>
  )
}

const WhiteLabelModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [chain, setChain] = useState<SupportedChain>('base')
  const [copied, setCopied] = useState(false)
  const [txHashInput, setTxHashInput] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [verifiedSuccess, setVerifiedSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSendingWeb3, setIsSendingWeb3] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(RECIPIENT_WALLET)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const handleWeb3Pay = async () => {
    const ethereum = (window as any).ethereum
    if (!ethereum) {
      setErrorMessage('No Web3 wallet found (Rabby / MetaMask). Please send 30 USDC to the address below and submit your tx hash.')
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
      const rawUnits = BigInt(30 * 1e6) // 30 USDC
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
      setErrorMessage(err.message || 'Transaction rejected.')
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
      const result = await verifyOnChainPayment(targetHash, chain, 30)
      if (result.valid) {
        saveProLicense({
          active: true,
          txHash: targetHash,
          chain,
          verifiedAt: Date.now(),
          tier: 'white_label',
        })
        setVerifiedSuccess(true)
        confetti({
          particleCount: 120,
          spread: 90,
          origin: { y: 0.6 },
          colors: ['#6366f1', '#06b6d4', '#10b981'],
        })
      } else {
        setErrorMessage(result.error || 'Payment not verified on-chain. Minimum 30 USDC required.')
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Verification error occurred.')
    } finally {
      setIsVerifying(false)
    }
  }

  const emailSubject = encodeURIComponent('AirStream White-Label Deployment Order')
  const emailBody = encodeURIComponent(
    `Hi QuantumTechCoder,\n\nI want to deploy a White-Labeled AirStream portal for my team / agency.\n\nCompany Name:\nTarget Domain (e.g. transfer.mycompany.com):\nTx Hash (if paid): ${txHashInput || 'Paid via Rabby/MetaMask'}\nChain: ${NETWORKS[chain].name}\n\nLooking forward to the 24-hour setup!`
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl glass-panel-glow bg-[#0f172a] border border-indigo-500/30 shadow-2xl p-6 overflow-hidden max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="space-y-5">
          <div className="text-center space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Turnkey Enterprise Deployment</span>
            </div>
            <h3 className="text-2xl font-black bg-gradient-to-r from-indigo-400 via-sky-300 to-cyan-300 bg-clip-text text-transparent">
              White-Label AirStream
            </h3>
            <p className="text-xs text-slate-400">
              Deliver 100% private, client-ready file transfers without paying $20/month per seat.
            </p>
          </div>

          {verifiedSuccess ? (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-slate-100">Payment Verified on-chain!</h4>
              <p className="text-xs text-slate-300">
                Click below to send us your domain and branding details. Your custom portal will be delivered in 24 hours.
              </p>
              <a
                href={`mailto:quantumtechsperts@gmail.com?subject=${emailSubject}&body=${emailBody}`}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors"
              >
                <Mail className="w-4 h-4" />
                <span>Email Deployment Details</span>
              </a>
            </div>
          ) : (
            <>
              {/* Deliverables List */}
              <div className="space-y-2 p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs">
                <div className="flex items-center gap-2 text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Custom domain deployment (<code className="text-cyan-300">transfer.yourcompany.com</code>)</span>
                </div>
                <div className="flex items-center gap-2 text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Your custom branding, company logo, color palette &amp; favicon</span>
                </div>
                <div className="flex items-center gap-2 text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Private TURN relay deployment with zero rate limits or bandwidth throttling</span>
                </div>
                <div className="flex items-center gap-2 text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Full source code ownership &amp; 24-hour turnaround guarantee</span>
                </div>
              </div>

              {/* Price & Chain */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-gradient-to-r from-indigo-950/40 to-cyan-950/40 border border-indigo-500/20">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-mono">Turnkey Setup Fee</span>
                  <div className="text-xl font-black text-indigo-400">30 USDC</div>
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

              {/* Pay with Rabby/MetaMask */}
              <button
                onClick={handleWeb3Pay}
                disabled={isSendingWeb3}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-indigo-500 via-blue-600 to-cyan-500 hover:from-indigo-400 hover:to-cyan-400 text-white font-bold text-xs shadow-xl shadow-indigo-500/25 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
              >
                <Wallet className="w-4 h-4" />
                <span>{isSendingWeb3 ? 'Confirming in Wallet...' : `Pay 30 USDC with Rabby / MetaMask (${NETWORKS[chain].name})`}</span>
              </button>

              {/* Copy Address */}
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

              {/* Verify Tx Hash */}
              <div className="space-y-1.5 pt-1">
                <label className="block text-[11px] font-semibold text-slate-400">
                  Verify Transaction Hash:
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    placeholder="0x... (64-char transaction hash)"
                    value={txHashInput}
                    onChange={(e) => setTxHashInput(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 focus:border-indigo-500 text-xs font-mono text-slate-200 outline-none"
                  />
                  <button
                    onClick={() => handleVerify()}
                    disabled={isVerifying || !txHashInput.trim()}
                    className="px-3.5 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-xs transition-colors shrink-0 disabled:opacity-40"
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

              {/* Inquiries Mailbox */}
              <div className="pt-2 text-center text-xs text-slate-400">
                <span>Questions or custom architecture request? </span>
                <a
                  href={`mailto:quantumtechsperts@gmail.com?subject=${emailSubject}&body=${emailBody}`}
                  className="text-cyan-400 font-semibold hover:underline inline-flex items-center gap-1"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Email Developer</span>
                </a>
              </div>
            </>
          )}

          <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800/80">
            <div className="flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span>Direct On-Chain Verification &bull; Anti-Spoof Protection</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
