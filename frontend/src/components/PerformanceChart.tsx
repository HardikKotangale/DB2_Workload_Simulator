import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { PerfMetrics } from '../api/client'

interface Props {
  before: PerfMetrics
  after: PerfMetrics
}

export default function PerformanceChart({ before, after }: Props) {
  const data = [
    { metric: 'p50', before: before.p50_ms, after: after.p50_ms },
    { metric: 'p95', before: before.p95_ms, after: after.p95_ms },
    { metric: 'avg', before: before.avg_ms, after: after.avg_ms },
  ]

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
      <h3 className="text-base font-semibold text-slate-800 mb-4">
        Performance: Before vs After Indexes
      </h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="metric" tick={{ fontSize: 13 }} />
          <YAxis unit="ms" tick={{ fontSize: 12 }} />
          <Tooltip formatter={(v: number) => `${v} ms`} />
          <Legend />
          <Bar dataKey="before" name="Before Indexes" fill="#6366f1" radius={[4, 4, 0, 0]} />
          <Bar dataKey="after" name="After Indexes" fill="#22c55e" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
