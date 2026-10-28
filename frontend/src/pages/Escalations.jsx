import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { AlertTriangle, Flame, PartyPopper, RefreshCw, Zap } from 'lucide-react'
import api, { errorMessage } from '../api'
import ComplaintTable from '../components/ComplaintTable'
import { Empty, Loader, StatCard } from '../components/ui'
import { ESCALATION_NAMES, timeAgo } from '../utils'

const LEVEL_COLORS = { 0: '#f59e0b', 1: '#f97316', 2: '#e11d48', 3: '#9f1239' }

export default function Escalations() {
  const [data, setData] = useState(null)
  const [level, setLevel] = useState('all')
  const [running, setRunning] = useState(false)

  const load = () => api.get('/api/escalations').then((r) => setData(r.data))
  useEffect(() => { load() }, [])

  const sweep = async () => {
    setRunning(true)
    try {
      const { data: r } = await api.post('/api/escalations/run')
      toast.success(r.escalated ? `${r.escalated} complaint(s) escalated` : 'No new overdue complaints')
      load()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setRunning(false)
    }
  }

  if (!data) return <Loader />
  const byLevel = (l) => data.complaints.filter((c) => c.escalation_level === l).length
  const filtered = level === 'all' ? data.complaints : data.complaints.filter((c) => c.escalation_level === Number(level))

  return (
    <div className="stack">
      <div className="hero-card" style={{ background: 'linear-gradient(135deg, #be123c 0%, #e11d48 45%, #f97316 100%)' }}>
        <div className="row between" style={{ position: 'relative', zIndex: 1 }}>
          <div>
            <h2 className="row"><Flame /> Escalation Center</h2>
            <p>Complaints that missed their deadline climb automatically: Department Head → Municipal Commissioner → Mayor’s Office.
              Each level bumps priority and sets a tighter deadline.</p>
          </div>
          <button className="btn btn-lg" style={{ color: '#be123c' }} disabled={running} onClick={sweep}>
            <RefreshCw size={18} className={running ? 'spin' : ''} /> Run escalation sweep
          </button>
        </div>
      </div>

      <div className="grid grid-4">
        <StatCard icon={AlertTriangle} label="Overdue, not yet escalated" value={byLevel(0)} color={LEVEL_COLORS[0]} />
        {[1, 2, 3].map((l) => (
          <StatCard key={l} icon={l === 3 ? Zap : Flame} label={`L${l} · ${ESCALATION_NAMES[l]}`} value={byLevel(l)} color={LEVEL_COLORS[l]} />
        ))}
      </div>

      <div className="grid grid-main">
        <div className="card">
          <div className="card-head" style={{ flexWrap: 'wrap' }}>
            <h3>Needs attention</h3>
            <div className="chips">
              {['all', '0', '1', '2', '3'].map((l) => (
                <button key={l} className={`chip ${level === l ? 'active' : ''}`} onClick={() => setLevel(l)}>
                  {l === 'all' ? 'All' : l === '0' ? 'Overdue' : `L${l}`}
                </button>
              ))}
            </div>
          </div>
          {filtered.length ? <ComplaintTable items={filtered} /> : (
            <Empty icon={PartyPopper} title="All clear!" text="No complaints at this escalation level." />
          )}
        </div>

        <div className="card">
          <div className="card-head"><h3>Recent escalations</h3></div>
          <div className="card-body">
            {data.recent.length ? (
              <div className="timeline">
                {data.recent.map((e) => (
                  <div key={e.id} className="tl-item">
                    <span className="tl-dot" style={{ color: LEVEL_COLORS[e.level], background: LEVEL_COLORS[e.level] }} />
                    <Link to={`/app/complaints/${e.complaint.id}`} className="tl-title" style={{ display: 'block' }}>
                      {e.complaint.title}
                    </Link>
                    <div className="small"><span className="ticket">{e.complaint.ticket_no}</span> → <strong>{e.escalated_to}</strong></div>
                    <div className="small muted">{e.reason} · {e.triggered_by === 'system' ? 'auto' : 'manual'} · {timeAgo(e.created_at)}</div>
                  </div>
                ))}
              </div>
            ) : <div className="muted small">No escalations yet.</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
