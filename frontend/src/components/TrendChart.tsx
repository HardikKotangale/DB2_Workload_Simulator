import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'
import { TrendPoint } from '../api/client'

interface Props { data: TrendPoint[] }

export default function TrendChart({ data }: Props) {
  const chartData = data.map(d => ({
    label: d.id.slice(9, 15), // HH:MM:SS portion
    scenario: d.scenario,
    duration_s: d.duration_s,
    pass: d.validation_passed === true ? 1 : d.validation_passed === false ? 0 : null,
    passed: d.validation_passed,
  }))

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-800">Historical Trend</h3>
        <span className="text-xs text-slate-400">Last {data.length} completed runs</span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} />
          <YAxis yAxisId="left" unit="s" tick={{ fontSize: 11, fill: '#94a3b8' }} width={40} />
          <YAxis yAxisId="right" orientation="right" domain={[0, 1]} tickCount={2}
            tickFormatter={v => v === 1 ? 'PASS' : 'FAIL'} tick={{ fontSize: 10, fill: '#94a3b8' }} width={36} />
          <Tooltip
            formatter={(value: number, name: string) => {
              if (name === 'Duration') return [`${value}s`, name]
              if (name === 'Validation') return [value === 1 ? 'PASS' : 'FAIL', name]
              return [value, name]
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar yAxisId="right" dataKey="pass" name="Validation" radius={[3, 3, 0, 0]}>
            {chartData.map((d, i) => (
              <Cell key={i} fill={d.passed === true ? '#10b981' : d.passed === false ? '#ef4444' : '#e2e8f0'} opacity={0.7} />
            ))}
          </Bar>
          <Line yAxisId="left" type="monotone" dataKey="duration_s" name="Duration" stroke="#6366f1" dot={false} strokeWidth={2} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
