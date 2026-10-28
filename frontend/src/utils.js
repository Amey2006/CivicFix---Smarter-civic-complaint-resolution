export const STATUS_META = {
  submitted: { label: 'Submitted', color: '#3b82f6' },
  assigned: { label: 'Assigned', color: '#6366f1' },
  in_progress: { label: 'In Progress', color: '#f59e0b' },
  on_hold: { label: 'On Hold', color: '#f97316' },
  resolved: { label: 'Resolved', color: '#10b981' },
  closed: { label: 'Closed', color: '#14b8a6' },
  reopened: { label: 'Reopened', color: '#ec4899' },
  rejected: { label: 'Rejected', color: '#ef4444' },
}

export const PRIORITY_META = {
  low: { label: 'Low', color: '#64748b' },
  medium: { label: 'Medium', color: '#3b82f6' },
  high: { label: 'High', color: '#f97316' },
  critical: { label: 'Critical', color: '#ef4444' },
}

export const ESCALATION_NAMES = { 1: 'Department Head', 2: 'Municipal Commissioner', 3: "Mayor's Office" }

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'

export const fmtDay = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—')

export function timeAgo(d) {
  const s = (Date.now() - new Date(d).getTime()) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export function dueLabel(d) {
  const h = (new Date(d).getTime() - Date.now()) / 3600000
  const abs = Math.abs(h)
  const txt = abs < 24 ? `${Math.round(abs)}h` : `${Math.round(abs / 24)}d`
  return h >= 0 ? `Due in ${txt}` : `Overdue by ${txt}`
}

export const initials = (name = '') =>
  name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
