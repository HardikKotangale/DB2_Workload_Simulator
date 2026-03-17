import { Link } from 'react-router-dom'

const features = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: 'Workload Simulation',
    desc: 'Run smoke, regression, or stress scenarios with configurable read/write ratios across hundreds of rounds against a live IBM DB2 instance.',
    color: 'bg-blue-50 text-blue-600',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    title: 'Performance Benchmarking',
    desc: 'Automatically benchmark p50, p95, and average query latency before and after index application to measure real-world performance gains.',
    color: 'bg-violet-50 text-violet-600',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: 'Data Validation',
    desc: 'Seven built-in integrity tests (negative totals, orphaned records, duplicate emails, zero-total orders, and more) run automatically after every workload.',
    color: 'bg-emerald-50 text-emerald-600',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    title: 'Real-Time Log Streaming',
    desc: 'Watch your workload execute live via WebSocket-powered log streaming. Progress bar, round counter, and structured log levels — all in the browser.',
    color: 'bg-amber-50 text-amber-600',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    title: 'Scheduled Runs',
    desc: 'Create cron-based schedules to run workloads automatically — every hour, every night, or any custom interval. Enable or disable with a single toggle.',
    color: 'bg-sky-50 text-sky-600',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
      </svg>
    ),
    title: 'Run Comparison',
    desc: 'Select any two completed runs to compare side-by-side: p50/p95/avg latency diff tables, grouped bar charts, and validation results in parallel.',
    color: 'bg-orange-50 text-orange-600',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    title: 'Defect Injection & Fix',
    desc: 'Deliberately inject schema defects (negative-total orders) and then apply CHECK constraints to demonstrate how validation catches and fixes data issues.',
    color: 'bg-red-50 text-red-600',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
    ),
    title: 'CSV & PDF Export',
    desc: 'Download every run as a structured CSV (all operations + SQL text) or a formatted PDF report with summary table, benchmark results, and validation status.',
    color: 'bg-teal-50 text-teal-600',
  },
]

const steps = [
  {
    n: '01',
    title: 'Configure your run',
    desc: 'Choose a scenario (smoke / regression / stress), set your read/write ratio, toggle defect injection, and optionally add a delay between rounds.',
  },
  {
    n: '02',
    title: 'Watch it execute live',
    desc: 'The dashboard streams logs in real time via WebSocket. A progress bar tracks rounds completed. Stop the run any time from the UI.',
  },
  {
    n: '03',
    title: 'Analyze the results',
    desc: 'Explore performance charts, throughput over time, read/write donut, error-rate bars, and the full validation pass/fail table — all on one page.',
  },
  {
    n: '04',
    title: 'Compare & export',
    desc: 'Compare any two runs side-by-side to spot regressions or improvements. Download a PDF report or raw CSV for offline analysis.',
  },
]

const techStack = [
  { name: 'IBM DB2', role: 'Target database' },
  { name: 'FastAPI', role: 'REST + WebSocket backend' },
  { name: 'SQLite', role: 'Run history & metrics' },
  { name: 'APScheduler', role: 'Cron scheduling' },
  { name: 'React 18', role: 'Frontend UI' },
  { name: 'Recharts', role: 'Charts & visualisations' },
  { name: 'Tailwind CSS', role: 'Styling' },
  { name: 'Docker', role: 'Container orchestration' },
]

export default function Landing() {
  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">

      {/* ── Top Navbar ───────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: 18, height: 18 }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7C5 4 4 5 4 7z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 9h16M4 15h16" />
              </svg>
            </div>
            <span className="font-semibold text-slate-900 text-sm tracking-tight">DB2 Workload Simulator</span>
          </div>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-6">
            {[
              { label: 'Features', href: '#features' },
              { label: 'How it works', href: '#how-it-works' },
              { label: 'Tech stack', href: '#tech' },
            ].map(l => (
              <a key={l.href} href={l.href} className="text-sm text-slate-500 hover:text-slate-900 transition-colors font-medium">
                {l.label}
              </a>
            ))}
          </nav>

          {/* CTA */}
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            Open Dashboard
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-full text-xs font-semibold text-blue-700 mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
          IBM DB2 · Real-time workload testing
        </div>
        <h1 className="text-5xl font-bold text-slate-900 leading-tight tracking-tight mb-6 max-w-3xl mx-auto">
          Simulate, benchmark, and validate
          <span className="text-blue-600"> DB2 workloads</span> — visually
        </h1>
        <p className="text-lg text-slate-500 max-w-2xl mx-auto mb-10 leading-relaxed">
          A full-stack observability platform for IBM DB2. Trigger mixed read/write workloads from a web UI,
          stream live logs, measure index impact, run data integrity checks, and schedule recurring tests — all in one place.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-md text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Launch the Dashboard
          </Link>
          <Link
            to="/runs/new"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-colors text-sm"
          >
            Start a new run
          </Link>
        </div>
      </section>

      {/* ── Stats strip ──────────────────────────────────────────────────── */}
      <section className="border-y border-slate-100 bg-slate-50">
        <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: '3', label: 'Scenarios', sub: 'Smoke · Regression · Stress' },
            { value: '7', label: 'Validation tests', sub: 'Integrity checks per run' },
            { value: '5', label: 'Chart types', sub: 'Live insights per run' },
            { value: '2', label: 'Export formats', sub: 'CSV and PDF' },
          ].map(s => (
            <div key={s.label}>
              <div className="text-3xl font-bold text-blue-600 tabular-nums">{s.value}</div>
              <div className="text-sm font-semibold text-slate-800 mt-1">{s.label}</div>
              <div className="text-xs text-slate-400 mt-0.5">{s.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight mb-3">Everything you need to test DB2</h2>
          <p className="text-slate-500 max-w-xl mx-auto text-sm leading-relaxed">
            From one-click workload execution to automated scheduling and PDF reporting — the full lifecycle is covered.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map(f => (
            <div key={f.title} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md hover:border-slate-300 transition-all group">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${f.color}`}>
                {f.icon}
              </div>
              <h3 className="text-sm font-semibold text-slate-900 mb-1.5">{f.title}</h3>
              <p className="text-xs text-slate-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section id="how-it-works" className="bg-slate-950 py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-white tracking-tight mb-3">How it works</h2>
            <p className="text-slate-400 max-w-xl mx-auto text-sm leading-relaxed">
              From clicking "Start Run" to downloading a PDF report — four steps.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {steps.map((s, i) => (
              <div key={s.n} className="relative">
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-7 left-full w-full h-px bg-gradient-to-r from-slate-700 to-transparent z-0" />
                )}
                <div className="relative z-10 bg-slate-900 border border-slate-800 rounded-xl p-6 h-full">
                  <div className="text-2xl font-bold text-blue-500 tabular-nums mb-3">{s.n}</div>
                  <h3 className="text-sm font-semibold text-white mb-2">{s.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Scenario comparison ──────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight mb-3">Three scenarios, one click</h2>
          <p className="text-slate-500 max-w-xl mx-auto text-sm leading-relaxed">
            Pick the right intensity for your testing goal — from a quick sanity check to a full stress test.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              name: 'Smoke',
              rounds: 15,
              color: 'border-emerald-300 bg-emerald-50',
              badge: 'bg-emerald-100 text-emerald-700',
              desc: 'A lightweight 15-round sanity check. Confirms DB2 connectivity, schema health, and basic query execution in under a minute.',
              use: 'CI/CD gate · Post-deploy check',
            },
            {
              name: 'Regression',
              rounds: 80,
              color: 'border-blue-300 bg-blue-50',
              badge: 'bg-blue-100 text-blue-700',
              desc: '80 rounds of mixed read/write operations — the standard validation suite for catching schema regressions and measuring index impact.',
              use: 'Nightly runs · Pre-release validation',
            },
            {
              name: 'Stress',
              rounds: 300,
              color: 'border-red-300 bg-red-50',
              badge: 'bg-red-100 text-red-700',
              desc: '300 rounds at high concurrency. Pushes DB2 log space, connection pooling, and lock contention to expose issues under sustained load.',
              use: 'Capacity testing · Performance tuning',
            },
          ].map(s => (
            <div key={s.name} className={`rounded-xl border-2 p-6 ${s.color}`}>
              <div className="flex items-center justify-between mb-4">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${s.badge}`}>{s.name}</span>
                <span className="text-xs font-semibold text-slate-500 tabular-nums">{s.rounds} rounds</span>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed mb-4">{s.desc}</p>
              <div className="text-xs text-slate-500 font-medium border-t border-slate-200 pt-3">{s.use}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Tech stack ───────────────────────────────────────────────────── */}
      <section id="tech" className="bg-slate-50 border-y border-slate-200 py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">Built on proven open-source</h2>
            <p className="text-slate-500 text-sm">No proprietary lock-in. Every layer is replaceable.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-3">
            {techStack.map(t => (
              <div key={t.name} className="bg-white rounded-xl border border-slate-200 px-3 py-4 text-center hover:shadow-sm transition-shadow">
                <div className="text-sm font-semibold text-slate-800">{t.name}</div>
                <div className="text-xs text-slate-400 mt-1 leading-tight">{t.role}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ───────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-24 text-center">
        <h2 className="text-4xl font-bold text-slate-900 tracking-tight mb-4">Ready to run your first workload?</h2>
        <p className="text-slate-500 mb-10 max-w-lg mx-auto text-sm leading-relaxed">
          Open the dashboard, pick a scenario, and click Start Run. Your first results — with live logs, charts, and validation results — will be ready in seconds.
        </p>
        <Link
          to="/runs/new"
          className="inline-flex items-center gap-2 px-8 py-3.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-lg text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Start your first run
        </Link>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center">
              <svg className="text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: 13, height: 13 }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7C5 4 4 5 4 7z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 9h16M4 15h16" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-slate-700">DB2 Workload Simulator</span>
          </div>
          <nav className="flex items-center gap-5">
            {[
              { to: '/dashboard', label: 'Dashboard' },
              { to: '/runs/new', label: 'New Run' },
              { to: '/runs', label: 'History' },
              { to: '/schedules', label: 'Schedules' },
            ].map(l => (
              <Link key={l.to} to={l.to} className="text-xs text-slate-500 hover:text-slate-800 transition-colors font-medium">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>

    </div>
  )
}
