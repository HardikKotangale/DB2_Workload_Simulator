import { useEffect, useRef, useState } from 'react'

interface WsMessage {
  level?: string
  message?: string
  ts?: string
  done?: boolean
  ping?: boolean
}

export function useWebSocket(runId: string | null) {
  const [logs, setLogs] = useState<string[]>([])
  const [connected, setConnected] = useState(false)
  const [done, setDone] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const attemptRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const doneRef = useRef(false)

  useEffect(() => {
    if (!runId) return

    setLogs([])
    setConnected(false)
    setDone(false)
    doneRef.current = false
    attemptRef.current = 0

    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws/runs/${runId}`)
      wsRef.current = ws

      ws.onopen = () => {
        setConnected(true)
        attemptRef.current = 0
      }

      ws.onmessage = (event) => {
        try {
          const msg: WsMessage = JSON.parse(event.data)
          if (msg.ping) return
          if (msg.done) {
            doneRef.current = true
            setDone(true)
            return
          }
          if (msg.level && msg.message) {
            setLogs(prev => [...prev, `[${msg.level}] ${msg.message}`])
          }
        } catch { /* ignore malformed */ }
      }

      const scheduleReconnect = () => {
        if (doneRef.current || attemptRef.current >= 5) return
        const delay = Math.pow(2, attemptRef.current) * 1000
        attemptRef.current += 1
        timerRef.current = setTimeout(connect, delay)
      }

      ws.onerror = () => setConnected(false)
      ws.onclose = () => {
        setConnected(false)
        scheduleReconnect()
      }
    }

    connect()

    return () => {
      doneRef.current = true
      if (timerRef.current) clearTimeout(timerRef.current)
      wsRef.current?.close()
    }
  }, [runId])

  return { logs, connected, done }
}
