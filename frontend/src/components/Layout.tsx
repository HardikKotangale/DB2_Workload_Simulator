import { useEffect, useState } from 'react'
import { NavLink, Link, Outlet, useLocation } from 'react-router-dom'
import { getHealth } from '../api/client'

const navItems = [
  {
    to: '/dashboard', label: 'Dashboard', exact: true,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    to: '/runs/new', label: 'New Run', exact: false,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    to: '/runs', label: 'History', exact: false,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    to: '/compare', label: 'Compare', exact: false,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    to: '/schedules', label: 'Schedules', exact: false,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
]

export default function Layout() {
  const [db2Status, setDb2Status] = useState<'ok' | 'unreachable' | 'checking'>('checking')
  const location = useLocation()

  useEffect(() => {
    const check = async () => {
      try {
        const health = await getHealth()
        setDb2Status(health.db2 === 'ok' ? 'ok' : 'unreachable')
      } catch {
        setDb2Status('unreachable')
      }
    }
    check()
    const interval = setInterval(check, 10000)
    return () => clearInterval(interval)
  }, [])

  const isActive = (item: typeof navItems[0]) => {
    if (item.to === '/dashboard') return location.pathname === '/dashboard'
    if (item.to === '/runs') {
      // Active on /runs and /runs/:id but NOT /runs/new
      return location.pathname.startsWith('/runs') && !location.pathname.startsWith('/runs/new')
    }
    return location.pathname.startsWith(item.to)
  }

  return (
    <div className="flex h-full min-h-screen bg-slate-50">
      {/* Sidebar — icon-only with tooltip */}
      <aside className="w-14 bg-slate-950 flex flex-col flex-shrink-0 border-r border-slate-800">
        {/* Logo mark */}
        <div className="flex items-center justify-center h-14 border-b border-slate-800 flex-shrink-0">
          <Link to="/" className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center hover:bg-blue-500 transition-colors" title="Home">
            <svg className="w-4.5 h-4.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: 18, height: 18 }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7C5 4 4 5 4 7z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 9h16M4 15h16" />
            </svg>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 flex flex-col items-center py-3 gap-1">
          {navItems.map(item => {
            const active = isActive(item)
            return (
              <div key={item.to} className="relative group w-full flex justify-center">
                <NavLink
                  to={item.to}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    active
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                      : 'text-slate-500 hover:bg-slate-800 hover:text-slate-100'
                  }`}
                >
                  {item.icon}
                </NavLink>
                {/* Tooltip */}
                <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  <div className="bg-slate-800 text-white text-xs font-medium px-3 py-1.5 rounded-full whitespace-nowrap shadow-xl border border-slate-700">
                    {item.label}
                  </div>
                </div>
              </div>
            )
          })}
        </nav>

        {/* DB2 status dot */}
        <div className="flex items-center justify-center h-12 border-t border-slate-800 flex-shrink-0">
          <div className="relative group">
            <span
              className={`w-2.5 h-2.5 rounded-full block ${
                db2Status === 'ok' ? 'bg-emerald-400' : db2Status === 'unreachable' ? 'bg-red-400' : 'bg-amber-400 animate-pulse'
              }`}
            />
            <div className="pointer-events-none absolute left-full bottom-0 ml-3 z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
              <div className="bg-slate-800 text-white text-xs font-medium px-3 py-1.5 rounded-full whitespace-nowrap shadow-xl border border-slate-700">
                DB2 {db2Status === 'ok' ? 'Connected' : db2Status === 'unreachable' ? 'Unreachable' : 'Checking...'}
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
