import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { errorMessage } from '../api'

const DEMO = [
  ['Citizen', 'citizen@civicfix.in', 'citizen123'],
  ['Official', 'roads@civicfix.in', 'official123'],
  ['Worker', 'roads.worker1@civicfix.in', 'worker123'],
  ['Admin', 'admin@civicfix.in', 'admin123'],
]

function AuthArt() {
  return (
    <div className="auth-art">
      <div className="orb" style={{ width: 380, height: 380, background: '#4f46e5', left: -80, top: -60 }} />
      <div className="orb" style={{ width: 300, height: 300, background: '#db2777', right: -60, bottom: -40 }} />
      <Link to="/" className="brand" style={{ position: 'relative' }}>
        <div className="brand-logo"><ShieldCheck size={22} color="#fff" /></div>
        <div className="brand-name">CivicFix</div>
      </Link>
      <div>
        <h2>Your voice, <span className="grad-text">tracked to resolution.</span></h2>
        <p>Report civic issues, follow every update, and hold departments accountable with automatic escalation.</p>
        <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 12, position: 'relative' }}>
          {['Smart routing to the right department', 'SLA deadlines on every complaint', 'Live progress and discussion'].map((t) => (
            <div key={t} className="row" style={{ color: '#cbd5e1' }}><CheckCircle2 size={18} color="#818cf8" /> {t}</div>
          ))}
        </div>
      </div>
      <div className="small" style={{ color: '#64748b', position: 'relative' }}>Public Complaint & Resolution System</div>
    </div>
  )
}

export function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const u = await login(form.email, form.password)
      toast.success(`Welcome back, ${u.name.split(' ')[0]}!`)
      navigate('/app')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth">
      <AuthArt />
      <div className="auth-form">
        <form onSubmit={submit} className="fade-in">
          <div>
            <h1>Sign in</h1>
            <p className="muted">Welcome back! Enter your details to continue.</p>
          </div>
          <div className="field">
            <label>Email</label>
            <input className="input" type="email" required value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" />
          </div>
          <div className="field">
            <label>Password</label>
            <input className="input" type="password" required value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
          </div>
          <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
            {busy ? 'Signing in…' : <>Sign in <ArrowRight size={18} /></>}
          </button>
          <p className="muted" style={{ textAlign: 'center' }}>
            New here? <Link to="/register" style={{ color: 'var(--primary)', fontWeight: 600 }}>Create an account</Link>
          </p>
          <div className="demo-box">
            <div className="bold" style={{ marginBottom: 8 }}>Demo accounts (after running seed.py)</div>
            <div className="row" style={{ gap: 6 }}>
              {DEMO.map(([role, email, password]) => (
                <button type="button" key={role} onClick={() => setForm({ email, password })}>{role}</button>
              ))}
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await register({ ...form, phone: form.phone || null })
      toast.success('Account created!')
      navigate('/app')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth">
      <AuthArt />
      <div className="auth-form">
        <form onSubmit={submit} className="fade-in">
          <div>
            <h1>Create account</h1>
            <p className="muted">Join your city’s complaint resolution network.</p>
          </div>
          <div className="field"><label>Full name</label><input className="input" required value={form.name} onChange={set('name')} /></div>
          <div className="field"><label>Email</label><input className="input" type="email" required value={form.email} onChange={set('email')} /></div>
          <div className="field"><label>Phone (optional)</label><input className="input" value={form.phone} onChange={set('phone')} /></div>
          <div className="field"><label>Password</label><input className="input" type="password" minLength={6} required value={form.password} onChange={set('password')} /></div>
          <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
            {busy ? 'Creating…' : <>Create account <ArrowRight size={18} /></>}
          </button>
          <p className="muted" style={{ textAlign: 'center' }}>
            Already registered? <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600 }}>Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
