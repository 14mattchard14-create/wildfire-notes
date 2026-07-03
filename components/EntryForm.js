'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ZONES } from '@/lib/criteria'
import InfoModal   from './InfoModal'
import PhotoUpload from './PhotoUpload'

const DISTANCE_ZONES = ['0-5 FT. Noncombustible Zone', '5-30 FT. Defensible Space - Vegetation', '10-30 FT. Defensible Space - Detached Structures & Other Large Items']
const DISTANCE_TYPES = ['Distance from home','Distance between objects','Distance between tree canopies','Distance between shrubs','Other']

const card  = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 6, padding: 16, marginBottom: 16 }
const field = { marginBottom: 14 }

const STATUS_COLORS = {
  'Base Compliant':     { bg: 'rgba(58,125,68,.15)',  border: 'var(--ok)',   color: 'var(--ok)'   },
  'Plus Compliant':     { bg: 'rgba(58,125,68,.28)',  border: '#5aae68',     color: '#5aae68'     },
  'Non-Compliant':      { bg: 'rgba(181,72,58,.15)',  border: 'var(--warn)', color: 'var(--warn)' },
  'Needs Verification': { bg: 'rgba(74,111,165,.15)', border: 'var(--info)', color: 'var(--info)' },
  'Not Applicable':     { bg: 'transparent',          border: 'var(--line)', color: 'var(--text-muted)' },
}

const TOP_STATUSES = [
  { value: 'Base Compliant',     label: 'Base ✓' },
  { value: 'Plus Compliant',     label: 'Plus ✓' },
  { value: 'Non-Compliant',      label: 'Non-Comp' },
  { value: 'Needs Verification', label: 'Verify' },
]

function StatusBtn({ value, label, status, setStatus }) {
  const active = status === value
  const s = STATUS_COLORS[value]
  return (
    <button onClick={() => setStatus(value)} style={{
      padding: '9px 6px', border: `1px solid ${active ? s.border : 'var(--line)'}`,
      borderRadius: 4, cursor: 'pointer', fontFamily: 'monospace', fontSize: 11,
      letterSpacing: '0.04em', textTransform: 'uppercase',
      color: active ? s.color : 'var(--text-muted)',
      background: active ? s.bg : 'transparent',
    }}>{label}</button>
  )
}

export default function EntryForm({ propertyId, onSaved, user }) {
  const [zone,         setZone]         = useState(ZONES[0])
  const [status,       setStatus]       = useState(null)
  const [distance,     setDistance]     = useState('')
  const [distanceType, setDistanceType] = useState(DISTANCE_TYPES[0])
  const [showDistance, setShowDist]     = useState(false)
  const [note,         setNote]         = useState('')
  const [detail,       setDetail]       = useState('')
  const [photoUrl,     setPhotoUrl]     = useState(null)
  const [showDetail,   setShowDetail]   = useState(false)
  const [infoOpen,     setInfoOpen]     = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [photoKey,     setPhotoKey]     = useState(0)

  const inputStyle = { width: '100%', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 4, color: 'var(--text)', fontSize: 15, padding: '10px 12px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }

  async function save() {
    if (!note.trim()) { alert('Add a finding before saving.'); return }
    if (!status)      { alert('Select a status.'); return }
    setSaving(true)
    const userName = user?.user_metadata?.full_name || user?.email || 'Unknown'
    const { error } = await supabase.from('entries').insert({
      property_id: propertyId, zone, category: zone, status,
      distance: showDistance && distance.trim() ? (distanceType.trim() ? `${distance.trim()} — ${distanceType.trim()}` : distance.trim()) : null,
      note: note.trim(), detail: detail.trim() || null, photo_url: photoUrl || null,
      created_by: user?.id || null, created_by_name: userName,
    })
    setSaving(false)
    if (error) { alert('Save failed: ' + error.message); return }
    setStatus(null); setDistance(''); setNote(''); setDetail('')
    setDistanceType(''); setShowDist(false)
    setPhotoUrl(null); setPhotoKey(k => k + 1); setShowDetail(false)
    onSaved()
  }

  return (
    <>
      {infoOpen && <InfoModal category={zone} onClose={() => setInfoOpen(false)} />}
      <div style={card}>
        <div style={field}>
          <label style={{ display: 'block', fontSize: 10.5, fontFamily: 'monospace', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>Zone</label>
          <select style={inputStyle} value={zone} onChange={e => { setZone(e.target.value); if (!DISTANCE_ZONES.includes(e.target.value)) { setShowDist(false); setDistance('') } }}>
            {ZONES.map(z => <option key={z}>{z}</option>)}
          </select>
          <button onClick={() => setInfoOpen(true)} style={{ marginTop: 6, fontSize: 11, fontFamily: 'monospace', color: 'var(--accent)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
            ⓘ Read about this category
          </button>
        </div>

        <div style={field}>
          <label style={{ display: 'block', fontSize: 10.5, fontFamily: 'monospace', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>Status</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 5 }}>
            {TOP_STATUSES.map(s => <StatusBtn key={s.value} value={s.value} label={s.label} status={status} setStatus={setStatus} />)}
            <StatusBtn value="Not Applicable" label="N/A" status={status} setStatus={setStatus} />
          </div>
        </div>

        {DISTANCE_ZONES.includes(zone) && (
          <div style={field}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <label style={{ fontSize: 10.5, fontFamily: 'monospace', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: 0 }}>Distance</label>
              <button onClick={() => { setShowDist(d => !d); if (showDistance) { setDistance(''); setDistanceType('') } }} style={{ fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.06em', textTransform: 'uppercase', background: showDistance ? 'var(--accent)' : 'transparent', color: showDistance ? 'var(--bg)' : 'var(--text-muted)', border: `1px solid ${showDistance ? 'var(--accent)' : 'var(--line)'}`, borderRadius: 20, padding: '2px 10px', cursor: 'pointer' }}>
                {showDistance ? 'Added' : '+ Add'}
              </button>
            </div>
            {showDistance && (
              <div style={{ display: 'flex', gap: 8 }}>
                <input style={{ ...inputStyle, flex: '0 0 90px' }} type="text" placeholder="e.g. 8 ft" value={distance} onChange={e => setDistance(e.target.value)} />
                <input style={{ ...inputStyle, flex: 1 }} type="text" placeholder="between what?" value={distanceType} onChange={e => setDistanceType(e.target.value)} />
              </div>
            )}
          </div>
        )}

        <div style={field}>
          <label style={{ display: 'block', fontSize: 10.5, fontFamily: 'monospace', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>Finding</label>
          <input style={inputStyle} type="text" placeholder="Short description of what you observed" value={note} onChange={e => setNote(e.target.value)} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <button onClick={() => setShowDetail(d => !d)} style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--accent)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', marginBottom: 8 }}>
            {showDetail ? '– Hide details' : '+ Add longer details'}
          </button>
          {showDetail && <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} placeholder="Optional — additional context…" value={detail} onChange={e => setDetail(e.target.value)} />}
        </div>

        <div style={field}>
          <label style={{ display: 'block', fontSize: 10.5, fontFamily: 'monospace', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>Photo</label>
          <PhotoUpload key={photoKey} propertyId={propertyId} onPhotoUrl={setPhotoUrl} />
        </div>

        <button onClick={save} disabled={saving} style={{ width: '100%', background: 'var(--accent)', color: 'var(--bg)', border: 'none', borderRadius: 4, fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', padding: 13, cursor: 'pointer', opacity: saving ? 0.5 : 1 }}>
          {saving ? 'Saving…' : 'Save Entry'}
        </button>
      </div>
    </>
  )
}
