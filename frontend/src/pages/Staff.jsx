import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { UserPlus } from 'lucide-react'
import api, { errorMessage } from '../api'
import { Avatar, Loader, Modal } from '../components/ui'

const ROLE_COLORS = { admin: '#7c3aed', official: '#4f46e5', worker: '#f59e0b', citizen: '#10b981' }
const EMPTY = { name: '', email: '', phone: '', password: '', role: 'worker', department_id: '' }

export default function Staff() {
  const [users, setUsers] = useState(null)
  const [depts, setDepts] = useState([])
  const [role, setRole] = useState('')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const load = () => api.get('/api/users', { params: role ? { role } : {} }).then((r) => setUsers(r.data))
  useEffect(() => { load() }, [role]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { api.get('/api/departments').then((r) => setDepts(r.data)) }, [])

  const create = async () => {
    try {
      await api.post('/api/users', { ...form, phone: form.phone || null, department_id: form.department_id ? Number(form.department_id) : null })
      toast.success('Staff member added')
      setOpen(false)
      setForm(EMPTY)
      load()
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <div className="card fade-in">
      <div className="card-head" style={{ flexWrap: 'wrap' }}>
        <div className="chips">
          {['', 'admin', 'official', 'worker', 'citizen'].map((r) => (
            <button key={r} className={`chip ${role === r ? 'active' : ''}`} onClick={() => setRole(r)} style={{ textTransform: 'capitalize' }}>
              {r || 'Everyone'}
            </button>
          ))}
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setOpen(true)}><UserPlus size={16} /> Add staff</button>
      </div>
      {!users ? <Loader /> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Name</th><th>Role</th><th>Department</th><th>Phone</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ cursor: 'default' }}>
                  <td><div className="row"><Avatar name={u.name} size="sm" /><div><div className="bold">{u.name}</div><div className="small muted">{u.email}</div></div></div></td>
                  <td><span className="badge" style={{ background: `${ROLE_COLORS[u.role]}17`, color: ROLE_COLORS[u.role], textTransform: 'capitalize' }}>{u.role}</span></td>
                  <td>{u.department || <span className="muted">—</span>}</td>
                  <td className="muted">{u.phone || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <Modal title="Add staff member" onClose={() => setOpen(false)}
          footer={<><button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button><button className="btn btn-primary" onClick={create}>Create</button></>}>
          <div className="field"><label>Full name</label><input className="input" value={form.name} onChange={set('name')} /></div>
          <div className="field"><label>Email</label><input className="input" type="email" value={form.email} onChange={set('email')} /></div>
          <div className="grid grid-2" style={{ gap: 12 }}>
            <div className="field"><label>Role</label>
              <select className="select" value={form.role} onChange={set('role')}>
                <option value="worker">Field worker</option><option value="official">Official</option><option value="admin">Admin</option>
              </select>
            </div>
            <div className="field"><label>Department</label>
              <select className="select" value={form.department_id} onChange={set('department_id')} disabled={form.role === 'admin'}>
                <option value="">Select…</option>
                {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-2" style={{ gap: 12 }}>
            <div className="field"><label>Phone</label><input className="input" value={form.phone} onChange={set('phone')} /></div>
            <div className="field"><label>Temporary password</label><input className="input" type="password" value={form.password} onChange={set('password')} /></div>
          </div>
        </Modal>
      )}
    </div>
  )
}
