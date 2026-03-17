import { useEffect, useRef } from 'react'

interface Props {
  logs: string[]
  connected: boolean
}

const levelColor: Record<string, string> = {
  INFO: 'text-green-400',
  WARN: 'text-yellow-400',
  ERROR: 'text-red-400',
}

export default function LiveLog({ logs, connected }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 border-b border-slate-700">
        <span
          className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-slate-500'}`}
        />
        <span className="text-slate-300 text-xs font-mono">
          {connected ? 'Live — streaming logs' : 'Connecting...'}
        </span>
      </div>
      <div className="h-80 overflow-y-auto p-4 font-mono text-xs leading-5 space-y-0.5">
        {logs.length === 0 && !connected && (
          <span className="text-slate-500">Waiting for connection...</span>
        )}
        {logs.map((line, i) => {
          const match = line.match(/^\[(\w+)\] (.+)$/)
          const level = match ? match[1] : null
          const msg = match ? match[2] : line
          const colorClass = level ? levelColor[level] ?? 'text-slate-300' : 'text-slate-300'
          return (
            <div key={i} className="flex gap-2">
              {level && <span className={`flex-shrink-0 ${colorClass}`}>[{level}]</span>}
              <span className="text-slate-200 break-all">{msg}</span>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
