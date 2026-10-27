// Transfer Queue List with Real-Time Speed, ETA, and Controls

import React from 'react'
import {
  FileText,
  FileArchive,
  FileVideo,
  FileAudio,
  FileImage,
  FileCode,
  File as FileGeneric,
  ArrowUpRight,
  ArrowDownLeft,
  Pause,
  Play,
  XCircle,
  Download,
  CheckCircle2,
  AlertCircle,
  Trash2,
} from 'lucide-react'
import { useAirStream } from '../../context/AirStreamContext'
import { formatBytes, formatDuration, formatSpeed } from '../../utils/device'
import type { TransferItem } from '../../core/webrtc/types'

export const TransferList: React.FC = () => {
  const {
    transfers,
    pauseTransfer,
    resumeTransfer,
    cancelTransfer,
    clearTransfers,
  } = useAirStream()

  if (transfers.length === 0) return null

  const getFileIcon = (name: string, type: string) => {
    const ext = name.split('.').pop()?.toLowerCase() || ''

    if (type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) {
      return <FileImage className="w-6 h-6 text-pink-400" />
    }
    if (type.startsWith('video/') || ['mp4', 'mkv', 'avi', 'mov', 'webm'].includes(ext)) {
      return <FileVideo className="w-6 h-6 text-purple-400" />
    }
    if (type.startsWith('audio/') || ['mp3', 'wav', 'flac', 'aac', 'ogg'].includes(ext)) {
      return <FileAudio className="w-6 h-6 text-amber-400" />
    }
    if (['zip', 'rar', '7z', 'tar', 'gz', 'iso'].includes(ext)) {
      return <FileArchive className="w-6 h-6 text-yellow-400" />
    }
    if (['js', 'ts', 'jsx', 'tsx', 'py', 'html', 'css', 'json', 'cpp', 'rs'].includes(ext)) {
      return <FileCode className="w-6 h-6 text-cyan-400" />
    }
    if (type.startsWith('text/') || ['pdf', 'txt', 'md', 'doc', 'docx'].includes(ext)) {
      return <FileText className="w-6 h-6 text-blue-400" />
    }
    return <FileGeneric className="w-6 h-6 text-slate-400" />
  }

  const hasCompleted = transfers.some(
    (t) => t.status === 'completed' || t.status === 'cancelled' || t.status === 'failed'
  )

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <span>Active Streams</span>
          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-xs text-cyan-400 font-mono">
            {transfers.length}
          </span>
        </h3>

        {hasCompleted && (
          <button
            onClick={clearTransfers}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-rose-400 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Completed</span>
          </button>
        )}
      </div>

      <div className="space-y-3">
        {transfers.map((item) => (
          <TransferCard
            key={item.id}
            item={item}
            getFileIcon={getFileIcon}
            onPause={() => pauseTransfer(item.id)}
            onResume={() => resumeTransfer(item.id)}
            onCancel={() => cancelTransfer(item.id)}
          />
        ))}
      </div>
    </div>
  )
}

interface TransferCardProps {
  item: TransferItem
  getFileIcon: (name: string, type: string) => React.ReactNode
  onPause: () => void
  onResume: () => void
  onCancel: () => void
}

const TransferCard: React.FC<TransferCardProps> = ({
  item,
  getFileIcon,
  onPause,
  onResume,
  onCancel,
}) => {
  return (
    <div className="relative overflow-hidden rounded-2xl glass-panel p-4 transition-all duration-200 hover:border-slate-700">
      {/* Background Subtle Progress Fill */}
      <div
        className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-indigo-500/10 pointer-events-none transition-all duration-300"
        style={{ width: `${item.progress}%` }}
      />

      <div className="relative flex items-center justify-between gap-4">
        {/* File Icon & Info */}
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          <div className="relative flex items-center justify-center w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 shrink-0">
            {getFileIcon(item.name, item.type)}
            {/* Direction badge */}
            <span
              className={`absolute -bottom-1 -right-1 p-0.5 rounded-full text-slate-950 ${
                item.isSender ? 'bg-cyan-400' : 'bg-emerald-400'
              }`}
              title={item.isSender ? 'Outgoing' : 'Incoming'}
            >
              {item.isSender ? (
                <ArrowUpRight className="w-3 h-3 stroke-[3]" />
              ) : (
                <ArrowDownLeft className="w-3 h-3 stroke-[3]" />
              )}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-slate-100 truncate" title={item.name}>
                {item.name}
              </h4>
              {item.status === 'completed' && (
                <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Done</span>
                </span>
              )}
              {item.status === 'failed' && (
                <span className="flex items-center gap-1 text-[11px] font-medium text-rose-400 shrink-0">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Failed</span>
                </span>
              )}
            </div>

            {/* Metrics Row */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 mt-1 font-mono">
              <span>
                {formatBytes(item.bytesTransferred)} / {formatBytes(item.size)}
              </span>

              {item.status === 'transferring' && (
                <>
                  <span className="text-slate-600">•</span>
                  <span className="text-cyan-400 font-bold">
                    {formatSpeed(item.speedMBps * 1024 * 1024)}
                  </span>
                  <span className="text-slate-600">•</span>
                  <span>ETA: {formatDuration(item.etaSeconds)}</span>
                </>
              )}

              {item.status === 'paused' && (
                <>
                  <span className="text-slate-600">•</span>
                  <span className="text-amber-400">Paused</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Progress Percentage & Controls */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <span className="text-lg font-black font-mono text-slate-200">
              {item.progress}%
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5">
            {item.status === 'transferring' && item.isSender && (
              <button
                onClick={onPause}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                title="Pause Transfer"
              >
                <Pause className="w-4 h-4" />
              </button>
            )}

            {item.status === 'paused' && item.isSender && (
              <button
                onClick={onResume}
                className="p-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 transition-colors"
                title="Resume Transfer"
              >
                <Play className="w-4 h-4" />
              </button>
            )}

            {(item.status === 'transferring' || item.status === 'paused') && (
              <button
                onClick={onCancel}
                className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
                title="Cancel Transfer"
              >
                <XCircle className="w-4 h-4" />
              </button>
            )}

            {item.status === 'completed' && !item.isSender && item.downloadUrl && (
              <a
                href={item.downloadUrl}
                download={item.name}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-md shadow-emerald-500/20 transition-all active:scale-95"
              >
                <Download className="w-4 h-4" />
                <span>Save</span>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Progress Bar Line */}
      <div className="relative w-full h-1.5 bg-slate-800 rounded-full mt-3 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            item.status === 'completed'
              ? 'bg-emerald-400 shadow-sm shadow-emerald-500/50'
              : item.status === 'failed' || item.status === 'cancelled'
              ? 'bg-rose-500'
              : item.status === 'paused'
              ? 'bg-amber-400'
              : 'bg-gradient-to-r from-cyan-400 to-blue-500'
          }`}
          style={{ width: `${item.progress}%` }}
        />
      </div>
    </div>
  )
}
