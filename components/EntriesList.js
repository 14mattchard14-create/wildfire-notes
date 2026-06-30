'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ZONES } from '@/lib/criteria'
import InfoModal from './InfoModal'

const c = {
  surface: '#242220',
  line:    '#3a352f',
  accent:  '#be5b1d',
  text:    '#ece6db',
  muted:   '#9a9285',
  ok:      '#6b8e63',
  warn:    '#b5483a',
  info:    '#7d8fa6',
}

const BORDER = {
  'Base Compliant':     c.ok,
  'Plus Compliant':     '#a3c49a',
  'Non-Compliant':      c.warn,
  'Needs Verification': c.info,
  'Not Applicable':     c.muted,
}

const STATUS_COLOR = {
  'Base Compliant':     c.ok,
  'Plus Compliant':     '#a3c49a',
  'Non-Compliant':      c.warn,
  'Needs Verification': c.info,
  'Not Applicable':     c.muted,
}

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

const DISTANCE_ZONES = ['0-5 FT. Noncombustible Zone', '5-30 FT. Defensible Space - Vegetation', '10-30 FT. Defensible Space - Detached Structures & Other Large Items']

const DISTANCE_TYPES = [
  'Distance from home',
  'Distance between objects',
  'Distance between tree canopies',
  'Distance between shrubs',
  'Other',
]

const inputStyle = { width: '100%', background: '#1b1917', border: `1px solid ${c.line}`, borderRadius: 4, color: c.text, fontSize: 14, padding: '8px 10px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }

export default function EntriesList({ entries, onDeleted }) {
  const [expanded,  setExpanded]  = useState(null)
  const [lightbox,   setLightbox]  = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editData,  setEditData]  = useState({})
  const [saving,    setSaving]    = useState(false)
  const [infoOpen,   setInfoOpen]  = useState(false) // edit-mode info modal
  const [viewInfoOpen, setViewInfoOpen] = useState(null) // view-mode info modal: holds category string

  async function deleteEntry(id) {
    if (!confirm('Delete this entry?')) return
    await supabase.from('entries').delete().eq('id', id)
    onDeleted()
  }

  function startEdit(entry) {
    setEditingId(entry.id)
    // Parse stored "value — type" format back into parts
    let distanceType = ''
    let distanceVal  = entry.distance ?? ''
    if (distanceVal.includes(' — ')) {
      const idx = distanceVal.indexOf(' — ')
      distanceVal  = distanceVal.slice(0, idx)
      distanceType = distanceVal.slice(idx + 3)
    }
    setEditData({
      zone:         entry.zone,
      status:       entry.status,
      distance:     distanceVal,
      distanceType: distanceType,
      showDistance: !!entry.distance,
      note:         entry.note ?? '',
      detail:       entry.detail ?? '',
    })
  }

  async function saveEdit(id) {
    setSaving(true)
    const { error } = await supabase.from('entries').update({
      zone:     editData.zone,
      category: editData.zone,
      status:   editData.status,
      distance: editData.showDistance && editData.distance.trim() ? (editData.distanceType?.trim() ? `${editData.distance.trim()} — ${editData.distanceType.trim()}` : editData.distance.trim()) : null,
      note:     editData.note.trim(),
      detail:   editData.detail.trim() || null,
    }).eq('id', id)
    setSaving(false)
    if (error) { alert('Save failed: ' + error.message); return }
    setEditingId(null)
    onDeleted() // reuse refresh callback
  }

  if (!entries.length) {
    return <p style={{ color: c.muted, fontSize: 13, textAlign: 'center', padding: '32px 0', fontStyle: 'italic' }}>No entries logged yet.</p>
  }

  return (
    <div>
      {viewInfoOpen && <InfoModal category={viewInfoOpen} onClose={() => setViewInfoOpen(null)} />}

      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(0,0,0,0.92)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}
        >
          <img
            src={lightbox}
            alt="Entry photo"
            style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 6, objectFit: 'contain' }}
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setLightbox(null)}
            style={{
              position: 'absolute', top: 16, right: 16,
              width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
              color: '#ece6db', fontSize: 16, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >✕</button>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 10.5, fontFamily: 'monospace', letterSpacing: '0.08em', textTransform: 'uppercase', color: c.muted }}>Logged Entries</span>
        <span style={{ fontSize: 10.5, fontFamily: 'monospace', color: c.muted }}>{entries.length}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {entries.map(entry => {
          const isEditing = editingId === entry.id

          if (isEditing) return (
            <div key={entry.id} style={{ background: c.surface, border: `1px solid ${c.accent}`, borderLeft: `4px solid ${c.accent}`, borderRadius: 4, padding: '12px 13px' }}>
              {/* Zone */}
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 9.5, fontFamily: 'monospace', letterSpacing: '0.08em', textTransform: 'uppercase', color: c.muted, marginBottom: 4 }}>Zone</label>
                <select style={inputStyle} value={editData.zone} onChange={e => setEditData(d => ({ ...d, zone: e.target.value }))}>
                  {ZONES.map(z => <option key={z}>{z}</option>)}
                </select>
                <button onClick={() => setInfoOpen(true)} style={{ marginTop: 6, fontSize: 11, fontFamily: 'monospace', color: c.accent, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                  ⓘ Read about this category
                </button>
                {infoOpen && <InfoModal category={editData.zone} onClose={() => setInfoOpen(false)} />}
              </div>

              {/* Status */}
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 9.5, fontFamily: 'monospace', letterSpacing: '0.08em', textTransform: 'uppercase', color: c.muted, marginBottom: 4 }}>Status</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {TOP_STATUSES.map(s => (
                    <button key={s.value} onClick={() => setEditData(d => ({ ...d, status: s.value }))} style={{
                      padding: '7px 6px', border: `1px solid ${editData.status === s.value ? (STATUS_STYLES[s.value]?.borderColor ?? c.line) : c.line}`,
                      borderRadius: 4, cursor: 'pointer', fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase',
                      color: editData.status === s.value ? (STATUS_STYLES[s.value]?.color ?? c.muted) : c.muted,
                      background: editData.status === s.value ? (STATUS_STYLES[s.value]?.background ?? 'transparent') : 'transparent',
                    }}>{s.label}</button>
                  ))}
                  <button onClick={() => setEditData(d => ({ ...d, status: 'Not Applicable' }))} style={{
                    gridColumn: '1 / -1', padding: '7px 6px',
                    border: `1px solid ${editData.status === 'Not Applicable' ? c.muted : c.line}`,
                    borderRadius: 4, cursor: 'pointer', fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase',
                    color: editData.status === 'Not Applicable' ? c.text : c.muted, background: 'transparent',
                  }}>N/A</button>
                </div>
              </div>

              {/* Distance */}
              {DISTANCE_ZONES.includes(editData.zone) && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <label style={{ fontSize: 9.5, fontFamily: 'monospace', letterSpacing: '0.08em', textTransform: 'uppercase', color: c.muted }}>Distance</label>
                    <button
                      onClick={() => setEditData(d => ({ ...d, showDistance: !d.showDistance, distance: '', distanceType: '' }))}
                      style={{
                        fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.06em', textTransform: 'uppercase',
                        background: editData.showDistance ? c.accent : 'transparent',
                        color: editData.showDistance ? '#1b1917' : c.muted,
                        border: `1px solid ${editData.showDistance ? c.accent : c.line}`,
                        borderRadius: 20, padding: '2px 10px', cursor: 'pointer',
                      }}
                    >
                      {editData.showDistance ? 'Added' : '+ Add'}
                    </button>
                  </div>
                  {editData.showDistance && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        style={{ ...inputStyle, flex: '0 0 90px' }}
                        type="text"
                        placeholder="e.g. 8 ft"
                        value={editData.distance}
                        onChange={e => setEditData(d => ({ ...d, distance: e.target.value }))}
                      />
                      <input
                        style={{ ...inputStyle, flex: 1 }}
                        type="text"
                        placeholder="between what?"
                        value={editData.distanceType ?? ''}
                        onChange={e => setEditData(d => ({ ...d, distanceType: e.target.value }))}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Note */}
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 9.5, fontFamily: 'monospace', letterSpacing: '0.08em', textTransform: 'uppercase', color: c.muted, marginBottom: 4 }}>Finding</label>
                <input style={inputStyle} type="text" value={editData.note} onChange={e => setEditData(d => ({ ...d, note: e.target.value }))} />
              </div>

              {/* Detail */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 9.5, fontFamily: 'monospace', letterSpacing: '0.08em', textTransform: 'uppercase', color: c.muted, marginBottom: 4 }}>Details</label>
                <textarea style={{ ...inputStyle, minHeight: 64, resize: 'vertical' }} value={editData.detail} onChange={e => setEditData(d => ({ ...d, detail: e.target.value }))} />
              </div>

              {/* Photo preview in edit mode */}
              {entry.photo_url && (
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 9.5, fontFamily: 'monospace', letterSpacing: '0.08em', textTransform: 'uppercase', color: c.muted, marginBottom: 4 }}>Photo</label>
                  <img src={entry.photo_url} alt="Entry photo" onClick={() => setLightbox(entry.photo_url)}
                    style={{ borderRadius: 4, border: `1px solid ${c.line}`, height: 80, width: 'auto', cursor: 'zoom-in', display: 'block' }} />
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => saveEdit(entry.id)} disabled={saving} style={{ flex: 1, background: c.accent, color: '#1b1917', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', padding: '9px', cursor: 'pointer', opacity: saving ? 0.5 : 1 }}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button onClick={() => setEditingId(null)} style={{ padding: '9px 16px', background: 'transparent', border: `1px solid ${c.line}`, borderRadius: 4, color: c.muted, fontSize: 12, cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </div>
          )

          return (
            <div key={entry.id} style={{ background: c.surface, border: `1px solid ${c.line}`, borderLeft: `4px solid ${BORDER[entry.status] ?? c.muted}`, borderRadius: 4, padding: '12px 13px' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
                <span style={{ fontSize: 10.5, fontFamily: 'monospace', color: STATUS_COLOR[entry.status] ?? c.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{entry.status}</span>
              </div>

              <p style={{ fontWeight: 600, fontSize: 15, margin: '0 0 4px', color: c.text }}>{entry.zone}</p>

              <button
                onClick={() => setViewInfoOpen(entry.zone)}
                style={{ fontSize: 10.5, fontFamily: 'monospace', color: c.accent, background: 'none', border: 'none', padding: 0, marginBottom: 6, cursor: 'pointer', display: 'block' }}
              >
                ⓘ Read about this category
              </button>

              {entry.distance && (
                <p style={{ fontSize: 11, fontFamily: 'monospace', color: c.muted, margin: '0 0 4px' }}>{entry.distance}</p>
              )}

              <p style={{ fontSize: 14, color: c.text, margin: 0 }}>{entry.note}</p>

              {entry.detail && (
                <button onClick={() => setExpanded(expanded === entry.id ? null : entry.id)} style={{ marginTop: 6, fontSize: 11, fontFamily: 'monospace', color: c.accent, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                  {expanded === entry.id ? '− Hide details' : '+ Show details'}
                </button>
              )}
              {expanded === entry.id && entry.detail && (
                <p style={{ marginTop: 8, fontSize: 13, color: c.muted, borderTop: `1px dashed ${c.line}`, paddingTop: 8 }}>{entry.detail}</p>
              )}

              {entry.photo_url && (
                <img src={entry.photo_url} alt="Entry photo" onClick={() => setLightbox(entry.photo_url)}
                  style={{ marginTop: 10, borderRadius: 4, border: `1px solid ${c.line}`, height: 80, width: 'auto', cursor: 'zoom-in', display: 'block' }} />
              )}

              {/* Edit + Delete */}
              <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
                <button onClick={() => startEdit(entry)} style={{ fontSize: 10.5, fontFamily: 'monospace', color: c.accent, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Edit
                </button>
                <button onClick={() => deleteEntry(entry.id)} style={{ fontSize: 10.5, fontFamily: 'monospace', color: c.muted, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Delete
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
