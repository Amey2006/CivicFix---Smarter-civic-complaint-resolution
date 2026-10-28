import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Landing from './pages/Landing'
import { Login, Register } from './pages/Auth'
import Dashboard from './pages/Dashboard'
import ReportIssue from './pages/ReportIssue'
import Complaints from './pages/Complaints'
import ComplaintDetail from './pages/ComplaintDetail'
import Performance from './pages/Performance'
import Escalations from './pages/Escalations'
import Staff from './pages/Staff'

function Protected({ roles, children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="page-loader"><div className="spinner" /></div>
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/app" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/app" element={<Protected><Layout /></Protected>}>
        <Route index element={<Dashboard />} />
        <Route path="report" element={<Protected roles={['citizen', 'admin']}><ReportIssue /></Protected>} />
        <Route path="complaints" element={<Complaints />} />
        <Route path="complaints/:id" element={<ComplaintDetail />} />
        <Route path="performance" element={<Performance />} />
        <Route path="escalations" element={<Protected roles={['official', 'admin']}><Escalations /></Protected>} />
        <Route path="staff" element={<Protected roles={['admin']}><Staff /></Protected>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
