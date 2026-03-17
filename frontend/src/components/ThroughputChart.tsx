import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { ThroughputBucket } from '../api/client'

interface Props { data: ThroughputBucket[] }

export default function ThroughputChart({ data }: Props) {
  if (data.length === 0) return null
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
      <h3 className="text-sm font-semibold text-slate-800 mb-4">Throughput Over Time</h3>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <defs>
            <linearGradient id="gradOps" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradFail" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="t" unit="s" tick={{ fontSize: 10, fill: '#94a3b8' }} />
          <YAxis unit=" ops/s" tick={{ fontSize: 11, fill: '#94a3b8' }} width={52} />
          <Tooltip formatter={(v: number, name: string) => [`${v} ops/s`, name]} labelFormatter={l => `+${l}s`} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area type="monotone" dataKey="ops_per_sec" name="Total ops/s" stroke="#6366f1" strokeWidth={2} fill="url(#gradOps)" />
          <Area type="monotone" dataKey="fail_per_sec" name="Fail ops/s" stroke="#ef4444" strokeWidth={1.5} fill="url(#gradFail)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
