interface Props {
  label: string
  value: string | number | null
  unit?: string
  highlight?: 'green' | 'red' | 'blue' | 'default'
}

const accentBar = {
  green: 'bg-emerald-500',
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  default: 'bg-slate-300',
}

const valueColor = {
  green: 'text-emerald-600',
  red: 'text-red-600',
  blue: 'text-blue-600',
  default: 'text-slate-800',
}

export default function MetricCard({ label, value, unit, highlight = 'default' }: Props) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
      <div className={`h-0.5 ${accentBar[highlight]}`} />
      <div className="p-5">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{label}</p>
        <p className={`text-2xl font-bold ${valueColor[highlight]} tabular-nums`}>
          {value === null || value === undefined ? '—' : value}
          {unit && <span className="text-sm font-normal text-slate-400 ml-1">{unit}</span>}
        </p>
      </div>
    </div>
  )
}
