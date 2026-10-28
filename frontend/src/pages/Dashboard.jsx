import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowRight, CheckCircle2, ClipboardList, Flame, Hourglass, PlusCircle, Wrench } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import api from '../api'
import { useAuth } from '../context/AuthContext'
import ComplaintTable from '../components/ComplaintTable'
import { Empty, Loader, StatCard } from '../components/ui'
import { fmtDay } from '../utils'

const GREETING = {
  citizen: ['Make your neighbourhood better', 'Report an issue and track it until it’s fixed.'],
  worker: ['Your field tasks', 'Complaints assigned to you, sorted by most recent.'],
  official: ['Department control room', 'Assign workers, watch deadlines and act on escalations.'],
  admin: ['City-wide overview', 'Monitor every department and keep resolutions on track.'],
}

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [list, setList] = useState(null)
  const [trend, setTrend] = useState([])
  const [cats, setCats] = useState([])

  useEffect(() => {
    api.get('/api/complaints', { params: { page_size: 100 } }).then((r) => setList(r.data))
    api.get('/api/analytics/trends', { params: { days: 30 } }).then((r) => setTrend(r.data))
    api.get('/api/analytics/categories').then((r) => setCats(r.data))
  }, [])

  if (!list) return <Loader />
  const items = list.items
  const count = (fn) => items.filter(fn).length
  const isOpen = (c) => !['resolved', 'closed', 'rejected'].includes(c.status)
  const [title, sub] = GREETING[user.role]

  return (
    <div className="stack">
      <div className="hero-card fade-in">
        <div className="row between" style={{ position: 'relative', zIndex: 1 }}>
          <div>
            <div className="small" style={{ opacity: .8, fontWeight: 600 }}>Hello, {user.name.split(' ')[0]} 👋</div>
            <h2>{title}</h2>
            <p>{sub}</p>
          </div>
          {['citizen', 'admin'].includes(user.role) ? (
            <button className="btn btn-lg" onClick={() => navigate('/app/report')}><PlusCircle size={18} /> Report an issue</button>
          ) : (
            <button className="btn btn-lg" onClick={() => navigate('/app/complaints')}>View queue <ArrowRight size={18} /></button>
          )}
        </div>
      </div>

      <div className="grid grid-4">
        <StatCard icon={ClipboardList} label={user.role === 'worker' ? 'Assigned to me' : 'Total complaints'} value={list.total} color="#4f46e5" />
        <StatCard icon={Hourglass} label="Open" value={count(isOpen)} color="#f59e0b" />
        <StatCard icon={CheckCircle2} label="Resolved" value={count((c) => ['resolved', 'closed'].includes(c.status))} color="#10b981" />
        <StatCard icon={user.role === 'citizen' ? AlertTriangle : Flame} label="Escalated / overdue"
          value={count((c) => isOpen(c) && (c.escalation_level > 0 || c.overdue))} color="#e11d48" />
      </div>

      <div className="grid grid-main">
        <div className="card">
          <div className="card-head">
            <h3>Activity — last 30 days</h3>
            <div className="row small muted">
              <span className="row" style={{ gap: 6 }}><span className="dot" style={{ width: 10, height: 10, borderRadius: 3, background: '#6366f1' }} /> Reported</span>
              <span className="row" style={{ gap: 6 }}><span className="dot" style={{ width: 10, height: 10, borderRadius: 3, background: '#10b981' }} /> Resolved</span>
            </div>
          </div>
          <div className="card-body" style={{ height: 290 }}>
            <ResponsiveContainer>
              <AreaChart data={trend} margin={{ left: -20, right: 6 }}>
                <defs>
                  <linearGradient id="gRep" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6366f1" stopOpacity={.35} /><stop offset="1" stopColor="#6366f1" stopOpacity={0} /></linearGradient>
                  <linearGradient id="gRes" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#10b981" stopOpacity={.3} /><stop offset="1" stopColor="#10b981" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef1f6" vertical={false} />
                <XAxis dataKey="date" tickFormatter={fmtDay} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} minTickGap={24} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip labelFormatter={fmtDay} contentStyle={{ borderRadius: 12, border: '1px solid #e6e9f2' }} />
                <Area type="monotone" dataKey="reported" name="Reported" stroke="#6366f1" strokeWidth={2.5} fill="url(#gRep)" />
                <Area type="monotone" dataKey="resolved" name="Resolved" stroke="#10b981" strokeWidth={2.5} fill="url(#gRes)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h3>By category</h3></div>
          <div className="card-body">
            <div style={{ height: 180 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={cats} dataKey="total" nameKey="label" innerRadius={52} outerRadius={80} paddingAngle={3} stroke="none">
                    {cats.map((c) => <Cell key={c.category} fill={c.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="stack" style={{ gap: 8, marginTop: 10 }}>
              {cats.map((c) => (
                <div key={c.category} className="row between small">
                  <span className="row" style={{ gap: 8 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: c.color }} />{c.label}</span>
                  <span className="bold">{c.total}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>{user.role === 'worker' ? <><Wrench size={16} /> My latest tasks</> : 'Recent complaints'}</h3>
          <Link to="/app/complaints" className="btn btn-ghost btn-sm">View all <ArrowRight size={14} /></Link>
        </div>
        {items.length ? (
          <ComplaintTable items={items.slice(0, 8)} showDept={user.role !== 'official'} />
        ) : (
          <Empty title="Nothing here yet" text={user.role === 'citizen' ? 'Your reported issues will show up here.' : 'No complaints in your queue.'}
            action={user.role === 'citizen' && <Link to="/app/report" className="btn btn-primary">Report your first issue</Link>} />
        )}
      </div>
    </div>
  )
}
