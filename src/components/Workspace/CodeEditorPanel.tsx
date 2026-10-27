// Real-Time Collaborative Code Editor & Scratchpad

import React, { useMemo, useCallback } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import { markdown } from '@codemirror/lang-markdown'
import { json } from '@codemirror/lang-json'
import { oneDark } from '@codemirror/theme-one-dark'
import {
  Code2,
  Copy,
  Check,
  Download,
  RotateCcw,
  Sparkles,
} from 'lucide-react'
import { useAirStream } from '../../context/AirStreamContext'

export const CodeEditorPanel: React.FC = () => {
  const {
    workspaceDoc,
    updateWorkspaceDoc,
    connectionState,
    remotePeer,
  } = useAirStream()

  const [copied, setCopied] = React.useState(false)
  const isConnected = connectionState === 'connected'

  const languageExtensions = useMemo(() => {
    switch (workspaceDoc.language) {
      case 'python':
        return [python()]
      case 'markdown':
        return [markdown()]
      case 'json':
        return [json()]
      case 'typescript':
        return [javascript({ typescript: true })]
      default:
        return [javascript({ jsx: true })]
    }
  }, [workspaceDoc.language])

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateWorkspaceDoc(workspaceDoc.content, e.target.value)
  }

  const handleContentChange = useCallback(
    (value: string) => {
      updateWorkspaceDoc(value, workspaceDoc.language)
    },
    [updateWorkspaceDoc, workspaceDoc.language]
  )

  const handleCopy = () => {
    navigator.clipboard.writeText(workspaceDoc.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const extMap: Record<string, string> = {
      javascript: 'js',
      typescript: 'ts',
      python: 'py',
      markdown: 'md',
      json: 'json',
    }
    const ext = extMap[workspaceDoc.language] || 'txt'
    const blob = new Blob([workspaceDoc.content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `airstream_scratchpad.${ext}`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleClear = () => {
    if (confirm('Clear the collaborative scratchpad?')) {
      updateWorkspaceDoc('', workspaceDoc.language)
    }
  }

  return (
    <div className="w-full space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Code2 className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-100">Collaborative Workspace</h3>
              {isConnected && (
                <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <Sparkles className="w-3 h-3 text-cyan-400" />
                  <span>Synced with {remotePeer?.name}</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Live synchronized code scratchpad via RTCDataChannel
            </p>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center gap-2">
          {/* Language selector */}
          <select
            value={workspaceDoc.language}
            onChange={handleLanguageChange}
            className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-cyan-400 outline-none cursor-pointer focus:border-cyan-500"
          >
            <option value="javascript">JavaScript</option>
            <option value="typescript">TypeScript</option>
            <option value="python">Python</option>
            <option value="markdown">Markdown</option>
            <option value="json">JSON</option>
          </select>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors"
            title="Copy Code"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Copy</span>
              </>
            )}
          </button>

          <button
            onClick={handleDownload}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Download File"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            onClick={handleClear}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
            title="Reset Scratchpad"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* CodeMirror Surface */}
      <div className="rounded-2xl overflow-hidden border border-slate-800 shadow-2xl bg-[#282c34]">
        <CodeMirror
          value={workspaceDoc.content}
          height="420px"
          theme={oneDark}
          extensions={languageExtensions}
          onChange={handleContentChange}
          basicSetup={{
            lineNumbers: true,
            highlightActiveLineGutter: true,
            highlightSpecialChars: true,
            history: true,
            foldGutter: true,
            drawSelection: true,
            dropCursor: true,
            allowMultipleSelections: true,
            indentOnInput: true,
            syntaxHighlighting: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: true,
            rectangularSelection: true,
            crosshairCursor: true,
            highlightActiveLine: true,
            highlightSelectionMatches: true,
            closeBracketsKeymap: true,
            defaultKeymap: true,
            searchKeymap: true,
            historyKeymap: true,
            foldKeymap: true,
            completionKeymap: true,
            lintKeymap: true,
          }}
          className="text-sm font-mono"
        />
      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-between text-[11px] text-slate-500 px-1 font-mono">
        <span>Doc Version: v{workspaceDoc.version}</span>
        <span>
          {workspaceDoc.content.length} characters • {workspaceDoc.content.split('\n').length} lines
        </span>
      </div>
    </div>
  )
}
