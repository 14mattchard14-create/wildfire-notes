'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { SITE_NOTE_SECTIONS, SITE_NOTE_CRITERIA_KEY } from '@/lib/criteria'
import InfoModal from './InfoModal'

const c = {
  surface:  '#242220',
  line:     '#3a352f',
  accent:   '#be5b1d',
  text:     '#ece6db',
  muted:    '#9a9285',
  ok:       '#6b8e63',
  warn:     '#b5483a',
  info:     '#7d8fa6',
}

const FHSZ_COLOR = {
  'Moderate':  c.info,
  'High':      '#c97c2a',
  'Very High': c.warn,
}

const textareaStyle = {
  width: '100%', background: '#1b1917', border: `1px solid ${c.line}`,
  borderRadius: 4, padding: '10px 12px', fontSize: 14, color: c.text,
  fontFamily: 'inherit', resize: 'vertical', minHeight: 64, outline: 'none', boxSizing: 'border-box',
}

export default function SiteNotes({ propertyId, property }) {
  const [notes,    setNotes]    = useState({})
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [infoOpen, setInfoOpen] = useState(null) // holds the criteria key string, or null
  const [fireHistory, setFireHistory] = useState(null)
  const [fireLoading, setFireLoading] = useState(false)

  useEffect(() => {
    supabase.from('site_notes').select('*').eq('property_id', propertyId).maybeSingle()
      .then(({ data }) => { if (data) setNotes(data) })
  }, [propertyId])

  useEffect(() => {
    if (!property?.lat || !property?.lng) { setFireHistory(null); return }
    setFireLoading(true)
    fetch('/api/fire-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: property.lat, lng: property.lng, radiusMiles: 5 }),
    })
      .then(res => res.json())
      .then(data => setFireHistory(data.fires ?? []))
      .catch(() => setFireHistory([]))
      .finally(() => setFireLoading(false))
  }, [property?.lat, property?.lng])

  async function save() {
    setSaving(true)
    const { error } = await supabase.from('site_notes')
      .upsert({ property_id: propertyId, ...notes, updated_at: new Date().toISOString() }, { onConflict: 'property_id' })
    setSaving(false)
    if (error) { alert('Save failed: ' + error.message); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const fhsz = property?.fhsz
  const sra  = property?.fhsz_sra
  const county = property?.fhsz_county

  return (
    <div>
      {infoOpen && <InfoModal category={infoOpen} onClose={() => setInfoOpen(null)} />}

      {/* FHSZ Info Card */}
      {(fhsz || sra || county) && (
        <div style={{ background: '#1b1917', border: `1px solid ${c.line}`, borderLeft: `4px solid ${FHSZ_COLOR[fhsz] ?? c.muted}`, borderRadius: 4, padding: '12px 14px', marginBottom: 24 }}>
          <p style={{ fontSize: 9.5, fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase', color: c.muted, marginBottom: 10 }}>
            CAL FIRE — Fire Hazard Severity Zone
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sra && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: c.muted }}>Responsibility Area</span>
                <span style={{ fontSize: 12, fontFamily: 'monospace', color: c.text }}>
                  {sra === 'SRA' ? 'State Responsibility Area (SRA)' :
                   sra === 'LRA' ? 'Local Responsibility Area (LRA)' :
                   sra === 'FRA' ? 'Federal Responsibility Area (FRA)' : sra}
                </span>
              </div>
            )}
            {fhsz && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: c.muted }}>Fire Hazard Severity Zone</span>
                <span style={{
                  fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.06em', textTransform: 'uppercase',
                  color: FHSZ_COLOR[fhsz] ?? c.muted, border: `1px solid ${FHSZ_COLOR[fhsz] ?? c.muted}`,
                  borderRadius: 20, padding: '2px 10px',
                }}>{fhsz}</span>
              </div>
            )}
            {county && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: c.muted }}>Jurisdiction</span>
                <span style={{ fontSize: 12, fontFamily: 'monospace', color: c.text }}>{county} County</span>
              </div>
            )}
            {sra === 'LRA' && (
              <p style={{ fontSize: 11, color: c.muted, marginTop: 4, lineHeight: 1.5, borderTop: `1px dashed ${c.line}`, paddingTop: 8 }}>
                This property is in a Local Responsibility Area — financial responsibility for wildfire prevention rests with the local agency. Final adopted zones may differ from state recommendations.
              </p>
            )}
          </div>
        </div>
      )}

      <p style={{ fontSize: 12, color: c.muted, marginBottom: 20, lineHeight: 1.5 }}>
        Record observations for each Wildfire Prepared Home category below — these notes are used to generate the corresponding section of the final report.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {SITE_NOTE_SECTIONS.map(s => {
          const criteriaKey = SITE_NOTE_CRITERIA_KEY[s.key]
          return (
            <div key={s.key}>
              <label style={{ display: 'block', fontSize: 9.5, fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase', color: c.accent, marginBottom: 6 }}>
                {s.label}
              </label>
              <textarea
                style={textareaStyle}
                placeholder={s.placeholder}
                value={notes[s.key] ?? ''}
                onChange={e => setNotes(n => ({ ...n, [s.key]: e.target.value }))}
              />
              {criteriaKey && (
                <button
                  onClick={() => setInfoOpen(criteriaKey)}
                  style={{ marginTop: 6, fontSize: 11, fontFamily: 'monospace', color: c.accent, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                >
                  ⓘ Read about this category
                </button>
              )}
            </div>
          )
        })}
      </div>

      <button onClick={save} disabled={saving} style={{ marginTop: 20, width: '100%', background: c.accent, color: '#1b1917', border: 'none', borderRadius: 4, fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', padding: 13, cursor: 'pointer', opacity: saving ? 0.5 : 1 }}>
        {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Site Notes'}
      </button>
    </div>
  )
}
