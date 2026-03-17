import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { RunMetrics } from '../api/client'

interface Props {
  metricsA: RunMetrics
  metricsB: RunMetrics
  labelA: string
  labelB: string
}

export default function CompareChart({ metricsA, metricsB, labelA, labelB }: Props) {
  const afterA = metricsA.after
  const afterB = metricsB.after

  if (!afterA || !afterB) {
    return <p className="text-slate-400 text-sm">Metrics not yet available for one or both runs.</p>
  }

  const data = [
    {
      metric: 'p50',
      [labelA]: afterA.p50_ms,
      [labelB]: afterB.p50_ms,
    },
    {
      metric: 'p95',
      [labelA]: afterA.p95_ms,
      [labelB]: afterB.p95_ms,
    },
    {
      metric: 'avg',
      [labelA]: afterA.avg_ms,
      [labelB]: afterB.avg_ms,
    },
  ]

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
      <h3 className="text-base font-semibold text-slate-800 mb-4">
        Performance Comparison (After Indexes)
      </h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="metric" tick={{ fontSize: 13 }} />
          <YAxis unit="ms" tick={{ fontSize: 12 }} />
          <Tooltip formatter={(v: number) => `${v} ms`} />
          <Legend />
          <Bar dataKey={labelA} fill="#6366f1" radius={[4, 4, 0, 0]} />
          <Bar dataKey={labelB} fill="#f59e0b" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
