interface Props {
  status: string
}

const statusConfig: Record<string, { cls: string; dot: string; label: string }> = {
  running:   { cls: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',     dot: 'bg-blue-500 animate-pulse', label: 'Running'   },
  completed: { cls: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200', dot: 'bg-emerald-500',          label: 'Completed' },
  failed:    { cls: 'bg-red-50 text-red-700 ring-1 ring-red-200',         dot: 'bg-red-500',                label: 'Failed'    },
  cancelled: { cls: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',  dot: 'bg-slate-400',              label: 'Cancelled' },
}

export default function StatusBadge({ status }: Props) {
  const cfg = statusConfig[status] ?? { cls: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200', dot: 'bg-slate-400', label: status }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}
