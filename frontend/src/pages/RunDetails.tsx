import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  getRun, getRunLogs, getRunMetrics, getRunValidations,
  getRunOperations, getRunOperationsSummary, getRunThroughput, cancelRun,
  Run, RunLog, RunMetrics, RunValidation, RunOperation, OpSummary, ThroughputBucket, exportRunUrl
} from '../api/client'
import { useWebSocket } from '../hooks/useWebSocket'
import MetricCard from '../components/MetricCard'
import StatusBadge from '../components/StatusBadge'
import PerformanceChart from '../components/PerformanceChart'
import ValidationTable from '../components/ValidationTable'
import LiveLog from '../components/LiveLog'
import ThroughputChart from '../components/ThroughputChart'
import ReadWriteDonut from '../components/ReadWriteDonut'
import ErrorRateChart from '../components/ErrorRateChart'

type Tab = 'overview' | 'operations' | 'log'

export default function RunDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [run, setRun] = useState<Run | null>(null)
  const [logs, setLogs] = useState<RunLog[]>([])
  const [metrics, setMetrics] = useState<RunMetrics | null>(null)
  const [validations, setValidations] = useState<RunValidation[]>([])
  const [ops, setOps] = useState<RunOperation[]>([])
  const [opSummary, setOpSummary] = useState<OpSummary[]>([])
  const [throughput, setThroughput] = useState<ThroughputBucket[]>([])
  const [opsPage, setOpsPage] = useState(0)
  const [opsTypeFilter, setOpsTypeFilter] = useState('')
  const [opsStatusFilter, setOpsStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)
  const [confirmStop, setConfirmStop] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [historicalLogs, setHistoricalLogs] = useState<string[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const historicalFetchedRef = useRef(false)
  const PAGE_SIZE = 100

  const isRunning = run?.status === 'running' && !cancelling
  const { logs: wsLogs, connected } = useWebSocket(isRunning ? (id ?? null) : null)

  // Poll run status while running
  useEffect(() => {
    if (!id) return

    const loadRun = async () => {
      try {
        const r = await getRun(id)
        setRun(r)
        setLoading(false)
        if (r.status === 'running' && !historicalFetchedRef.current) {
          historicalFetchedRef.current = true
          getRunLogs(id, { limit: 500 }).then(l => {
            setHistoricalLogs(l.map(entry => `[${entry.level}] ${entry.message}`))
          }).catch(() => null)
        }
        if (r.status !== 'running') {
          if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
          const [l, m, v, summary, tput] = await Promise.all([
            getRunLogs(id, { limit: 500 }),
            getRunMetrics(id),
            getRunValidations(id),
            getRunOperationsSummary(id),
            getRunThroughput(id),
          ])
          setLogs(l)
          setMetrics(m)
          setValidations(v)
          setOpSummary(summary)
          setThroughput(tput)
        }
      } catch { setLoading(false) }
    }

    loadRun()
    intervalRef.current = setInterval(loadRun, 2000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [id])

  // Fetch paginated ops when Operations tab is active
  useEffect(() => {
    if (!id || !run || run.status === 'running' || activeTab !== 'operations') return
    getRunOperations(id, {
      skip: opsPage * PAGE_SIZE,
      limit: PAGE_SIZE,
      type: opsTypeFilter || undefined,
      status: opsStatusFilter || undefined,
    }).then(setOps).catch(() => null)
  }, [id, run, activeTab, opsPage, opsTypeFilter, opsStatusFilter])

  if (loading) return <div className="p-8 text-slate-500">Loading run details...</div>
  if (!run) return <div className="p-8 text-red-600">Run not found.</div>

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'operations', label: `Operations${run.total_ops ? ` (${run.total_ops})` : ''}` },
    { key: 'log', label: 'Log' },
  ]

  return (
    <div>
      {/* Page header */}
      <div className="bg-white border-b border-slate-200 px-8 py-5">
        <div className="flex items-start justify-between">
          <div>
            <button onClick={() => navigate('/runs')}
              className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors mb-2">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              History
            </button>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-base font-mono font-semibold text-slate-900">{run.id}</h1>
              <StatusBadge status={run.status} />
            </div>
            <p className="text-sm text-slate-500">
              <span className="capitalize font-medium text-slate-700">{run.scenario}</span>
              <span className="mx-1.5 text-slate-300">·</span>
              {run.rounds} rounds
              <span className="mx-1.5 text-slate-300">·</span>
              {Math.round(run.read_ratio * 100)}% reads
              {run.inject_defect && <><span className="mx-1.5 text-slate-300">·</span><span className="text-amber-600 font-medium">defect injected</span></>}
              {run.apply_fix && <><span className="mx-1.5 text-slate-300">·</span><span className="text-blue-600 font-medium">fix applied</span></>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {run.status === 'running' && (
              <button
                onClick={() => { if (!cancelling) setConfirmStop(true) }}
                disabled={cancelling}
                className="inline-flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10h6v4H9z" />
                </svg>
                {cancelling ? 'Stopping...' : 'Stop Run'}
              </button>
            )}
            {run.status !== 'running' && (
              <>
                <a href={exportRunUrl(run.id, 'csv')} className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  CSV
                </a>
                <a href={exportRunUrl(run.id, 'pdf')} className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  PDF
                </a>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Progress bar + live log while running */}
      {run.status === 'running' && (
        <div className="px-8 py-6 space-y-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm px-6 py-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Progress</span>
              <span className="text-xs font-semibold tabular-nums text-slate-700">
                {run.current_round} / {run.rounds} rounds
              </span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${run.rounds > 0 ? Math.round((run.current_round / run.rounds) * 100) : 0}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-400 mt-1.5">
              <span>{run.rounds > 0 ? Math.round((run.current_round / run.rounds) * 100) : 0}% complete</span>
              <span className="capitalize">{run.scenario} scenario</span>
            </div>
          </div>
          <LiveLog logs={[...historicalLogs, ...wsLogs]} connected={connected} />
        </div>
      )}

      {/* Tabs (only after run finishes) */}
      {run.status !== 'running' && (
        <div>
          {/* Tab bar */}
          <div className="bg-white border-b border-slate-200 px-8">
            <div className="flex gap-0">
              {tabs.map(t => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`px-5 py-3.5 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === t.key
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="px-8 py-6">

            {/* ── OVERVIEW TAB ── */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <MetricCard label="Total Ops" value={run.total_ops} />
                  <MetricCard label="Failed Ops" value={run.fail_ops} highlight={(run.fail_ops ?? 0) > 0 ? 'red' : 'default'} />
                  <MetricCard label="Duration" value={run.duration_ms ? (run.duration_ms / 1000).toFixed(1) : null} unit="s" />
                  <MetricCard
                    label="Validation"
                    value={run.validation_passed === true ? 'PASS' : run.validation_passed === false ? 'FAIL' : '—'}
                    highlight={run.validation_passed === true ? 'green' : run.validation_passed === false ? 'red' : 'default'}
                  />
                </div>
                {metrics?.before && metrics?.after && <PerformanceChart before={metrics.before} after={metrics.after} />}
                <ThroughputChart data={throughput} />
                {opSummary.length > 0 && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <ReadWriteDonut opSummary={opSummary} />
                    <ErrorRateChart opSummary={opSummary} />
                  </div>
                )}
                {validations.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700 mb-3">Validation Results</h3>
                    <ValidationTable validations={validations} />
                  </div>
                )}
              </div>
            )}

            {/* ── OPERATIONS TAB ── */}
            {activeTab === 'operations' && (
              <div className="space-y-6">
                {/* Summary by query */}
                {opSummary.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700 mb-3">Summary by Query</h3>
                    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-100">
                        <thead className="bg-slate-50">
                          <tr>
                            {['Query', 'Type', 'Count', 'Avg ms', 'Min ms', 'Max ms', 'Failures'].map(h => (
                              <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {opSummary.map(s => (
                            <tr key={s.query_name} className="hover:bg-slate-50 transition-colors">
                              <td className="px-5 py-3.5 text-xs font-mono text-slate-800">{s.query_name}</td>
                              <td className="px-5 py-3.5">
                                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${s.type === 'READ' ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' : 'bg-orange-50 text-orange-700 ring-1 ring-orange-200'}`}>
                                  {s.type}
                                </span>
                              </td>
                              <td className="px-5 py-3.5 text-sm text-slate-600 tabular-nums">{s.count}</td>
                              <td className="px-5 py-3.5 text-sm text-slate-600 tabular-nums">{s.avg_ms}</td>
                              <td className="px-5 py-3.5 text-sm text-slate-600 tabular-nums">{s.min_ms}</td>
                              <td className="px-5 py-3.5 text-sm text-slate-600 tabular-nums">{s.max_ms}</td>
                              <td className="px-5 py-3.5">
                                {s.fail_count > 0
                                  ? <span className="text-xs font-semibold text-red-600 tabular-nums">{s.fail_count}</span>
                                  : <span className="text-xs text-slate-300">0</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Individual ops */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-slate-700">All Operations</h3>
                    <div className="flex gap-2">
                      <select
                        value={opsTypeFilter}
                        onChange={e => { setOpsTypeFilter(e.target.value); setOpsPage(0) }}
                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                      >
                        <option value="">All types</option>
                        <option value="READ">READ only</option>
                        <option value="WRITE">WRITE only</option>
                      </select>
                      <select
                        value={opsStatusFilter}
                        onChange={e => { setOpsStatusFilter(e.target.value); setOpsPage(0) }}
                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                      >
                        <option value="">All statuses</option>
                        <option value="OK">OK only</option>
                        <option value="FAIL">FAIL only</option>
                      </select>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-100">
                      <thead className="bg-slate-50">
                        <tr>
                          {['#', 'Type', 'Query', 'SQL', 'Elapsed ms', 'Status', 'Error'].map(h => (
                            <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {ops.length === 0 ? (
                          <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-400 text-sm">No operations found.</td></tr>
                        ) : ops.map(op => (
                          <tr key={op.id} className={op.status === 'FAIL' ? 'bg-red-50/50' : 'hover:bg-slate-50/80 transition-colors'}>
                            <td className="px-5 py-3 text-xs text-slate-400 tabular-nums">{op.op_index + 1}</td>
                            <td className="px-5 py-3">
                              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${op.type === 'READ' ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' : 'bg-orange-50 text-orange-700 ring-1 ring-orange-200'}`}>
                                {op.type}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-xs font-mono text-slate-700 whitespace-nowrap">{op.query_name}</td>
                            <td className="px-5 py-3 w-80">
                              {op.sql_text
                                ? <span className="block text-xs font-mono text-slate-600 whitespace-pre-wrap break-words leading-relaxed">{op.sql_text}</span>
                                : <span className="text-slate-300 text-xs">—</span>}
                            </td>
                            <td className="px-5 py-3 text-sm text-slate-600 tabular-nums whitespace-nowrap">{op.elapsed_ms} ms</td>
                            <td className="px-5 py-3">
                              {op.status === 'OK'
                                ? <span className="text-xs font-semibold text-emerald-600">OK</span>
                                : <span className="text-xs font-semibold text-red-600">FAIL</span>}
                            </td>
                            <td className="px-5 py-3 w-64">
                              <span className={`block text-xs whitespace-pre-wrap break-words leading-relaxed ${op.error ? 'text-red-600' : 'text-slate-300'}`}>
                                {op.error || '—'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  <div className="flex items-center justify-between mt-4">
                    <button onClick={() => setOpsPage(p => Math.max(0, p - 1))} disabled={opsPage === 0}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                      Previous
                    </button>
                    <span className="text-sm text-slate-500 tabular-nums">
                      {opsPage * PAGE_SIZE + 1}–{opsPage * PAGE_SIZE + ops.length} of {run.total_ops ?? '?'}
                    </span>
                    <button onClick={() => setOpsPage(p => p + 1)} disabled={ops.length < PAGE_SIZE}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors">
                      Next
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── LOG TAB ── */}
            {activeTab === 'log' && (
              <div className="bg-slate-950 rounded-lg border border-slate-800 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Run Log</span>
                  <span className="text-xs text-slate-600">{logs.length} entries</span>
                </div>
                <div className="p-5 h-[36rem] overflow-y-auto font-mono text-xs space-y-1">
                  {logs.map(l => (
                    <div key={l.id} className="flex gap-3 leading-relaxed">
                      <span className="text-slate-600 flex-shrink-0 tabular-nums select-none">{l.ts.slice(11, 19)}</span>
                      <span className={`flex-shrink-0 font-semibold w-12 ${l.level === 'ERROR' ? 'text-red-400' : l.level === 'WARN' ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {l.level}
                      </span>
                      <span className="text-slate-300 break-all">{l.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Stop confirmation modal */}
      {confirmStop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setConfirmStop(false)} />
          <div className="relative bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-sm mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10h6v4H9z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Stop this run?</p>
                <p className="text-xs text-slate-500 mt-0.5">The workload will be cancelled and cannot be resumed.</p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmStop(false)}
                className="px-4 py-2 text-sm font-medium bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={async () => {
                  setConfirmStop(false)
                  if (!id) return
                  setCancelling(true)
                  try { await cancelRun(id) } catch { setCancelling(false) }
                }}
                className="px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-sm">
                Stop Run
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
