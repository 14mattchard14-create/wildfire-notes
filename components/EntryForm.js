'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ZONES, CATEGORIES } from '@/lib/criteria'
import InfoModal   from './InfoModal'
import PhotoUpload from './PhotoUpload'

const c = {
  bg:      '#1b1917',
  surface: '#242220',
  line:    '#3a352f',
  accent:  '#be5b1d',
  text:    '#ece6db',
  muted:   '#9a9285',
  ok:      '#6b8e63',
  warn:    '#b5483a',
  info:    '#7d8fa6',
}

const card  = { background: c.surface, border: `1px solid ${c.line}`, borderRadius: 6, padding: 16, marginBottom: 16 }
const label = { display: 'block', fontSize: 10.5, fontFamily: 'monospace', letterSpacing: '0.08em', textTransform: 'uppercase', color: c.muted, marginBottom: 6 }
const input = { width: '100%', background: c.surface, border: `1px solid ${c.line}`, borderRadius: 4, color: c.text, fontSize: 15, padding: '10px 12px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }
const field = { marginBottom: 14 }

const STATUS_STYLES = {
  'Base Compliant':     { background: 'rgba(107,142,99,.18)', borderColor: c.ok,        color: c.ok        },
  'Plus Compliant':     { background: 'rgba(107,142,99,.30)', borderColor: '#a3c49a',   color: '#a3c49a'   },
  'Non-Compliant':      { background: 'rgba(181,72,58,.18)',  borderColor: c.warn,      color: c.warn      },
  'Needs Verification': { background: 'rgba(125,143,166,.18)',borderColor: c.info,      color: c.info      },
  'Not Applicable':     { background: 'transparent',          borderColor: c.muted,     color: c.muted     },
}

const TOP_STATUSES = [
  { value: 'Base Compliant',     label: 'Base ✓' },
  { value: 'Plus Compliant',     label: 'Plus ✓' },
  { value: 'Non-Compliant',      label: 'Non-Comp.' },
  { value: 'Needs Verification', label: 'Verify' },
]

function StatusBtn({ value, label, status, setStatus }) {
  const active = status === value
  const s = STATUS_STYLES[value]
  return (
    <button
      onClick={() => setStatus(value)}
      style={{
        padding: '9px 6px',
        border: `1px solid ${active ? s.borderColor : c.line}`,
        borderRadius: 4, cursor: 'pointer',
        fontFamily: 'monospace', fontSize: 11,
        letterSpacing: '0.04em', textTransform: 'uppercase',
        color:      active ? s.color      : c.muted,
        background: active ? s.background : 'transparent',
      }}
    >
      {label}
    </button>
  )
}

export default function EntryForm({ propertyId, onSaved }) {
  const [zone,       setZone]       = useState(ZONES[0])
  const [category,   setCategory]   = useState(CATEGORIES[0])
  const [status,     setStatus]     = useState(null)
  const [distance,   setDistance]   = useState('')
  const [note,       setNote]       = useState('')
  const [detail,     setDetail]     = useState('')
  const [photoUrl,   setPhotoUrl]   = useState(null)
  const [showDetail, setShowDetail] = useState(false)
  const [infoOpen,   setInfoOpen]   = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [photoKey,   setPhotoKey]   = useState(0)

  async function save() {
    if (!note.trim()) { alert('Add a finding before saving.'); return }
    if (!status)      { alert('Select a status.'); return }
    setSaving(true)
    const { error } = await supabase.from('entries').insert({
      property_id: propertyId,
      zone, category, status,
      distance: distance.trim() || null,
      note:     note.trim(),
      detail:   detail.trim() || null,
      photo_url: photoUrl || null,
    })
    setSaving(false)
    if (error) { alert('Save failed: ' + error.message); return }
    setStatus(null); setDistance(''); setNote(''); setDetail('')
    setPhotoUrl(null); setPhotoKey(k => k + 1); setShowDetail(false)
    onSaved()
  }

  return (
    <>
      {infoOpen && <InfoModal category={category} onClose={() => setInfoOpen(false)} />}

      <div style={card}>
        <div style={field}>
          <label style={label}>Zone</label>
          <select style={input} value={zone} onChange={e => setZone(e.target.value)}>
            {ZONES.map(z => <option key={z}>{z}</option>)}
          </select>
        </div>

        <div style={field}>
          <label style={label}>Criteria / Category</label>
          <select style={input} value={category} onChange={e => setCategory(e.target.value)}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <button onClick={() => setInfoOpen(true)} style={{ marginTop: 6, fontSize: 11, fontFamily: 'monospace', color: c.accent, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
            ⓘ Read about this category
          </button>
        </div>

        <div style={field}>
          <label style={label}>Status</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {TOP_STATUSES.map(s => (
              <StatusBtn key={s.value} value={s.value} label={s.label} status={status} setStatus={setStatus} />
            ))}
            <StatusBtn
              value="Not Applicable" label="N/A"
              status={status} setStatus={setStatus}
            />
            <div /> {/* empty cell to keep grid even */}
          </div>
        </div>

        <div style={field}>
          <label style={label}>Distance / Measurement</label>
          <input style={input} type="text" placeholder="e.g. 8 ft from wall" value={distance} onChange={e => setDistance(e.target.value)} />
        </div>

        <div style={field}>
          <label style={label}>Finding</label>
          <input style={input} type="text" placeholder="Short description of what you observed" value={note} onChange={e => setNote(e.target.value)} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <button onClick={() => setShowDetail(d => !d)} style={{ fontSize: 11, fontFamily: 'monospace', color: c.accent, background: 'none', border: 'none', padding: 0, cursor: 'pointer', marginBottom: 8 }}>
            {showDetail ? '– Hide details' : '+ Add longer details'}
          </button>
          {showDetail && (
            <textarea style={{ ...input, minHeight: 80, resize: 'vertical' }} placeholder="Optional — additional context, conditions, recommendations…" value={detail} onChange={e => setDetail(e.target.value)} />
          )}
        </div>

        <div style={field}>
          <label style={label}>Photo</label>
          <PhotoUpload key={photoKey} propertyId={propertyId} onPhotoUrl={setPhotoUrl} />
        </div>

        <button onClick={save} disabled={saving} style={{ width: '100%', background: c.accent, color: '#1b1917', border: 'none', borderRadius: 4, fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', padding: 13, cursor: 'pointer', opacity: saving ? 0.5 : 1 }}>
          {saving ? 'Saving…' : 'Save Entry'}
        </button>
      </div>
    </>
  )
}
