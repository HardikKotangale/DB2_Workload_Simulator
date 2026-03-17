import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getSchedules, createSchedule, updateSchedule, deleteSchedule, runScheduleNow, Schedule
} from '../api/client'

// ── Cron helpers ──────────────────────────────────────────────────────────────

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function describeCron(expr: string): string {
  const parts = expr.trim().split(/\s+/)
  if (parts.length !== 5) return 'Invalid expression'
  const [min, hour, , , dow] = parts
  try {
    // Every N minutes: */N * * * *  or  * * * * *
    if (hour === '*' && dow === '*') {
      if (min === '*') return 'Every minute'
      const mStep = min.match(/^\*\/(\d+)$/)
      if (mStep) {
        const n = parseInt(mStep[1])
        return n === 1 ? 'Every minute' : `Every ${n} minutes`
      }
    }
    // Every N hours: 0 */N * * *
    if (min === '0' && dow === '*') {
      if (hour === '*') return 'Every hour'
      const hStep = hour.match(/^\*\/(\d+)$/)
      if (hStep) {
        const n = parseInt(hStep[1])
        return n === 1 ? 'Every hour' : `Every ${n} hours`
      }
    }
    // Daily or weekly at fixed time
    if (/^\d+$/.test(min) && /^\d+$/.test(hour)) {
      const h = parseInt(hour), m = parseInt(min)
      const ampm = h < 12 ? 'AM' : 'PM'
      const h12 = h % 12 === 0 ? 12 : h % 12
      const mStr = `${h12}:${String(m).padStart(2, '0')} ${ampm}`
      if (dow !== '*' && /^\d+$/.test(dow)) return `Every ${DAYS[parseInt(dow)]} at ${mStr}`
      return `Daily at ${mStr}`
    }
    return 'Custom schedule'
  } catch { return 'Custom schedule' }
}

/** Rough next-run from now (client-side, minute-level precision) */
function nextRunFromNow(expr: string): Date | null {
  const parts = expr.trim().split(/\s+/)
  if (parts.length !== 5) return null
  const [minP, hourP, , , dowP] = parts

  const now = new Date()
  const candidate = new Date(now)
  candidate.setSeconds(0, 0)
  candidate.setMinutes(candidate.getMinutes() + 1) // start from next minute

  for (let i = 0; i < 60 * 24 * 8; i++) { // search up to 8 days ahead
    const m = candidate.getMinutes()
    const h = candidate.getHours()
    const d = candidate.getDay()

    const minOk  = minP  === '*' || (minP.startsWith('*/') ? m % parseInt(minP.slice(2)) === 0 : parseInt(minP) === m)
    const hourOk = hourP === '*' || (hourP.startsWith('*/') ? h % parseInt(hourP.slice(2)) === 0 : parseInt(hourP) === h)
    const dowOk  = dowP  === '*' || parseInt(dowP) === d

    if (minOk && hourOk && dowOk) return candidate
    candidate.setMinutes(candidate.getMinutes() + 1)
  }
  return null
}

function formatTimeRemaining(target: Date | null, nowMs: number): string {
  if (!target) return '—'
  const diff = target.getTime() - nowMs
  if (diff <= 0) return 'Now'
  const totalSec = Math.floor(diff / 1000)
  const days  = Math.floor(totalSec / 86400)
  const hours = Math.floor((totalSec % 86400) / 3600)
  const mins  = Math.floor((totalSec % 3600) / 60)
  const secs  = totalSec % 60
  if (days > 0)  return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m ${secs}s`
  if (mins > 0)  return `${mins}m ${secs}s`
  return `${secs}s`
}

// ── Human schedule builder ────────────────────────────────────────────────────

type FreqType = 'minutes' | 'hours' | 'daily' | 'weekly'

interface HumanSchedule {
  freq: FreqType
  interval: number   // for minutes/hours
  hour: number       // for daily/weekly
  minute: number     // for daily/weekly
  weekday: number    // 0-6 for weekly
}

const defaultHuman: HumanSchedule = { freq: 'daily', interval: 1, hour: 9, minute: 0, weekday: 1 }

function humanToCron(h: HumanSchedule): string {
  switch (h.freq) {
    case 'minutes': return `*/${Math.max(1, h.interval)} * * * *`
    case 'hours':   return `0 */${Math.max(1, h.interval)} * * *`
    case 'daily':   return `${h.minute} ${h.hour} * * *`
    case 'weekly':  return `${h.minute} ${h.hour} * * ${h.weekday}`
  }
}

// ── Form state ────────────────────────────────────────────────────────────────

interface FormState {
  name: string
  scenario: string
  inject_defect: boolean
  read_ratio: number
  human: HumanSchedule
}

const defaultForm: FormState = {
  name: '',
  scenario: 'regression',
  inject_defect: false,
  read_ratio: 0.7,
  human: defaultHuman,
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Schedules() {
  const navigate = useNavigate()
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(defaultForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [intervalRaw, setIntervalRaw] = useState(String(defaultHuman.interval))
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [now, setNow] = useState(Date.now())
  const trackRef = useRef<HTMLDivElement>(null)

  // Tick every second to refresh time-remaining
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const calcRatio = (clientX: number) => {
    if (!trackRef.current) return form.read_ratio
    const rect = trackRef.current.getBoundingClientRect()
    return Math.min(0.9, Math.max(0.1, Math.round(((clientX - rect.left) / rect.width) / 0.05) * 0.05))
  }

  const onHandleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    const onMove = (ev: MouseEvent) => setForm(f => ({ ...f, read_ratio: calcRatio(ev.clientX) }))
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const load = async () => {
    try { setSchedules(await getSchedules()) }
    catch { setError('Failed to load schedules') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const activeCron = humanToCron(form.human)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      await createSchedule({ name: form.name, cron_expression: activeCron, scenario: form.scenario, inject_defect: form.inject_defect, read_ratio: form.read_ratio })
      setForm(defaultForm); setShowForm(false)
      await load()
    } catch { setError('Failed to create schedule.') }
    finally { setSaving(false) }
  }

  const handleToggle = async (sched: Schedule) => {
    try { await updateSchedule(sched.id, { enabled: !sched.enabled }); await load() }
    catch { setError('Failed to update.') }
  }

  const handleDelete = async (id: number) => {
    try { await deleteSchedule(id); await load() }
    catch { setError('Failed to delete.') }
    finally { setConfirmDeleteId(null) }
  }

  const h = form.human
  const setH = (patch: Partial<HumanSchedule>) => setForm(f => ({ ...f, human: { ...f.human, ...patch } }))

  return (
    <div>
      {/* Page header */}
      <div className="bg-white border-b border-slate-200 px-8 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Schedules</h1>
            <p className="text-sm text-slate-500 mt-0.5">Automate workload runs on a recurring schedule</p>
          </div>
          <button
            onClick={() => { setShowForm(!showForm); setError(null) }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Schedule
          </button>
        </div>
      </div>

      <div className="px-8 py-6 space-y-5">
        {error && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        {/* ── Create Form ── */}
        {showForm && (
          <form onSubmit={handleCreate} className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">New Schedule</h2>
              <button type="button" onClick={() => { setShowForm(false); setForm(defaultForm) }} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Name</label>
                <input
                  required value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Daily regression"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                />
              </div>

              {/* ── Human builder ── */}
              <div className="bg-slate-50 rounded-lg border border-slate-200 p-5 space-y-4">
                  {/* Frequency type */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Run</label>
                    <div className="flex flex-wrap gap-2">
                      {([
                        { key: 'minutes', label: 'Every N minutes' },
                        { key: 'hours',   label: 'Every N hours'   },
                        { key: 'daily',   label: 'Daily'           },
                        { key: 'weekly',  label: 'Weekly'          },
                      ] as { key: FreqType; label: string }[]).map(opt => (
                        <button key={opt.key} type="button" onClick={() => setH({ freq: opt.key })}
                          className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                            h.freq === opt.key ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300 bg-white'
                          }`}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Interval (minutes / hours) */}
                  {(h.freq === 'minutes' || h.freq === 'hours') && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                        Every
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text" inputMode="numeric"
                          value={intervalRaw}
                          onChange={e => {
                            const raw = e.target.value.replace(/[^0-9]/g, '')
                            setIntervalRaw(raw)
                            const v = parseInt(raw)
                            if (!isNaN(v) && v >= 1) setH({ interval: Math.min(h.freq === 'minutes' ? 59 : 23, v) })
                          }}
                          onBlur={() => {
                            const v = parseInt(intervalRaw)
                            const clamped = isNaN(v) || v < 1 ? 1 : Math.min(h.freq === 'minutes' ? 59 : 23, v)
                            setH({ interval: clamped })
                            setIntervalRaw(String(clamped))
                          }}
                          className="w-20 px-3 py-2 border border-slate-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                        />
                        <span className="text-sm text-slate-600">{h.freq === 'minutes' ? 'minutes' : 'hours'}</span>
                      </div>
                    </div>
                  )}

                  {/* Time picker (daily / weekly) */}
                  {(h.freq === 'daily' || h.freq === 'weekly') && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">At time</label>
                      <div className="flex items-center gap-2">
                        <select value={h.hour} onChange={e => setH({ hour: parseInt(e.target.value) })}
                          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
                          {Array.from({ length: 24 }, (_, i) => (
                            <option key={i} value={i}>
                              {i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}
                            </option>
                          ))}
                        </select>
                        <span className="text-slate-400">:</span>
                        <select value={h.minute} onChange={e => setH({ minute: parseInt(e.target.value) })}
                          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
                          {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(m => (
                            <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Weekday (weekly) */}
                  {h.freq === 'weekly' && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">On day</label>
                      <div className="flex flex-wrap gap-2">
                        {DAYS.map((day, i) => (
                          <button key={i} type="button" onClick={() => setH({ weekday: i })}
                            className={`px-3 py-1.5 rounded-lg border-2 text-xs font-semibold transition-all ${
                              h.weekday === i ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300 bg-white'
                            }`}>
                            {day.slice(0, 3)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Preview */}
                  <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 rounded-lg px-4 py-2.5 border border-blue-100">
                    <svg className="w-4 h-4 flex-shrink-0 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-medium">{describeCron(humanToCron(h))}</span>
                    <span className="text-blue-400 font-mono text-xs ml-auto">{humanToCron(h)}</span>
                  </div>
                </div>

              {/* Scenario + options row */}
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Scenario</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['smoke', 'regression', 'stress'] as const).map(s => (
                      <button key={s} type="button" onClick={() => setForm({ ...form, scenario: s })}
                        className={`py-2 px-3 rounded-lg border-2 text-xs font-semibold capitalize transition-all ${
                          form.scenario === s ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Options</label>
                  <div className="flex items-center justify-between py-2 px-4 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-sm text-slate-700">Inject Defect</span>
                    <button type="button" onClick={() => setForm({ ...form, inject_defect: !form.inject_defect })}
                      className={`relative w-10 h-5 rounded-full transition-colors ${form.inject_defect ? 'bg-blue-600' : 'bg-slate-200'}`}>
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.inject_defect ? 'translate-x-5' : ''}`} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Read ratio */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Read / Write Ratio</label>
                  <div className="flex items-center gap-3 text-xs font-semibold tabular-nums">
                    <span className="text-blue-600">{Math.round(form.read_ratio * 100)}% reads</span>
                    <span className="text-slate-300">/</span>
                    <span className="text-orange-500">{Math.round((1 - form.read_ratio) * 100)}% writes</span>
                  </div>
                </div>
                <div ref={trackRef} className="relative h-7 flex items-center cursor-pointer select-none"
                  onClick={e => setForm(f => ({ ...f, read_ratio: calcRatio(e.clientX) }))}>
                  <div className="w-full h-2.5 rounded-full overflow-hidden flex shadow-inner">
                    <div className="bg-blue-500 transition-all duration-75" style={{ width: `${form.read_ratio * 100}%` }} />
                    <div className="bg-orange-400 flex-1" />
                  </div>
                  <div
                    className="absolute w-3.5 h-3.5 bg-white rounded-full border-2 border-slate-300 shadow-md cursor-grab hover:scale-110 hover:border-blue-500 transition-all z-10"
                    style={{ left: `calc(${form.read_ratio * 100}% - 7px)` }}
                    onMouseDown={onHandleMouseDown}
                    onClick={e => e.stopPropagation()}
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
              <button type="submit" disabled={saving}
                className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm">
                {saving ? 'Saving...' : 'Create Schedule'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setForm(defaultForm) }}
                className="px-5 py-2 bg-white border border-slate-200 text-slate-600 text-sm rounded-lg hover:bg-slate-50">
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* ── Table ── */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-x-auto">
          {loading ? (
            <div className="px-6 py-12 text-center text-slate-400 text-sm">Loading...</div>
          ) : schedules.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-600 mb-1">No schedules yet</p>
              <p className="text-xs text-slate-400">Add a schedule to automate workload runs</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  {['Name', 'Schedule', 'Scenario', 'Read %', 'Defect', 'Next Run', 'Time Remaining', 'Last Run', 'Enabled', ''].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {schedules.map(sched => {
                  const next = sched.next_run_at ? new Date(sched.next_run_at) : nextRunFromNow(sched.cron_expression)
                  const remaining = formatTimeRemaining(next, now)
                  const isImminent = next && (next.getTime() - now) < 10 * 60 * 1000 // < 10 min

                  return (
                    <tr key={sched.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-4 text-sm font-semibold text-slate-800">{sched.name}</td>
                      <td className="px-5 py-4 text-sm text-slate-700">{describeCron(sched.cron_expression)}</td>
                      <td className="px-5 py-4 text-sm text-slate-700 capitalize font-medium">{sched.scenario}</td>
                      <td className="px-5 py-4 text-sm text-slate-600 tabular-nums">{Math.round(sched.read_ratio * 100)}%</td>
                      <td className="px-5 py-4">
                        {sched.inject_defect
                          ? <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full ring-1 ring-amber-200">On</span>
                          : <span className="text-xs text-slate-400">Off</span>}
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-500 whitespace-nowrap">
                        {next ? next.toLocaleString() : '—'}
                      </td>
                      <td className="px-5 py-4">
                        {sched.enabled && next ? (
                          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold tabular-nums px-2.5 py-1 rounded-full ${
                            isImminent ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {isImminent && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
                            {remaining}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-400 whitespace-nowrap">
                        {sched.last_run_at ? new Date(sched.last_run_at).toLocaleString() : '—'}
                      </td>
                      <td className="px-5 py-4">
                        <button onClick={() => handleToggle(sched)}
                          className={`relative w-10 h-5 rounded-full transition-colors ${sched.enabled ? 'bg-blue-600' : 'bg-slate-200'}`}>
                          <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${sched.enabled ? 'translate-x-5' : ''}`} />
                        </button>
                      </td>
                      <td className="px-5 py-4">
                        <button
                          onClick={async () => {
                            try {
                              const r = await runScheduleNow(sched.id)
                              navigate(`/runs/${r.id}`)
                            } catch { setError('Failed to start run.') }
                          }}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors mr-4"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Run Now
                        </button>
                        <button onClick={() => setConfirmDeleteId(sched.id)}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-700 transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {confirmDeleteId !== null && (
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
                <p className="text-sm font-semibold text-slate-900">Delete schedule</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {schedules.find(s => s.id === confirmDeleteId)?.name ?? 'This schedule'} will be permanently removed.
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2 text-sm font-medium bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button onClick={() => handleDelete(confirmDeleteId)}
                className="px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-sm">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
