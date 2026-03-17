import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { OpSummary } from '../api/client'

interface Props { opSummary: OpSummary[] }

export default function ErrorRateChart({ opSummary }: Props) {
  const data = opSummary
    .map(s => ({
      name: s.query_name.replace(/^[RW]\d+_/, ''),
      error_rate: s.count > 0 ? Math.round((s.fail_count / s.count) * 100) : 0,
      fail_count: s.fail_count,
    }))
    .sort((a, b) => b.error_rate - a.error_rate)

  if (data.length === 0) return null

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
      <h3 className="text-sm font-semibold text-slate-800 mb-4">Error Rate by Query</h3>
      <ResponsiveContainer width="100%" height={Math.max(160, data.length * 36)}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 100, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
          <XAxis type="number" unit="%" tick={{ fontSize: 11, fill: '#94a3b8' }} domain={[0, 100]} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} width={96} />
          <Tooltip formatter={(v: number, _: string, props) => [`${v}% (${props.payload.fail_count} fails)`, 'Error rate']} />
          <Bar dataKey="error_rate" radius={[0, 4, 4, 0]}>
            {data.map((d, i) => <Cell key={i} fill={d.error_rate > 0 ? '#ef4444' : '#10b981'} opacity={d.error_rate > 0 ? 1 : 0.5} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
