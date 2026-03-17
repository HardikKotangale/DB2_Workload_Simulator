import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { OpSummary } from '../api/client'

interface Props { opSummary: OpSummary[] }

export default function ReadWriteDonut({ opSummary }: Props) {
  const reads = opSummary.filter(s => s.type === 'READ').reduce((a, s) => a + s.count, 0)
  const writes = opSummary.filter(s => s.type === 'WRITE').reduce((a, s) => a + s.count, 0)
  if (reads + writes === 0) return null
  const data = [
    { name: 'READ', value: reads },
    { name: 'WRITE', value: writes },
  ]
  const COLORS = ['#6366f1', '#f97316']

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
      <h3 className="text-sm font-semibold text-slate-800 mb-4">Read / Write Split</h3>
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={45} outerRadius={72} dataKey="value" paddingAngle={2}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
          </Pie>
          <Tooltip formatter={(v: number) => `${v} ops`} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
