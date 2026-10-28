import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, SearchX } from 'lucide-react'
import api from '../api'
import { useAuth } from '../context/AuthContext'
import ComplaintTable from '../components/ComplaintTable'
import { Empty, Loader } from '../components/ui'

const TABS = [
  ['All', ''],
  ['Open', 'submitted,assigned,in_progress,on_hold,reopened'],
  ['In progress', 'in_progress'],
  ['Resolved', 'resolved,closed'],
  ['Escalated', 'escalated'],
  ['Overdue', 'overdue'],
]

export default function Complaints() {
  const { user, meta } = useAuth()
  const [params, setParams] = useSearchParams()
  const [data, setData] = useState(null)
  const [depts, setDepts] = useState([])
  const [search, setSearch] = useState(params.get('search') || '')
  const tab = params.get('tab') || ''
  const page = Number(params.get('page') || 1)

  const update = (patch) => {
    const next = new URLSearchParams(params)
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)))
    if (!('page' in patch)) next.delete('page')
    setParams(next)
  }

  useEffect(() => {
    if (user.role === 'admin') api.get('/api/departments').then((r) => setDepts(r.data))
  }, [user.role])

  useEffect(() => {
    if (search === (params.get('search') || '')) return
    const t = setTimeout(() => update({ search }), 350)
    return () => clearTimeout(t)
  }, [search]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const q = { page, page_size: 15 }
    if (tab === 'escalated') q.escalated = true
    else if (tab === 'overdue') q.overdue = true
    else if (tab) q.status = tab
    ;['category', 'priority', 'department_id', 'search'].forEach((k) => params.get(k) && (q[k] = params.get(k)))
    setData(null)
    api.get('/api/complaints', { params: q }).then((r) => setData(r.data))
  }, [params]) // eslint-disable-line react-hooks/exhaustive-deps

  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1

  return (
    <div className="card fade-in">
      <div className="card-head" style={{ flexWrap: 'wrap' }}>
        <div className="chips">
          {TABS.map(([label, value]) => (
            <button key={label} className={`chip ${tab === value ? 'active' : ''}`} onClick={() => update({ tab: value })}>
              {label}
            </button>
          ))}
        </div>
        {data && <span className="small muted">{data.total} complaints</span>}
      </div>
      <div className="toolbar">
        <div className="search">
          <Search size={16} />
          <input className="input" placeholder="Search by title, ticket or address…" value={search}
            onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="select" value={params.get('category') || ''} onChange={(e) => update({ category: e.target.value })}>
          <option value="">All categories</option>
          {meta && Object.entries(meta.categories).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
        </select>
        <select className="select" value={params.get('priority') || ''} onChange={(e) => update({ priority: e.target.value })}>
          <option value="">Any priority</option>
          {meta?.priorities.map((p) => <option key={p} value={p} style={{ textTransform: 'capitalize' }}>{p}</option>)}
        </select>
        {user.role === 'admin' && (
          <select className="select" value={params.get('department_id') || ''} onChange={(e) => update({ department_id: e.target.value })}>
            <option value="">All departments</option>
            {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        )}
      </div>

      {!data ? <Loader /> : data.items.length ? (
        <>
          <ComplaintTable items={data.items} showDept={user.role !== 'official'} />
          <div className="pager">
            <span className="small muted">Page {page} of {pages}</span>
            <div className="row">
              <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => update({ page: String(page - 1) })}>Previous</button>
              <button className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => update({ page: String(page + 1) })}>Next</button>
            </div>
          </div>
        </>
      ) : (
        <Empty icon={SearchX} title="No complaints found" text="Try a different filter or search term." />
      )}
    </div>
  )
}
