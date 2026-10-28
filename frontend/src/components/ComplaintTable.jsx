import { useNavigate } from 'react-router-dom'
import { Clock } from 'lucide-react'
import { CategoryIcon, EscalationBadge, PriorityBadge, StatusBadge } from './ui'
import { dueLabel, timeAgo } from '../utils'

export default function ComplaintTable({ items, showDept = true }) {
  const navigate = useNavigate()
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Complaint</th>
            {showDept && <th>Department</th>}
            <th>Status</th>
            <th>Priority</th>
            <th>Assignee</th>
            <th>Deadline</th>
          </tr>
        </thead>
        <tbody>
          {items.map((c) => {
            const open = !['resolved', 'closed', 'rejected'].includes(c.status)
            return (
              <tr key={c.id} onClick={() => navigate(`/app/complaints/${c.id}`)}>
                <td>
                  <div className="row" style={{ flexWrap: 'nowrap' }}>
                    <CategoryIcon category={c.category} />
                    <div style={{ minWidth: 0 }}>
                      <div className="cell-title">{c.title}</div>
                      <div className="row small muted" style={{ gap: 8 }}>
                        <span className="ticket">{c.ticket_no}</span>
                        <span>{timeAgo(c.created_at)}</span>
                        <EscalationBadge level={c.escalation_level} compact />
                      </div>
                    </div>
                  </div>
                </td>
                {showDept && (
                  <td>
                    <span className="row small bold" style={{ gap: 6, flexWrap: 'nowrap' }}>
                      <span className="dot" style={{ width: 8, height: 8, borderRadius: 4, background: c.department.color }} />
                      {c.department.name}
                    </span>
                  </td>
                )}
                <td><StatusBadge status={c.status} /></td>
                <td><PriorityBadge priority={c.priority} /></td>
                <td className="small">{c.assignee?.name || <span className="muted">Unassigned</span>}</td>
                <td>
                  {open ? (
                    <span className="row small bold" style={{ gap: 6, color: c.overdue ? '#e11d48' : '#475569', flexWrap: 'nowrap' }}>
                      <Clock size={14} /> {dueLabel(c.due_at)}
                    </span>
                  ) : (
                    <span className="small muted">—</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
