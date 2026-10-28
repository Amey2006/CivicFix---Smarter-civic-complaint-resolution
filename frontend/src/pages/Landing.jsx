import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BarChart3, Camera, Flame, MapPin, ShieldCheck, Sparkles, Timer, Users } from 'lucide-react'
import api from '../api'
import { useAuth } from '../context/AuthContext'

const FEATURES = [
  [Camera, '#818cf8', 'Report in seconds', 'Pick a category, add photos and the exact location. Smart forms ask only what matters for that issue.'],
  [Users, '#22d3ee', 'Routed to the right team', 'Every complaint goes straight to the responsible department, where officials assign field workers.'],
  [Timer, '#fbbf24', 'Deadlines that count', 'Each department has a resolution SLA. Every deadline and status change is tracked and visible.'],
  [Flame, '#fb7185', 'Automatic escalation', 'Missed deadlines escalate automatically: Department Head → Commissioner → Mayor’s Office.'],
  [BarChart3, '#34d399', 'Public scorecards', 'Department-wise resolution rates, SLA compliance and grades keep the city accountable.'],
  [MapPin, '#c084fc', 'Full transparency', 'Follow progress live with a timeline, discussion thread, inspection notes and before/after photos.'],
]

export default function Landing() {
  const { user } = useAuth()
  const [stats, setStats] = useState(null)
  const [depts, setDepts] = useState([])

  useEffect(() => {
    api.get('/api/analytics/overview').then((r) => setStats(r.data)).catch(() => {})
    api.get('/api/analytics/departments').then((r) => setDepts(r.data)).catch(() => {})
  }, [])

  return (
    <div className="landing">
      <nav className="l-nav">
        <div className="brand">
          <div className="brand-logo"><ShieldCheck size={22} color="#fff" /></div>
          <div className="brand-name">CivicFix</div>
        </div>
        <div className="links">
          {user ? (
            <Link to="/app" className="btn btn-primary">Open Dashboard <ArrowRight size={16} /></Link>
          ) : (
            <>
              <Link to="/login" className="btn" style={{ color: '#e2e8f0' }}>Sign in</Link>
              <Link to="/register" className="btn btn-primary">Get started</Link>
            </>
          )}
        </div>
      </nav>

      <section className="l-hero">
        <div className="orb" style={{ width: 420, height: 420, background: '#4f46e5', left: '8%', top: -80 }} />
        <div className="orb" style={{ width: 360, height: 360, background: '#db2777', right: '6%', top: 60 }} />
        <div className="pill"><Sparkles size={14} /> Smarter civic complaint resolution</div>
        <h1>Fix your city, <span className="grad-text">one report at a time.</span></h1>
        <p>Report potholes, broken streetlights, water leaks and more. Track every step until it’s fixed —
          and watch unresolved issues escalate automatically.</p>
        <div className="row" style={{ justifyContent: 'center', position: 'relative' }}>
          <Link to={user ? '/app/report' : '/register'} className="btn btn-primary btn-lg">
            Report an issue <ArrowRight size={18} />
          </Link>
          <a href="#scorecard" className="btn btn-lg" style={{ border: '1px solid rgba(255,255,255,.15)', color: '#e2e8f0' }}>
            View scorecard
          </a>
        </div>

        <div className="l-stats">
          {[
            ['Complaints filed', stats?.total],
            ['Resolved', stats?.resolved],
            ['Resolution rate', stats ? `${stats.resolution_rate}%` : null],
            ['Avg. resolution', stats?.avg_resolution_hours ? `${Math.round(stats.avg_resolution_hours)}h` : null],
          ].map(([k, v]) => (
            <div className="l-stat" key={k}>
              <div className="v">{v ?? '—'}</div>
              <div className="k">{k}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="l-section">
        <h2>Built for citizens and city teams</h2>
        <p className="sub">One platform connecting residents, officials and field workers.</p>
        <div className="grid grid-3">
          {FEATURES.map(([Icon, color, title, text]) => (
            <div className="feature" key={title}>
              <div className="fi" style={{ background: `${color}22`, color }}><Icon size={24} /></div>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </section>

      {depts.length > 0 && (
        <section className="l-section" id="scorecard">
          <h2>Department scorecard</h2>
          <p className="sub">Live resolution performance across city departments.</p>
          <div className="l-board">
            {depts.map((d) => (
              <div className="lrow" key={d.department.id}>
                <div className={`grade grade-${d.grade}`}>{d.grade}</div>
                <div style={{ flex: 1 }}>
                  <div className="row between">
                    <strong style={{ color: '#fff' }}>{d.department.name}</strong>
                    <span className="small" style={{ color: '#94a3b8' }}>
                      {d.resolved}/{d.total} resolved · {d.sla_compliance}% on time
                    </span>
                  </div>
                  <div className="bar"><span style={{ width: `${d.score}%`, background: d.department.color }} /></div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <footer className="l-foot">© {new Date().getFullYear()} CivicFix · Public Complaint & Resolution System</footer>
    </div>
  )
}
