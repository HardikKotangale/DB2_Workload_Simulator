import { useCallback, useEffect, useRef, useState } from 'react'
import { getRuns, Run } from '../api/client'

export function useRuns(params?: { skip?: number; limit?: number; status?: string; scenario?: string }) {
  const [runs, setRuns] = useState<Run[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetch = useCallback(async () => {
    try {
      const data = await getRuns(params)
      setRuns(data)
      setError(null)
    } catch (e) {
      setError('Failed to load runs')
    } finally {
      setLoading(false)
    }
  }, [JSON.stringify(params)])

  useEffect(() => {
    fetch()
  }, [fetch])

  // Auto-refresh every 5s if any run is "running"
  useEffect(() => {
    const hasRunning = runs.some(r => r.status === 'running')
    if (hasRunning) {
      timerRef.current = setInterval(fetch, 5000)
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [runs, fetch])

  return { runs, loading, error, refetch: fetch }
}
