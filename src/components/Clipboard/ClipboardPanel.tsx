// Real-Time Shared Clipboard Feed & Broadcaster

import React, { useState } from 'react'
import {
  Clipboard,
  Copy,
  Check,
  Send,
  ExternalLink,
  Code,
  Link as LinkIcon,
  MessageSquare,
  Trash2,
} from 'lucide-react'
import { useAirStream } from '../../context/AirStreamContext'
import type { ClipboardItem } from '../../core/webrtc/types'

export const ClipboardPanel: React.FC = () => {
  const {
    clipboardHistory,
    broadcastClipboard,
    clearClipboard,
    connectionState,
    remotePeer,
  } = useAirStream()

  const [inputVal, setInputVal] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const isConnected = connectionState === 'connected'

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputVal.trim()) return
    broadcastClipboard(inputVal.trim())
    setInputVal('')
  }

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handlePasteFromOS = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        broadcastClipboard(text)
      }
    } catch {
      // Permission denied or not supported
    }
  }

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Clipboard className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">Live Clipboard</h3>
            <p className="text-xs text-slate-400">
              Instant sync of text, code, and links with{' '}
              {isConnected ? remotePeer?.name : 'connected peers'}
            </p>
          </div>
        </div>

        {clipboardHistory.length > 0 && (
          <button
            onClick={clearClipboard}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-rose-400 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Log</span>
          </button>
        )}
      </div>

      {/* Input composer */}
      <form onSubmit={handleSend} className="relative rounded-2xl glass-panel p-2">
        <textarea
          rows={3}
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          placeholder={
            isConnected
              ? 'Paste text, links, or code here to sync instantly...'
              : 'Pair devices to start live clipboard synchronization...'
          }
          className="w-full bg-transparent p-2 text-sm text-slate-100 placeholder-slate-500 outline-none resize-none font-mono"
        />

        <div className="flex items-center justify-between pt-2 border-t border-slate-800 px-1">
          <button
            type="button"
            onClick={handlePasteFromOS}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition-colors"
          >
            <Clipboard className="w-3.5 h-3.5 text-cyan-400" />
            <span>Paste from OS</span>
          </button>

          <button
            type="submit"
            disabled={!inputVal.trim() || !isConnected}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 text-xs font-bold transition-all shadow-md shadow-cyan-500/20 active:scale-95"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Broadcast</span>
          </button>
        </div>
      </form>

      {/* Synced Clipboard Feed */}
      <div className="space-y-3">
        {clipboardHistory.length === 0 ? (
          <div className="text-center py-10 rounded-2xl border border-dashed border-slate-800/80 text-slate-500 text-xs">
            No clipboard items yet. Copy or paste something above to share!
          </div>
        ) : (
          clipboardHistory.map((item) => (
            <ClipboardCard
              key={item.id}
              item={item}
              isCopied={copiedId === item.id}
              onCopy={() => handleCopy(item.id, item.text)}
            />
          ))
        )}
      </div>
    </div>
  )
}

interface ClipboardCardProps {
  item: ClipboardItem
  isCopied: boolean
  onCopy: () => void
}

const ClipboardCard: React.FC<ClipboardCardProps> = ({ item, isCopied, onCopy }) => {
  const getTypeBadge = () => {
    switch (item.type) {
      case 'url':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <LinkIcon className="w-3 h-3" />
            <span>Link</span>
          </span>
        )
      case 'code':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Code className="w-3 h-3" />
            <span>Code</span>
          </span>
        )
      default:
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400">
            <MessageSquare className="w-3 h-3" />
            <span>Text</span>
          </span>
        )
    }
  }

  return (
    <div className="rounded-2xl glass-panel p-4 space-y-3 transition-colors hover:border-slate-700">
      {/* Top Meta info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getTypeBadge()}
          <span className="text-xs font-semibold text-slate-300">{item.senderName}</span>
        </div>

        <div className="flex items-center gap-2">
          {item.type === 'url' && (
            <a
              href={item.text}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-cyan-400 transition-colors"
              title="Open Link"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}

          <button
            onClick={onCopy}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
              isCopied
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
            }`}
          >
            {isCopied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Content box */}
      <div className="rounded-xl bg-slate-900/90 border border-slate-800/80 p-3 overflow-x-auto">
        <pre className="text-xs text-slate-200 font-mono whitespace-pre-wrap break-words">
          {item.text}
        </pre>
      </div>

      <div className="text-[10px] text-slate-500 text-right">
        {new Date(item.timestamp).toLocaleTimeString()}
      </div>
    </div>
  )
}
