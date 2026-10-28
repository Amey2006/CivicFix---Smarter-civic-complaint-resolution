import { CircleHelp, Construction, Droplets, Flame, Inbox, Lightbulb, Trash2, Waves, X } from 'lucide-react'
import { ESCALATION_NAMES, PRIORITY_META, STATUS_META, initials } from '../utils'

const CAT_ICONS = {
  pothole: [Construction, '#f97316'],
  streetlight: [Lightbulb, '#eab308'],
  water_leak: [Droplets, '#0ea5e9'],
  garbage: [Trash2, '#22c55e'],
  drainage: [Waves, '#8b5cf6'],
  other: [CircleHelp, '#64748b'],
}

export function CategoryIcon({ category, size = 18, className = '' }) {
  const [Icon, color] = CAT_ICONS[category] || CAT_ICONS.other
  return (
    <div className={`cat-icon ${className}`} style={{ background: `${color}1a`, color }}>
      <Icon size={size} />
    </div>
  )
}

export function StatusBadge({ status }) {
  const m = STATUS_META[status] || { label: status, color: '#64748b' }
  return (
    <span className="badge" style={{ background: `${m.color}17`, color: m.color }}>
      <span className="dot" style={{ background: m.color }} />
      {m.label}
    </span>
  )
}

export function PriorityBadge({ priority }) {
  const m = PRIORITY_META[priority] || PRIORITY_META.medium
  return (
    <span className="badge" style={{ border: `1px solid ${m.color}40`, color: m.color }}>
      {m.label}
    </span>
  )
}

export function EscalationBadge({ level, compact }) {
  if (!level) return null
  return (
    <span className={`badge esc-badge ${level >= 2 ? 'pulse' : ''}`} title={ESCALATION_NAMES[level]}>
      <Flame size={12} /> {compact ? `L${level}` : `L${level} · ${ESCALATION_NAMES[level]}`}
    </span>
  )
}

export function Avatar({ name, size, system }) {
  return <div className={`avatar ${size || ''} ${system ? 'system' : ''}`}>{system ? 'CF' : initials(name)}</div>
}

export function StatCard({ icon: Icon, label, value, color = '#4f46e5', hint }) {
  return (
    <div className="stat fade-in">
      <div className="stat-glow" style={{ background: color }} />
      <div className="stat-icon" style={{ background: `${color}17`, color }}>
        <Icon size={22} />
      </div>
      <div className="stat-value">{value ?? '—'}</div>
      <div className="stat-label">{label}</div>
      {hint && <div className="small muted" style={{ marginTop: 4 }}>{hint}</div>}
    </div>
  )
}

export function Empty({ icon: Icon = Inbox, title, text, action }) {
  return (
    <div className="empty">
      <div className="ico"><Icon size={28} /></div>
      <h4>{title}</h4>
      {text && <p>{text}</p>}
      {action && <div className="mt">{action}</div>}
    </div>
  )
}

export function Loader() {
  return <div className="page-loader"><div className="spinner" /></div>
}

export function Modal({ title, onClose, children, footer }) {
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function ProgressRing({ value, color = '#4f46e5', size = 84 }) {
  const r = (size - 10) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#eef1f6" strokeWidth="8" fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth="8" fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (c * Math.min(value, 100)) / 100}
          style={{ transition: 'stroke-dashoffset .8s ease' }} />
      </svg>
      <div className="val">{Math.round(value)}%</div>
    </div>
  )
}
