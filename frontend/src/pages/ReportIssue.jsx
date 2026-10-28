import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, ArrowRight, Check, Crosshair, ImagePlus, Send, X } from 'lucide-react'
import api, { errorMessage } from '../api'
import { useAuth } from '../context/AuthContext'
import { CategoryIcon, Loader } from '../components/ui'
import { PRIORITY_META } from '../utils'

const STEPS = ['Category', 'Details', 'Location & photos']

function DynamicField({ field, value, onChange }) {
  if (field.type === 'select') {
    return (
      <div className="field">
        <label>{field.label}</label>
        <select className="select" value={value || ''} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select…</option>
          {field.options.map((o) => <option key={o}>{o}</option>)}
        </select>
      </div>
    )
  }
  if (field.type === 'checkbox') {
    return (
      <label className="checkbox" style={{ alignSelf: 'end', paddingBottom: 10 }}>
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} /> {field.label}
      </label>
    )
  }
  return (
    <div className="field">
      <label>{field.label}</label>
      <input className="input" type={field.type === 'number' ? 'number' : 'text'} min={0} value={value ?? ''}
        onChange={(e) => onChange(field.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)} />
    </div>
  )
}

export default function ReportIssue() {
  const { meta } = useAuth()
  const navigate = useNavigate()
  const fileRef = useRef()
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [files, setFiles] = useState([])
  const [form, setForm] = useState({
    category: '', title: '', description: '', priority: 'medium',
    address: '', ward: '', latitude: null, longitude: null, details: {},
  })
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  if (!meta) return <Loader />
  const cat = meta.categories[form.category]

  const canNext = [
    !!form.category,
    form.title.trim().length >= 5 && form.description.trim().length >= 10,
    form.address.trim().length >= 3,
  ][step]

  const locate = () => {
    if (!navigator.geolocation) return toast.error('Geolocation not supported')
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setForm((f) => ({ ...f, latitude: +p.coords.latitude.toFixed(6), longitude: +p.coords.longitude.toFixed(6) }))
        toast.success('Location captured')
      },
      () => toast.error('Could not get your location'),
    )
  }

  const addFiles = (list) => {
    const imgs = [...list].filter((f) => f.type.startsWith('image/')).slice(0, 6 - files.length)
    setFiles((prev) => [...prev, ...imgs.map((file) => ({ file, url: URL.createObjectURL(file) }))])
  }

  const submit = async () => {
    setBusy(true)
    try {
      const { data } = await api.post('/api/complaints', { ...form, ward: form.ward || null })
      for (const { file } of files) {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('stage', 'report')
        await api.post(`/api/complaints/${data.id}/photos`, fd)
      }
      toast.success(`Complaint ${data.ticket_no} submitted!`)
      navigate(`/app/complaints/${data.id}`)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ maxWidth: 920, margin: '0 auto' }}>
      <div className="steps">
        {STEPS.map((s, i) => (
          <div key={s} className={`step ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}>
            <span className="num">{i < step ? <Check size={14} /> : i + 1}</span>
            <span className="label">{s}</span>
          </div>
        ))}
      </div>

      <div className="card card-pad fade-in" key={step}>
        {step === 0 && (
          <>
            <h3 style={{ marginBottom: 4 }}>What kind of issue is it?</h3>
            <p className="muted" style={{ marginBottom: 20 }}>We’ll route it to the right department automatically.</p>
            <div className="cat-grid">
              {Object.entries(meta.categories).map(([key, c]) => (
                <button key={key} type="button" className={`cat-card ${form.category === key ? 'selected' : ''}`}
                  onClick={() => setForm((f) => ({ ...f, category: key, details: {} }))}>
                  <CategoryIcon category={key} size={26} />
                  <div>
                    <h4>{c.label}</h4>
                    <div className="small muted">{c.fields.length} quick questions</div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 1 && (
          <div className="stack">
            <div className="row">
              <CategoryIcon category={form.category} size={22} />
              <div>
                <h3>{cat.label} details</h3>
                <div className="small muted">Clear details help workers fix it faster.</div>
              </div>
            </div>
            <div className="field">
              <label>Title</label>
              <input className="input" value={form.title} maxLength={200} onChange={(e) => set('title', e.target.value)}
                placeholder={`e.g. ${cat.label} near the main market`} />
            </div>
            <div className="field">
              <label>Description</label>
              <textarea className="textarea" value={form.description} onChange={(e) => set('description', e.target.value)}
                placeholder="Describe the problem, how long it has existed and how it affects people…" />
            </div>
            <div className="field">
              <label>How urgent is it?</label>
              <div className="prio-group">
                {meta.priorities.map((p) => {
                  const m = PRIORITY_META[p]
                  const sel = form.priority === p
                  return (
                    <button key={p} type="button" className="prio-opt" onClick={() => set('priority', p)}
                      style={sel ? { borderColor: m.color, background: `${m.color}12`, color: m.color } : undefined}>
                      {m.label}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="grid grid-2" style={{ gap: 16 }}>
              {cat.fields.map((f) => (
                <DynamicField key={f.name} field={f} value={form.details[f.name]}
                  onChange={(v) => set('details', { ...form.details, [f.name]: v })} />
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="stack">
            <h3>Where is it?</h3>
            <div className="grid grid-2" style={{ gap: 16 }}>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label>Address / landmark</label>
                <input className="input" value={form.address} onChange={(e) => set('address', e.target.value)}
                  placeholder="Street, landmark, area" />
              </div>
              <div className="field">
                <label>Ward (optional)</label>
                <input className="input" value={form.ward} onChange={(e) => set('ward', e.target.value)} placeholder="e.g. Ward 3" />
              </div>
              <div className="field">
                <label>GPS coordinates</label>
                <div className="row" style={{ flexWrap: 'nowrap' }}>
                  <input className="input" readOnly placeholder="Not captured"
                    value={form.latitude ? `${form.latitude}, ${form.longitude}` : ''} />
                  <button type="button" className="btn btn-ghost" onClick={locate}><Crosshair size={16} /> Locate</button>
                </div>
              </div>
            </div>

            <div className="field">
              <label>Photos (up to 6)</label>
              <div className="dropzone" onClick={() => fileRef.current.click()}
                onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files) }}>
                <ImagePlus size={30} style={{ marginBottom: 6, color: 'var(--primary)' }} />
                <div className="bold" style={{ color: 'var(--text)' }}>Click or drag photos here</div>
                <div className="small">JPEG, PNG or WEBP · max 8 MB each</div>
              </div>
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => addFiles(e.target.files)} />
              {files.length > 0 && (
                <div className="thumbs">
                  {files.map((f, i) => (
                    <div key={f.url} style={{ position: 'relative' }}>
                      <img src={f.url} className="thumb" alt="" />
                      <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))}
                        style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, border: 'none', background: '#0f172a', color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="row between" style={{ marginTop: 28 }}>
          <button className="btn btn-ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>
            <ArrowLeft size={16} /> Back
          </button>
          {step < STEPS.length - 1 ? (
            <button className="btn btn-primary" disabled={!canNext} onClick={() => setStep(step + 1)}>
              Continue <ArrowRight size={16} />
            </button>
          ) : (
            <button className="btn btn-primary" disabled={!canNext || busy} onClick={submit}>
              {busy ? 'Submitting…' : <><Send size={16} /> Submit complaint</>}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
