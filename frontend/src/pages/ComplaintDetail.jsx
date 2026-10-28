import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ArrowLeft, CalendarClock, Camera, Check, ClipboardCheck, Flame, Lock, MapPin, MessageSquare,
  Pause, Play, RotateCcw, Send, ShieldCheck, Timer, UserPlus, XCircle,
} from 'lucide-react'
import api, { errorMessage } from '../api'
import { useAuth } from '../context/AuthContext'
import { Avatar, CategoryIcon, Empty, EscalationBadge, Loader, Modal, PriorityBadge, StatusBadge } from '../components/ui'
import { ESCALATION_NAMES, STATUS_META, dueLabel, fmtDate, timeAgo } from '../utils'

const TRACK = ['submitted', 'assigned', 'in_progress', 'resolved', 'closed']
const TRACK_INDEX = { submitted: 0, assigned: 1, reopened: 1, in_progress: 2, on_hold: 2, resolved: 3, closed: 4 }

const ALLOWED = {
  submitted: ['rejected'],
  assigned: ['in_progress', 'on_hold', 'rejected'],
  in_progress: ['resolved', 'on_hold'],
  on_hold: ['in_progress'],
  resolved: ['closed', 'reopened'],
  reopened: ['in_progress'],
}
const ROLE_TARGETS = { worker: ['in_progress', 'on_hold', 'resolved'], citizen: ['closed', 'reopened'] }
const ACTION_UI = {
  in_progress: [Play, 'Start work', 'btn-primary'],
  on_hold: [Pause, 'Put on hold', 'btn-ghost'],
  resolved: [Check, 'Mark resolved', 'btn-success'],
  closed: [ShieldCheck, 'Confirm & close', 'btn-success'],
  reopened: [RotateCcw, 'Not fixed — reopen', 'btn-danger'],
  rejected: [XCircle, 'Reject', 'btn-danger'],
}

function ProgressTrack({ status }) {
  if (status === 'rejected') {
    return <div className="deadline-box overdue row"><XCircle color="#e11d48" /> <strong>This complaint was rejected.</strong></div>
  }
  const idx = TRACK_INDEX[status] ?? 0
  return (
    <div className="progress-track">
      {TRACK.map((s, i) => (
        <div key={s} className={`pt-step ${i <= idx ? 'done' : ''} ${i === idx ? 'current' : ''}`}>
          <div className="pt-dot">{i <= idx ? <Check size={14} /> : null}</div>
          {STATUS_META[s].label}
        </div>
      ))}
    </div>
  )
}

export default function ComplaintDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const [c, setC] = useState(null)
  const [comments, setComments] = useState([])
  const [workers, setWorkers] = useState([])
  const [modal, setModal] = useState(null)
  const [busy, setBusy] = useState(false)
  const staff = ['official', 'admin'].includes(user.role)

  const load = useCallback(() => {
    api.get(`/api/complaints/${id}`).then((r) => setC(r.data)).catch((e) => toast.error(errorMessage(e)))
    api.get(`/api/complaints/${id}/comments`).then((r) => setComments(r.data))
  }, [id])

  useEffect(load, [load])
  useEffect(() => {
    if (staff && c?.department?.id) api.get(`/api/departments/${c.department.id}/workers`).then((r) => setWorkers(r.data))
  }, [staff, c?.department?.id])

  if (!c) return <Loader />

  const act = async (fn, msg) => {
    setBusy(true)
    try {
      await fn()
      toast.success(msg)
      setModal(null)
      load()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const isOpen = !['resolved', 'closed', 'rejected'].includes(c.status)
  const isMineToWork = user.role === 'worker' && c.assignee?.id === user.id
  const roleTargets = ROLE_TARGETS[user.role]
  const actions = (ALLOWED[c.status] || []).filter((s) => {
    if (user.role === 'worker') return isMineToWork && roleTargets.includes(s)
    if (user.role === 'citizen') return roleTargets.includes(s)
    return true
  }).filter((s) => s !== 'in_progress' || c.assignee)
  const canEscalate = isOpen && c.escalation_level < 3 &&
    (staff || (user.role === 'citizen' && (c.overdue || c.status === 'on_hold')))
  const timeline = [
    ...c.transitions.map((t) => ({ ...t, kind: 'status' })),
    ...c.escalations.map((e) => ({ ...e, kind: 'escalation' })),
  ].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

  return (
    <div className="stack">
      <Link to="/app/complaints" className="row muted small bold"><ArrowLeft size={16} /> Back to complaints</Link>

      <div className="card card-pad fade-in">
        <div className="detail-head">
          <CategoryIcon category={c.category} size={26} className="lg" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="row small"><span className="ticket">{c.ticket_no}</span><span className="muted">· {c.category_label} · reported {timeAgo(c.created_at)} by {c.citizen.name}</span></div>
            <h2>{c.title}</h2>
            <div className="row">
              <StatusBadge status={c.status} />
              <PriorityBadge priority={c.priority} />
              <EscalationBadge level={c.escalation_level} />
              <span className="row small muted" style={{ gap: 4 }}><MapPin size={14} /> {c.address}{c.ward ? ` · ${c.ward}` : ''}</span>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 26 }}><ProgressTrack status={c.status} /></div>
      </div>

      <div className="grid grid-main">
        <div className="stack">
          <div className="card">
            <div className="card-head"><h3>Report</h3><span className="badge" style={{ background: c.department.color + '18', color: c.department.color }}>{c.department.name}</span></div>
            <div className="card-body stack">
              <p style={{ whiteSpace: 'pre-wrap' }}>{c.description}</p>
              {Object.keys(c.details).length > 0 && (
                <div className="grid grid-2" style={{ gap: 12 }}>
                  {Object.entries(c.details).map(([k, v]) => (
                    <div key={k} className="deadline-box" style={{ padding: 12 }}>
                      <div className="small muted" style={{ textTransform: 'capitalize' }}>{k.replace(/_/g, ' ')}</div>
                      <div className="bold">{typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v || '—')}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <PhotoSection c={c} user={user} onUploaded={load} />

          <DiscussionSection c={c} user={user} comments={comments} reload={load} />

          <div className="card">
            <div className="card-head">
              <h3><ClipboardCheck size={16} /> Inspection notes</h3>
              {user.role !== 'citizen' && (
                <button className="btn btn-ghost btn-sm" onClick={() => setModal('inspect')}>Add note</button>
              )}
            </div>
            <div className="card-body">
              {c.inspections.length ? (
                <div className="stack" style={{ gap: 12 }}>
                  {c.inspections.map((n) => (
                    <div key={n.id} className="deadline-box">
                      <div className="row between small">
                        <span className="bold">{n.inspector_name}</span>
                        <span className="muted">{fmtDate(n.created_at)}</span>
                      </div>
                      <p style={{ margin: '6px 0' }}>{n.note}</p>
                      <div className="row small">
                        <span className="badge" style={{ background: '#f1f5f9' }}>Severity: {n.severity}</span>
                        {n.estimated_hours && <span className="badge" style={{ background: '#f1f5f9' }}>Est. {n.estimated_hours}h</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : <div className="muted small">No inspections recorded yet.</div>}
            </div>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-head"><h3><Timer size={16} /> Deadline</h3></div>
            <div className="card-body stack" style={{ gap: 14 }}>
              {isOpen ? (
                <div className={`deadline-box ${c.overdue ? 'overdue' : ''}`}>
                  <div className="big" style={{ color: c.overdue ? '#e11d48' : 'var(--text)' }}>{dueLabel(c.due_at)}</div>
                  <div className="small muted">{fmtDate(c.due_at)} · SLA {c.department.sla_hours}h</div>
                </div>
              ) : (
                <div className="deadline-box">
                  <div className="big" style={{ color: '#059669' }}>
                    {c.resolved_at ? (new Date(c.resolved_at) <= new Date(c.sla_due_at) ? 'Resolved on time' : 'Resolved late') : 'Closed'}
                  </div>
                  <div className="small muted">{c.resolved_at && `Resolved ${fmtDate(c.resolved_at)}`}</div>
                </div>
              )}

              <div className="field">
                <label>Assigned worker</label>
                <div className="row">
                  {c.assignee ? <><Avatar name={c.assignee.name} size="sm" /><strong>{c.assignee.name}</strong></> : <span className="muted">Not assigned yet</span>}
                </div>
              </div>

              {(staff || actions.length > 0 || canEscalate) && (
                <div className="stack" style={{ gap: 8 }}>
                  {staff && isOpen && (
                    <button className="btn btn-primary btn-block" onClick={() => setModal('assign')}>
                      <UserPlus size={16} /> {c.assignee ? 'Reassign worker' : 'Assign worker'}
                    </button>
                  )}
                  {actions.map((s) => {
                    const [Icon, label, cls] = ACTION_UI[s]
                    return (
                      <button key={s} className={`btn ${cls} btn-block`} disabled={busy}
                        onClick={() => setModal({ status: s, label })}>
                        <Icon size={16} /> {label}
                      </button>
                    )
                  })}
                  {staff && isOpen && (
                    <button className="btn btn-ghost btn-block" onClick={() => setModal('deadline')}>
                      <CalendarClock size={16} /> Extend deadline
                    </button>
                  )}
                  {canEscalate && (
                    <button className="btn btn-danger btn-block" onClick={() => setModal('escalate')}>
                      <Flame size={16} /> Escalate to {ESCALATION_NAMES[c.escalation_level + 1]}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h3><Flame size={16} /> Escalation ladder</h3></div>
            <div className="card-body esc-ladder">
              {[1, 2, 3].map((l) => (
                <div key={l} className={`esc-rung ${c.escalation_level >= l ? 'reached' : ''}`}>
                  <span className="lvl">L{l}</span> {ESCALATION_NAMES[l]}
                  {c.escalation_level >= l && <Flame size={14} style={{ marginLeft: 'auto' }} />}
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h3>Timeline</h3></div>
            <div className="card-body">
              <div className="timeline">
                {timeline.map((t) => {
                  const color = t.kind === 'escalation' ? '#e11d48' : STATUS_META[t.to_status]?.color
                  return (
                    <div key={`${t.kind}-${t.id}`} className="tl-item">
                      <span className="tl-dot" style={{ color, background: color }} />
                      <div className="tl-title">
                        {t.kind === 'escalation' ? `Escalated to ${t.escalated_to}` : STATUS_META[t.to_status]?.label}
                      </div>
                      <div className="small muted">
                        {fmtDate(t.created_at)} · {t.kind === 'escalation' ? (t.triggered_by === 'system' ? 'Automatic' : 'Manual') : t.changed_by}
                      </div>
                      {(t.note || t.reason) && <div className="small" style={{ marginTop: 2 }}>{t.note || t.reason}</div>}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {c.deadlines.length > 1 && (
            <div className="card">
              <div className="card-head"><h3><CalendarClock size={16} /> Deadline history</h3></div>
              <div className="card-body stack" style={{ gap: 10 }}>
                {c.deadlines.map((d) => (
                  <div key={d.id} className="row between small">
                    <div>
                      <div className="bold" style={{ textTransform: 'capitalize' }}>{d.kind} · {fmtDate(d.due_at)}</div>
                      <div className="muted">{d.reason}</div>
                    </div>
                    {d.is_current ? <span className="badge" style={{ background: '#eef2ff', color: '#4f46e5' }}>Current</span>
                      : d.met === true ? <span className="badge" style={{ background: '#ecfdf5', color: '#059669' }}>Met</span>
                        : d.met === false ? <span className="badge" style={{ background: '#fff1f2', color: '#e11d48' }}>Missed</span>
                          : <span className="badge" style={{ background: '#f1f5f9', color: '#64748b' }}>Replaced</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {modal === 'assign' && (
        <AssignModal workers={workers} current={c.assignee?.id} busy={busy} onClose={() => setModal(null)}
          onSubmit={(body) => act(() => api.post(`/api/complaints/${id}/assign`, body), 'Worker assigned')} />
      )}
      {modal?.status && (
        <NoteModal title={modal.label} placeholder="Add a note (optional)" busy={busy} onClose={() => setModal(null)}
          onSubmit={(note) => act(() => api.post(`/api/complaints/${id}/status`, { status: modal.status, note: note || null }), 'Status updated')} />
      )}
      {modal === 'escalate' && (
        <NoteModal title={`Escalate to ${ESCALATION_NAMES[c.escalation_level + 1]}`} required placeholder="Why does this need escalation?"
          busy={busy} danger onClose={() => setModal(null)}
          onSubmit={(reason) => act(() => api.post(`/api/complaints/${id}/escalate`, { reason }), 'Complaint escalated')} />
      )}
      {modal === 'deadline' && (
        <DeadlineModal busy={busy} onClose={() => setModal(null)}
          onSubmit={(body) => act(() => api.post(`/api/complaints/${id}/deadline`, body), 'Deadline updated')} />
      )}
      {modal === 'inspect' && (
        <InspectionModal busy={busy} onClose={() => setModal(null)}
          onSubmit={(body) => act(() => api.post(`/api/complaints/${id}/inspections`, body), 'Inspection note saved')} />
      )}
    </div>
  )
}

function PhotoSection({ c, user, onUploaded }) {
  const ref = useRef()
  const [uploading, setUploading] = useState(false)
  const stage = user.role === 'citizen' ? 'report' : c.status === 'resolved' ? 'resolution' : 'progress'

  const upload = async (files) => {
    setUploading(true)
    try {
      for (const file of files) {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('stage', stage)
        await api.post(`/api/complaints/${c.id}/photos`, fd)
      }
      toast.success('Photo uploaded')
      onUploaded()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="card">
      <div className="card-head">
        <h3><Camera size={16} /> Photos</h3>
        <button className="btn btn-ghost btn-sm" disabled={uploading} onClick={() => ref.current.click()}>
          {uploading ? 'Uploading…' : 'Upload'}
        </button>
        <input ref={ref} type="file" accept="image/*" multiple hidden onChange={(e) => upload([...e.target.files])} />
      </div>
      <div className="card-body">
        {c.photos.length ? (
          <div className="photo-grid">
            {c.photos.map((p) => (
              <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="photo" title={`${p.original_name} · ${p.uploaded_by_name}`}>
                <img src={p.url} alt={p.caption || p.original_name} />
                <span className="tag">{p.stage}</span>
              </a>
            ))}
          </div>
        ) : <div className="muted small">No photos yet. Before/after photos help verify the fix.</div>}
      </div>
    </div>
  )
}

function DiscussionSection({ c, user, comments, reload }) {
  const [msg, setMsg] = useState('')
  const [internal, setInternal] = useState(false)
  const [sending, setSending] = useState(false)
  const endRef = useRef()

  useEffect(() => endRef.current?.scrollIntoView({ block: 'nearest' }), [comments.length])

  const send = async (e) => {
    e.preventDefault()
    if (!msg.trim()) return
    setSending(true)
    try {
      await api.post(`/api/complaints/${c.id}/comments`, { message: msg, is_internal: internal })
      setMsg('')
      reload()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="card">
      <div className="card-head"><h3><MessageSquare size={16} /> Discussion</h3><span className="small muted">{comments.length} messages</span></div>
      <div className="card-body">
        {comments.length ? (
          <div className="thread">
            {comments.map((m) => (
              <div key={m.id} className={`msg ${m.system ? 'system' : ''} ${m.author_id === user.id ? 'mine' : ''} ${m.is_internal ? 'internal' : ''}`}>
                <Avatar name={m.author_name} size="sm" system={m.system} />
                <div className="msg-body">
                  <div className="msg-meta">
                    <strong style={{ color: 'var(--text)' }}>{m.author_name}</strong>
                    <span style={{ textTransform: 'capitalize' }}>{m.author_role}</span>
                    <span>{timeAgo(m.created_at)}</span>
                    {m.is_internal && <span className="row" style={{ gap: 3, color: '#b45309' }}><Lock size={10} /> Internal</span>}
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{m.message}</div>
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
        ) : <Empty icon={MessageSquare} title="No messages yet" text="Start the conversation." />}

        <form className="composer" onSubmit={send}>
          <textarea className="textarea" placeholder="Write a message…" value={msg} onChange={(e) => setMsg(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) send(e) }} />
          <button className="btn btn-primary" disabled={sending || !msg.trim()}><Send size={16} /></button>
        </form>
        {user.role !== 'citizen' && (
          <label className="checkbox small" style={{ marginTop: 10 }}>
            <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} /> Internal note (hidden from citizen)
          </label>
        )}
      </div>
    </div>
  )
}

function AssignModal({ workers, current, busy, onClose, onSubmit }) {
  const [workerId, setWorkerId] = useState(current || '')
  const [notes, setNotes] = useState('')
  return (
    <Modal title="Assign field worker" onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={!workerId || busy} onClick={() => onSubmit({ worker_id: Number(workerId), notes: notes || null })}>Assign</button></>}>
      {workers.length ? (
        <div className="stack" style={{ gap: 8 }}>
          {workers.map((w) => (
            <label key={w.id} className="esc-rung" style={{ cursor: 'pointer', color: 'var(--text)', borderColor: Number(workerId) === w.id ? 'var(--primary)' : undefined, background: Number(workerId) === w.id ? 'var(--primary-soft)' : undefined }}>
              <input type="radio" name="worker" hidden checked={Number(workerId) === w.id} onChange={() => setWorkerId(w.id)} />
              <Avatar name={w.name} size="sm" />
              <div><div>{w.name}</div><div className="small muted" style={{ fontWeight: 500 }}>{w.email}</div></div>
              {Number(workerId) === w.id && <Check size={16} style={{ marginLeft: 'auto', color: 'var(--primary)' }} />}
            </label>
          ))}
        </div>
      ) : <div className="muted">No workers in this department.</div>}
      <div className="field"><label>Instructions</label><textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional instructions for the worker" /></div>
    </Modal>
  )
}

function NoteModal({ title, placeholder, required, danger, busy, onClose, onSubmit }) {
  const [text, setText] = useState('')
  return (
    <Modal title={title} onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} disabled={busy || (required && text.trim().length < 3)} onClick={() => onSubmit(text.trim())}>Confirm</button></>}>
      <textarea className="textarea" autoFocus placeholder={placeholder} value={text} onChange={(e) => setText(e.target.value)} />
    </Modal>
  )
}

function DeadlineModal({ busy, onClose, onSubmit }) {
  const [due, setDue] = useState('')
  const [reason, setReason] = useState('')
  return (
    <Modal title="Extend deadline" onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={busy || !due || reason.trim().length < 3}
          onClick={() => onSubmit({ due_at: new Date(due).toISOString(), reason })}>Save</button></>}>
      <div className="field"><label>New deadline</label><input className="input" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} /></div>
      <div className="field"><label>Reason</label><textarea className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Waiting for pipeline parts" /></div>
    </Modal>
  )
}

function InspectionModal({ busy, onClose, onSubmit }) {
  const [form, setForm] = useState({ note: '', severity: 'medium', estimated_hours: '' })
  return (
    <Modal title="Add inspection note" onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={busy || form.note.trim().length < 3}
          onClick={() => onSubmit({ ...form, estimated_hours: form.estimated_hours ? Number(form.estimated_hours) : null })}>Save</button></>}>
      <div className="field"><label>Findings</label><textarea className="textarea" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
      <div className="grid grid-2" style={{ gap: 12 }}>
        <div className="field"><label>Severity</label>
          <select className="select" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
            {['low', 'medium', 'high', 'critical'].map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="field"><label>Estimated hours</label><input className="input" type="number" min={0} value={form.estimated_hours} onChange={(e) => setForm({ ...form, estimated_hours: e.target.value })} /></div>
      </div>
    </Modal>
  )
}
