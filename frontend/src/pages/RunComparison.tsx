import { useEffect, useState } from 'react'
import { getRuns, compareRuns, Run, CompareResult } from '../api/client'
import CompareChart from '../components/CompareChart'
import StatusBadge from '../components/StatusBadge'
import ValidationTable from '../components/ValidationTable'

export default function RunComparison() {
  const [allRuns, setAllRuns] = useState<Run[]>([])
  const [runA, setRunA] = useState('')
  const [runB, setRunB] = useState('')
  const [filterScenario, setFilterScenario] = useState('')
  const [result, setResult] = useState<CompareResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getRuns({ limit: 100 }).then(setAllRuns).catch(() => null)
  }, [])

  useEffect(() => {
    if (!runA || !runB || runA === runB) return
    setLoading(true)
    setError(null)
    compareRuns(runA, runB)
      .then(r => { setResult(r); setLoading(false) })
      .catch(() => { setError('Failed to load comparison.'); setLoading(false) })
  }, [runA, runB])

  const completedRuns = allRuns.filter(r => r.status === 'completed')
  const visibleRuns = filterScenario ? completedRuns.filter(r => r.scenario === filterScenario) : completedRuns

  const runLabel = (r: Run) => {
    const val = r.validation_passed === true ? 'PASS' : r.validation_passed === false ? 'FAIL' : '—'
    const dur = r.duration_ms ? `${(r.duration_ms / 1000).toFixed(1)}s` : ''
    const date = new Date(r.created_at).toLocaleString()
    return `${r.id}  |  ${r.scenario}  |  ${val}${dur ? '  |  ' + dur : ''}  |  ${date}`
  }

  const diffClass = (a: number | undefined, b: number | undefined) => {
    if (!a || !b) return ''
    const pct = ((b - a) / a) * 100
    if (pct < -10) return 'text-emerald-600 font-semibold'
    if (pct > 10) return 'text-red-600 font-semibold'
    return 'text-slate-600'
  }

  return (
    <div>
      {/* Page header */}
      <div className="bg-white border-b border-slate-200 px-8 py-5">
        <h1 className="text-lg font-semibold text-slate-900">Compare Runs</h1>
        <p className="text-sm text-slate-500 mt-0.5">Select two completed runs to compare side-by-side</p>
      </div>

      <div className="px-8 py-6 space-y-6">
        {/* Scenario filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-1">Filter</span>
          {['', 'smoke', 'regression', 'stress'].map(s => (
            <button key={s} onClick={() => setFilterScenario(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filterScenario === s
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}>
              {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
          <span className="text-xs text-slate-400 ml-2">{visibleRuns.length} completed runs</span>
        </div>

        {/* Selectors */}
        <div className="grid grid-cols-2 gap-6">
          {(['A', 'B'] as const).map((label, idx) => {
            const val = idx === 0 ? runA : runB
            const setVal = idx === 0 ? setRunA : setRunB
            const accentClass = idx === 0 ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
            return (
              <div key={label}>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${accentClass}`}>Run {label}</span>
                </label>
                <select value={val} onChange={e => setVal(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white text-slate-700">
                  <option value="">Select run {label}...</option>
                  {visibleRuns.map(r => (
                    <option key={r.id} value={r.id}>{runLabel(r)}</option>
                  ))}
                </select>
              </div>
            )
          })}
        </div>

        {loading && <div className="text-slate-400 text-sm py-4">Loading comparison...</div>}
        {error && <div className="text-red-600 text-sm">{error}</div>}

        {result && !loading && (
          <div className="space-y-6">
            {/* Side-by-side summaries */}
            <div className="grid grid-cols-2 gap-6">
              {[result.run_a, result.run_b].map((run, i) => (
                <div key={run.id} className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${i === 0 ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                      Run {i === 0 ? 'A' : 'B'}
                    </span>
                    <span className="font-mono text-xs text-slate-700">{run.id}</span>
                    <StatusBadge status={run.status} />
                  </div>
                  <dl className="space-y-2 text-sm">
                    {[
                      { label: 'Scenario', value: <span className="capitalize">{run.scenario}</span> },
                      { label: 'Total Ops', value: run.total_ops ?? '—' },
                      { label: 'Failed Ops', value: <span className={(run.fail_ops ?? 0) > 0 ? 'text-red-600' : ''}>{run.fail_ops ?? '—'}</span> },
                      { label: 'Duration', value: run.duration_ms ? `${(run.duration_ms / 1000).toFixed(1)}s` : '—' },
                      { label: 'Validation', value: <span className={run.validation_passed ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'}>{run.validation_passed === true ? 'PASS' : run.validation_passed === false ? 'FAIL' : '—'}</span> },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex justify-between">
                        <dt className="text-slate-400">{label}</dt>
                        <dd className="font-medium">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>

            {/* Compare chart */}
            {result.metrics_a && result.metrics_b && (
              <CompareChart
                metricsA={result.metrics_a}
                metricsB={result.metrics_b}
                labelA={`Run A (${result.run_a.id})`}
                labelB={`Run B (${result.run_b.id})`}
              />
            )}

            {/* Metric diff table */}
            {result.metrics_a?.after && result.metrics_b?.after && (
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-800">Metric Diff (After Indexes)</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    <span className="text-emerald-600 font-semibold">Green</span> = Run B improved by &gt;10% ·{' '}
                    <span className="text-red-600 font-semibold">Red</span> = degraded by &gt;10%
                  </p>
                </div>
                <table className="min-w-full divide-y divide-slate-100">
                  <thead className="bg-slate-50">
                    <tr>
                      {['Metric', 'Run A (ms)', 'Run B (ms)', 'Change'].map(h => (
                        <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(['p50_ms', 'p95_ms', 'avg_ms'] as const).map(key => {
                      const a = result.metrics_a.after?.[key]
                      const b = result.metrics_b.after?.[key]
                      const pct = a && b ? ((b - a) / a) * 100 : null
                      return (
                        <tr key={key}>
                          <td className="px-6 py-4 text-sm font-medium text-slate-800">{key}</td>
                          <td className="px-6 py-4 text-sm text-slate-600 tabular-nums">{a ?? '—'}</td>
                          <td className="px-6 py-4 text-sm text-slate-600 tabular-nums">{b ?? '—'}</td>
                          <td className={`px-6 py-4 text-sm tabular-nums ${diffClass(a, b)}`}>
                            {pct !== null ? `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%` : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Side-by-side validations */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Validations — Run A</h3>
                <ValidationTable validations={result.validations_a} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Validations — Run B</h3>
                <ValidationTable validations={result.validations_b} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
