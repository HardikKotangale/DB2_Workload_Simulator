import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Landing from './pages/Landing'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import NewRun from './pages/NewRun'
import RunDetails from './pages/RunDetails'
import History from './pages/History'
import RunComparison from './pages/RunComparison'
import Schedules from './pages/Schedules'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Landing page — own layout with top navbar */}
        <Route path="/" element={<Landing />} />

        {/* App — sidebar layout */}
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/runs/new" element={<NewRun />} />
          <Route path="/runs/:id" element={<RunDetails />} />
          <Route path="/runs" element={<History />} />
          <Route path="/compare" element={<RunComparison />} />
          <Route path="/schedules" element={<Schedules />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
