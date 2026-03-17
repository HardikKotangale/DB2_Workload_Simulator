import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getHealth, getRunTrend, deleteRun, deleteAllRuns, HealthStatus, TrendPoint } from '../api/client'
import { useRuns } from '../hooks/useRuns'
import MetricCard from '../components/MetricCard'
import StatusBadge from '../components/StatusBadge'
import TrendChart from '../components/TrendChart'

export default function Dashboard() {
  const navigate = useNavigate()
  const { runs, loading, refetch } = useRuns({ limit: 20 })
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [trend, setTrend] = useState<TrendPoint[]>([])
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false)

  const fetchAll = () => {
    getHealth().then(setHealth).catch(() => null)
    getRunTrend({ limit: 20 }).then(setTrend).catch(() => null)
    refetch()
  }

  useEffect(() => {
    fetchAll()
    const t = setInterval(fetchAll, 30000)
    return () => clearInterval(t)
  }, [])

  const total = runs.length
  const completed = runs.filter(r => r.status === 'completed').length
  const failed = runs.filter(r => r.status === 'failed').length
  const passCount = runs.filter(r => r.validation_passed === true).length
  const passRate = completed > 0 ? `${Math.round((passCount / completed) * 100)}%` : '—'
  const recentRuns = runs.slice(0, 8)

  return (
    <div>
      {/* Page header */}
      <div className="bg-white border-b border-slate-200 px-8 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Overview</h1>
            <p className="text-sm text-slate-500 mt-0.5">Workload simulation summary</p>
          </div>
          <Link
            to="/runs/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            </svg>
            New Run
          </Link>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6">
        {/* DB2 Connection Banner */}
        {health && (
          <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-sm ${
            health.db2 === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${health.db2 === 'ok' ? 'bg-emerald-500' : 'bg-red-500'}`} />
            <span className="font-medium">
              {health.db2 === 'ok' ? 'DB2 Connected' : 'DB2 Unreachable'}
            </span>
            <span className="text-slate-500 font-mono text-xs">{health.host}:{health.port}</span>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="Total Runs" value={total} />
          <MetricCard label="Completed" value={completed} highlight="green" />
          <MetricCard label="Failed" value={failed} highlight={failed > 0 ? 'red' : 'default'} />
          <MetricCard label="Pass Rate" value={passRate} highlight="blue" />
        </div>

        {/* Historical trend chart */}
        {trend.length >= 2 && <TrendChart data={trend} />}

        {/* Recent Runs */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-x-auto">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">Recent Runs</h2>
            <div className="flex items-center gap-2">
              {runs.some(r => r.status !== 'running') && (
                <button
                  onClick={() => setConfirmDeleteAll(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-red-200 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete All
                </button>
              )}
              <Link
                to="/runs"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                View All Runs
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>

          {loading ? (
            <div className="px-6 py-10 text-center text-slate-400 text-sm">Loading...</div>
          ) : recentRuns.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-slate-400 text-sm mb-3">No runs yet.</p>
              <Link
                to="/runs/new"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
              >
                Start your first run
              </Link>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  {['Run ID', 'Scenario', 'Status', 'Total Ops', 'Duration', 'Validation', 'Started', ''].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentRuns.map(run => (
                  <tr
                    key={run.id}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/runs/${run.id}`)}
                  >
                    <td className="px-5 py-3.5 text-xs font-mono text-blue-600 whitespace-nowrap">{run.id}</td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm text-slate-700 capitalize font-medium">{run.scenario}</span>
                    </td>
                    <td className="px-5 py-3.5"><StatusBadge status={run.status} /></td>
                    <td className="px-5 py-3.5 text-sm text-slate-600 tabular-nums">{run.total_ops ?? '—'}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-600 whitespace-nowrap tabular-nums">
                      {run.duration_ms ? `${(run.duration_ms / 1000).toFixed(1)}s` : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      {run.validation_passed === true && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                          PASS
                        </span>
                      )}
                      {run.validation_passed === false && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          FAIL
                        </span>
                      )}
                      {run.validation_passed === null && <span className="text-slate-300 text-sm">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-400 whitespace-nowrap">
                      {new Date(run.created_at).toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5" onClick={e => e.stopPropagation()}>
                      {run.status !== 'running' && (
                        <button
                          onClick={() => setConfirmDeleteId(run.id)}
                          className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete run"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Delete single run modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setConfirmDeleteId(null)} />
          <div className="relative bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-sm mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Delete this run?</p>
                <p className="text-xs font-mono text-slate-500 mt-0.5">{confirmDeleteId}</p>
              </div>
            </div>
            <p className="text-xs text-slate-500 mb-4">All logs, operations, metrics and validations for this run will be permanently deleted.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2 text-sm font-medium bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={async () => {
                  const id = confirmDeleteId
                  setConfirmDeleteId(null)
                  await deleteRun(id).catch(() => null)
                  refetch()
                }}
                className="px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-sm">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete all runs modal */}
      {confirmDeleteAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setConfirmDeleteAll(false)} />
          <div className="relative bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-sm mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Delete all runs?</p>
                <p className="text-xs text-slate-500 mt-0.5">Active runs will not be deleted.</p>
              </div>
            </div>
            <p className="text-xs text-slate-500 mb-4">All completed, failed, and cancelled runs with their associated data will be permanently removed.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDeleteAll(false)}
                className="px-4 py-2 text-sm font-medium bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={async () => {
                  setConfirmDeleteAll(false)
                  await deleteAllRuns().catch(() => null)
                  refetch()
                }}
                className="px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-sm">
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
