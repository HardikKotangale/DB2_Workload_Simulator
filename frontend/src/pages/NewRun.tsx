import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createRun } from '../api/client'

const scenarioInfo = {
  smoke:      { rounds: 15,  desc: 'Quick sanity check, minimal load' },
  regression: { rounds: 80,  desc: 'Standard validation suite' },
  stress:     { rounds: 300, desc: 'High-volume endurance test' },
}

export default function NewRun() {
  const navigate = useNavigate()
  const [scenario, setScenario] = useState<'smoke' | 'regression' | 'stress'>('regression')
  const [readRatio, setReadRatio] = useState(0.7)
  const [injectDefect, setInjectDefect] = useState(false)
  const [applyFix, setApplyFix] = useState(false)
  const [roundDelayMs, setRoundDelayMs] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const trackRef = useRef<HTMLDivElement>(null)

  const calcRatio = (clientX: number) => {
    if (!trackRef.current) return readRatio
    const rect = trackRef.current.getBoundingClientRect()
    const raw = (clientX - rect.left) / rect.width
    return Math.min(0.9, Math.max(0.1, Math.round(raw / 0.05) * 0.05))
  }

  const onHandleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    const onMove = (ev: MouseEvent) => setReadRatio(calcRatio(ev.clientX))
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const result = await createRun({ scenario, inject_defect: injectDefect, apply_fix: applyFix, read_ratio: readRatio, round_delay_ms: roundDelayMs })
      navigate(`/runs/${result.id}`)
    } catch {
      setError('Failed to start run. Is the backend running?')
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Page header */}
      <div className="bg-white border-b border-slate-200 px-8 py-5">
        <h1 className="text-lg font-semibold text-slate-900">New Run</h1>
        <p className="text-sm text-slate-500 mt-0.5">Configure and launch a DB2 workload simulation</p>
      </div>

      <div className="px-8 py-6">
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Scenario */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
            <p className="text-sm font-semibold text-slate-700 mb-4">Scenario</p>
            <div className="grid grid-cols-3 gap-3">
              {(['smoke', 'regression', 'stress'] as const).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScenario(s)}
                  className={`py-4 px-4 rounded-lg border-2 text-left transition-all ${
                    scenario === s
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className={`text-sm font-semibold capitalize mb-1 ${scenario === s ? 'text-blue-700' : 'text-slate-700'}`}>
                    {s}
                  </div>
                  <div className={`text-xs ${scenario === s ? 'text-blue-500' : 'text-slate-400'}`}>
                    {scenarioInfo[s].rounds} rounds
                  </div>
                  <div className={`text-xs mt-0.5 ${scenario === s ? 'text-blue-500' : 'text-slate-400'}`}>
                    {scenarioInfo[s].desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Read Ratio */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-semibold text-slate-700">Read / Write Ratio</p>
              <div className="flex items-center gap-3 text-xs font-semibold tabular-nums">
                <span className="text-blue-600">{Math.round(readRatio * 100)}% reads</span>
                <span className="text-slate-300">/</span>
                <span className="text-orange-500">{Math.round((1 - readRatio) * 100)}% writes</span>
              </div>
            </div>
            <p className="text-xs text-slate-400 mb-5">Drag the handle to adjust the proportion of SELECT vs INSERT/UPDATE operations</p>

            {/* Custom split bar with draggable handle */}
            <div
              ref={trackRef}
              className="relative h-8 flex items-center group cursor-pointer select-none"
              onClick={e => setReadRatio(calcRatio(e.clientX))}
            >
              {/* Blue/orange split track */}
              <div className="w-full h-3 rounded-full overflow-hidden flex shadow-inner">
                <div className="bg-blue-500 transition-all duration-75" style={{ width: `${readRatio * 100}%` }} />
                <div className="bg-orange-400 flex-1" />
              </div>
              {/* Draggable circle handle */}
              <div
                className="absolute w-3.5 h-3.5 bg-white rounded-full border-2 border-slate-300 shadow-lg cursor-grab active:cursor-grabbing hover:scale-110 hover:border-blue-500 hover:shadow-blue-200 transition-all z-10"
                style={{ left: `calc(${readRatio * 100}% - 8px)` }}
                onMouseDown={onHandleMouseDown}
                onClick={e => e.stopPropagation()}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-400 mt-3">
              <span>10% reads</span>
              <span>90% reads</span>
            </div>
          </div>

          {/* Options */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 space-y-5">
            <p className="text-sm font-semibold text-slate-700">Options</p>

            {/* Inject Defect */}
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className="text-sm font-medium text-slate-700">Inject Defect</p>
                <p className="text-xs text-slate-400 mt-0.5">Insert a negative-total order to trigger validation failures</p>
              </div>
              <button
                type="button"
                onClick={() => { setInjectDefect(!injectDefect); if (injectDefect) setApplyFix(false) }}
                className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${injectDefect ? 'bg-blue-600' : 'bg-slate-200'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${injectDefect ? 'translate-x-5' : ''}`} />
              </button>
            </div>

            <div className="border-t border-slate-100" />

            {/* Apply Fix */}
            <div className={`flex items-start justify-between gap-6 ${!injectDefect ? 'opacity-40 pointer-events-none' : ''}`}>
              <div>
                <p className="text-sm font-medium text-slate-700">Apply Fix</p>
                <p className="text-xs text-slate-400 mt-0.5">Add CHECK constraint after defect injection to verify the fix</p>
              </div>
              <button
                type="button"
                onClick={() => injectDefect && setApplyFix(!applyFix)}
                className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${applyFix ? 'bg-blue-600' : 'bg-slate-200'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${applyFix ? 'translate-x-5' : ''}`} />
              </button>
            </div>

            <div className="border-t border-slate-100" />

            {/* Round Delay */}
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className="text-sm font-medium text-slate-700">Delay between rounds</p>
                <p className="text-xs text-slate-400 mt-0.5">Slow down the run so you have time to observe and stop it</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {[0, 1000, 2000, 15000, 45000].map(ms => (
                  <button
                    key={ms}
                    type="button"
                    onClick={() => setRoundDelayMs(ms)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                      roundDelayMs === ms
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {ms === 0 ? 'Off' : `${ms / 1000}s`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-6 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm text-sm"
          >
            {loading ? 'Starting run...' : 'Start Run'}
          </button>
        </form>
      </div>
    </div>
  )
}
