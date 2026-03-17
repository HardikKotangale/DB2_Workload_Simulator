import { RunValidation } from '../api/client'

interface Props {
  validations: RunValidation[]
}

export default function ValidationTable({ validations }: Props) {
  if (validations.length === 0) {
    return <p className="text-slate-400 text-sm">No validation results available.</p>
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto shadow-sm">
      <table className="min-w-full divide-y divide-slate-100">
        <thead>
          <tr className="bg-slate-50">
            <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Test</th>
            <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Violations</th>
            <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Result</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {validations.map(v => (
            <tr key={v.id} className={`transition-colors ${v.passed ? 'hover:bg-slate-50' : 'bg-red-50/40 hover:bg-red-50'}`}>
              <td className="px-5 py-3.5 text-sm font-mono text-slate-700">{v.test_name}</td>
              <td className="px-5 py-3.5">
                <span className={`text-sm font-semibold tabular-nums ${v.result_value === 0 ? 'text-slate-400' : 'text-red-600'}`}>
                  {v.result_value}
                </span>
              </td>
              <td className="px-5 py-3.5">
                {v.passed ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    PASS
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 ring-1 ring-red-200">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    FAIL
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
