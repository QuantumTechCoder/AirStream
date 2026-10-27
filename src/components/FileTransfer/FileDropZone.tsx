// Interactive Drag & Drop Zone for Direct WebRTC Streaming

import React, { useState, useRef } from 'react'
import {
  UploadCloud,
  FileCheck2,
  FolderUp,
  Infinity as InfinityIcon,
  Zap,
  Lock,
} from 'lucide-react'
import { useAirStream } from '../../context/AirStreamContext'

interface FileDropZoneProps {
  onOpenRoomModal: () => void
}

export const FileDropZone: React.FC<FileDropZoneProps> = ({ onOpenRoomModal }) => {
  const { connectionState, sendFiles, remotePeer } = useAirStream()
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isConnected = connectionState === 'connected'

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isDragOver) setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    if (!isConnected) {
      onOpenRoomModal()
      return
    }

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await sendFiles(e.dataTransfer.files)
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      if (!isConnected) {
        onOpenRoomModal()
        return
      }
      await sendFiles(e.target.files)
      // reset so same files can be re-selected
      e.target.value = ''
    }
  }

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => {
          if (!isConnected) {
            onOpenRoomModal()
          } else {
            fileInputRef.current?.click()
          }
        }}
        className={`relative group cursor-pointer overflow-hidden rounded-3xl border-2 border-dashed transition-all duration-300 p-8 sm:p-12 text-center flex flex-col items-center justify-center min-h-[260px] ${
          isDragOver
            ? 'border-cyan-400 bg-cyan-950/30 scale-[1.01] shadow-2xl shadow-cyan-500/20'
            : isConnected
            ? 'border-slate-700/80 hover:border-cyan-500/50 bg-slate-900/40 hover:bg-slate-900/60 shadow-xl'
            : 'border-slate-800/80 hover:border-slate-700 bg-slate-900/20'
        }`}
      >
        {/* Ambient background glow */}
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 via-transparent to-transparent pointer-events-none" />

        {/* Radar Rings on drag or connected */}
        <div className="relative mb-6">
          <div
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-transform duration-500 group-hover:scale-110 ${
              isConnected
                ? 'bg-gradient-to-tr from-cyan-500 to-blue-600 shadow-xl shadow-cyan-500/25 text-white'
                : 'bg-slate-800 border border-slate-700 text-slate-400'
            }`}
          >
            {isConnected ? (
              <UploadCloud className="w-10 h-10 animate-bounce" />
            ) : (
              <FolderUp className="w-10 h-10" />
            )}
          </div>

          {/* Pulse animation when connected */}
          {isConnected && (
            <div className="absolute -inset-2 rounded-full border border-cyan-500/40 animate-ping pointer-events-none" />
          )}
        </div>

        {/* Primary Call to Action */}
        <div className="space-y-2 max-w-md">
          {isConnected ? (
            <>
              <h3 className="text-xl font-bold text-slate-100 group-hover:text-cyan-300 transition-colors">
                Drop files here or click to send
              </h3>
              <p className="text-xs text-slate-400">
                Streaming directly to <span className="font-semibold text-cyan-400">{remotePeer?.name}</span> at local network speeds
              </p>
            </>
          ) : (
            <>
              <h3 className="text-xl font-bold text-slate-200">
                Ready to Stream Any File
              </h3>
              <p className="text-xs text-slate-400">
                Click here or tap <span className="text-cyan-400 font-semibold">Pair Devices</span> to link your phone, tablet, or another laptop.
              </p>
            </>
          )}
        </div>

        {/* Feature Badges */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-[11px] text-slate-300 font-medium">
            <InfinityIcon className="w-3.5 h-3.5 text-cyan-400" />
            <span>Zero Size Limits</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-[11px] text-slate-300 font-medium">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Direct P2P LAN Speeds</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-[11px] text-slate-300 font-medium">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>End-to-End Encrypted</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-[11px] text-slate-300 font-medium">
            <FileCheck2 className="w-3.5 h-3.5 text-blue-400" />
            <span>No Cloud Storage</span>
          </div>
        </div>
      </div>
    </div>
  )
}
