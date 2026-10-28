import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { BarChart3, ClipboardList, Flame, LayoutDashboard, LogOut, Menu, PlusCircle, ShieldCheck, Users } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import api from '../api'
import { Avatar } from './ui'

const TITLES = {
  '/app': 'Dashboard',
  '/app/report': 'Report an Issue',
  '/app/complaints': 'Complaints',
  '/app/performance': 'Department Performance',
  '/app/escalations': 'Escalation Center',
  '/app/staff': 'Staff Management',
}

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [escCount, setEscCount] = useState(0)
  const staff = ['official', 'admin'].includes(user.role)

  useEffect(() => setOpen(false), [pathname])
  useEffect(() => {
    if (staff) api.get('/api/escalations').then((r) => setEscCount(r.data.complaints.length)).catch(() => {})
  }, [staff, pathname])

  const complaintsLabel = { citizen: 'My Complaints', worker: 'My Tasks' }[user.role] || 'All Complaints'
  const title = TITLES[pathname] || (pathname.startsWith('/app/complaints/') ? 'Complaint Details' : 'CivicFix')

  return (
    <div className="shell">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-logo"><ShieldCheck size={22} color="#fff" /></div>
          <div>
            <div className="brand-name">CivicFix</div>
            <div className="brand-tag">Report · Track · Resolve</div>
          </div>
        </div>

        <div className="nav-section">Menu</div>
        <NavLink end to="/app" className="nav-link"><LayoutDashboard size={18} /> Dashboard</NavLink>
        {['citizen', 'admin'].includes(user.role) && (
          <NavLink to="/app/report" className="nav-link"><PlusCircle size={18} /> Report Issue</NavLink>
        )}
        <NavLink to="/app/complaints" className="nav-link"><ClipboardList size={18} /> {complaintsLabel}</NavLink>
        {staff && (
          <NavLink to="/app/escalations" className="nav-link">
            <Flame size={18} /> Escalations {escCount > 0 && <span className="nav-badge">{escCount}</span>}
          </NavLink>
        )}
        <NavLink to="/app/performance" className="nav-link"><BarChart3 size={18} /> Performance</NavLink>
        {user.role === 'admin' && (
          <>
            <div className="nav-section">Admin</div>
            <NavLink to="/app/staff" className="nav-link"><Users size={18} /> Staff</NavLink>
          </>
        )}

        <div className="sidebar-foot">
          <div className="user-chip">
            <Avatar name={user.name} size="sm" />
            <div style={{ minWidth: 0 }}>
              <div className="name">{user.name}</div>
              <div className="role">{user.role}{user.department ? ` · ${user.department}` : ''}</div>
            </div>
            <button className="icon-btn" title="Log out" onClick={() => { logout(); navigate('/login') }}>
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="menu-btn" onClick={() => setOpen(true)}><Menu /></button>
          <h1>{title}</h1>
          <div className="spacer" />
          {['citizen', 'admin'].includes(user.role) && pathname !== '/app/report' && (
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/app/report')}>
              <PlusCircle size={16} /> New Complaint
            </button>
          )}
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
