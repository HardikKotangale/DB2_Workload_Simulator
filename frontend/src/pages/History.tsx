import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { deleteRun, deleteAllRuns } from '../api/client'
import { useRuns } from '../hooks/useRuns'
import StatusBadge from '../components/StatusBadge'

export default function History() {
  const navigate = useNavigate()
  const [scenarioFilter, setScenarioFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false)
  const pageSize = 20

  const { runs, loading, refetch } = useRuns({
    skip: page * pageSize,
    limit: pageSize,
    scenario: scenarioFilter || undefined,
    status: statusFilter || undefined,
  })

  const filtered = search ? runs.filter(r => r.id.includes(search)) : runs

  return (
    <div>
      {/* Page header */}
      <div className="bg-white border-b border-slate-200 px-8 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Run History</h1>
            <p className="text-sm text-slate-500 mt-0.5">All workload runs</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
            {runs.some(r => r.status !== 'running') && (
              <button
                onClick={() => setConfirmDeleteAll(true)}
                className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-red-200 rounded-lg text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete All
              </button>
            )}
            <Link
              to="/runs/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Run
            </Link>
          </div>
        </div>
      </div>

      <div className="px-8 py-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search run ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 w-52"
            />
          </div>
          <select
            value={scenarioFilter}
            onChange={e => { setScenarioFilter(e.target.value); setPage(0) }}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <option value="">All scenarios</option>
            <option value="smoke">Smoke</option>
            <option value="regression">Regression</option>
            <option value="stress">Stress</option>
          </select>
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(0) }}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <option value="">All statuses</option>
            <option value="running">Running</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-x-auto">
          {loading ? (
            <div className="px-6 py-12 text-center text-slate-400 text-sm">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-slate-400 text-sm mb-3">No runs found.</p>
              <Link to="/runs/new" className="text-sm font-medium text-blue-600 hover:text-blue-700">
                Start a new run
              </Link>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  {['Run ID', 'Scenario', 'Status', 'Rounds', 'Read %', 'Total Ops', 'Duration', 'Validation', 'Created', ''].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(run => (
                  <tr
                    key={run.id}
                    onClick={() => navigate(`/runs/${run.id}`)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-3.5 text-xs font-mono text-blue-600 whitespace-nowrap">{run.id}</td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm text-slate-700 capitalize font-medium">{run.scenario}</span>
                    </td>
                    <td className="px-5 py-3.5"><StatusBadge status={run.status} /></td>
                    <td className="px-5 py-3.5 text-sm text-slate-600 tabular-nums">{run.rounds}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-600 tabular-nums">{Math.round(run.read_ratio * 100)}%</td>
                    <td className="px-5 py-3.5 text-sm text-slate-600 tabular-nums">{run.total_ops ?? '—'}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-600 whitespace-nowrap tabular-nums">
                      {run.duration_ms ? `${(run.duration_ms / 1000).toFixed(1)}s` : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      {run.validation_passed === true && (
                        <span className="text-xs font-semibold text-emerald-600">PASS</span>
                      )}
                      {run.validation_passed === false && (
                        <span className="text-xs font-semibold text-red-600">FAIL</span>
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

        {/* Pagination */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Previous
          </button>
          <span className="text-sm text-slate-500">Page {page + 1}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={filtered.length < pageSize}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
          >
            Next
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
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
