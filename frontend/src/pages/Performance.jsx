import { useEffect, useState } from 'react'
import { Award, CheckCircle2, Clock, Flame, Gauge, TrendingUp } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import api from '../api'
import { Loader, ProgressRing, StatCard } from '../components/ui'
import { fmtDay } from '../utils'

function Metric({ value, color, suffix = '%' }) {
  return (
    <div>
      <div className="bold">{value}{suffix}</div>
      <div className="bar"><span style={{ width: `${Math.min(value, 100)}%`, background: color }} /></div>
    </div>
  )
}

export default function Performance() {
  const [rows, setRows] = useState(null)
  const [overview, setOverview] = useState(null)
  const [trend, setTrend] = useState([])

  useEffect(() => {
    api.get('/api/analytics/departments').then((r) => setRows(r.data))
    api.get('/api/analytics/overview').then((r) => setOverview(r.data))
    api.get('/api/analytics/trends', { params: { days: 30 } }).then((r) => setTrend(r.data))
  }, [])

  if (!rows || !overview) return <Loader />
  const best = rows[0]
  const chartData = rows.map((r) => ({
    name: r.department.code, 'Resolution rate': r.resolution_rate, 'SLA compliance': r.sla_compliance, 'Escalation rate': r.escalation_rate,
  }))

  return (
    <div className="stack">
      <div className="grid grid-4">
        <StatCard icon={CheckCircle2} label="City resolution rate" value={`${overview.resolution_rate}%`} color="#10b981" />
        <StatCard icon={Clock} label="Avg. time to resolve" value={overview.avg_resolution_hours ? `${Math.round(overview.avg_resolution_hours)}h` : '—'} color="#4f46e5" />
        <StatCard icon={Flame} label="Open escalations" value={overview.escalated_open} color="#e11d48" />
        <StatCard icon={Award} label="Top department" value={best?.department.code} hint={best?.department.name} color="#f59e0b" />
      </div>

      <div className="card fade-in">
        <div className="card-head">
          <h3><Gauge size={16} /> Department leaderboard</h3>
          <span className="small muted">Score = 40% resolution · 40% on-time · 20% low escalation</span>
        </div>
        <div className="leader head">
          <div>#</div><div>Department</div>
          <div className="hide-sm">Resolved</div><div className="hide-sm">On-time (SLA)</div>
          <div className="hide-sm">Escalation rate</div><div className="hide-md">Open / overdue</div>
          <div className="hide-md">Avg. hours</div><div>Grade</div>
        </div>
        {rows.map((r) => (
          <div className="leader" key={r.department.id}>
            <div className={`rank r${r.rank}`}>{r.rank}</div>
            <div>
              <div className="row" style={{ gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: r.department.color }} />
                <strong>{r.department.name}</strong>
              </div>
              <div className="small muted">{r.total} complaints · score {r.score}</div>
            </div>
            <div className="hide-sm"><Metric value={r.resolution_rate} color="#10b981" /></div>
            <div className="hide-sm"><Metric value={r.sla_compliance} color="#4f46e5" /></div>
            <div className="hide-sm"><Metric value={r.escalation_rate} color="#e11d48" /></div>
            <div className="hide-md bold">{r.open} <span className="muted">/</span> <span style={{ color: r.overdue ? '#e11d48' : undefined }}>{r.overdue}</span></div>
            <div className="hide-md bold">{r.avg_resolution_hours ?? '—'}</div>
            <div className={`grade grade-${r.grade}`}>{r.grade}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-head"><h3>Department comparison</h3></div>
          <div className="card-body" style={{ height: 320 }}>
            <ResponsiveContainer>
              <BarChart data={chartData} margin={{ left: -20 }} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef1f6" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: 12 }} formatter={(v) => `${v}%`} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Resolution rate" fill="#10b981" radius={[6, 6, 0, 0]} />
                <Bar dataKey="SLA compliance" fill="#6366f1" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Escalation rate" fill="#f43f5e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h3><TrendingUp size={16} /> Reported vs resolved vs escalated</h3></div>
          <div className="card-body" style={{ height: 320 }}>
            <ResponsiveContainer>
              <LineChart data={trend} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef1f6" vertical={false} />
                <XAxis dataKey="date" tickFormatter={fmtDay} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} minTickGap={24} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip labelFormatter={fmtDay} contentStyle={{ borderRadius: 12 }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="reported" name="Reported" stroke="#6366f1" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="resolved" name="Resolved" stroke="#10b981" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="escalated" name="Escalated" stroke="#f43f5e" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-3">
        {rows.map((r) => (
          <div className="dept-card fade-in" key={r.department.id}>
            <span className="stripe" style={{ background: r.department.color }} />
            <div className="row between" style={{ flexWrap: 'nowrap' }}>
              <div>
                <div className="small muted bold">{r.department.code} · SLA {r.department.sla_hours}h</div>
                <h3 style={{ fontSize: 16, margin: '4px 0 12px' }}>{r.department.name}</h3>
                <div className="stack small" style={{ gap: 4 }}>
                  <span><strong>{r.resolved}</strong> <span className="muted">resolved of</span> <strong>{r.total}</strong></span>
                  <span><strong style={{ color: '#e11d48' }}>{r.overdue}</strong> <span className="muted">overdue ·</span> <strong>{r.escalated}</strong> <span className="muted">escalated</span></span>
                  <span className="muted">Avg. {r.avg_resolution_hours ?? '—'}h to resolve</span>
                </div>
              </div>
              <ProgressRing value={r.sla_compliance} color={r.department.color} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
