'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

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

const FIELDS = [
  { key: 'slope',     label: 'Slope & Topography',                         placeholder: 'Grade, aspect, position on hillside…' },
  { key: 'fuel',      label: 'Fuel Type / Vegetation',                     placeholder: 'Dominant vegetation, fuel continuity, ladder fuels…' },
  { key: 'wind',      label: 'Prevailing Wind / Weather Exposure',          placeholder: 'Wind corridors, exposure, historical fire weather…' },
  { key: 'neighbors', label: 'Neighboring Properties / Conflagration Risk', placeholder: 'Adjacent structures, shared vegetation, spacing…' },
  { key: 'other',     label: 'Other Geographic Considerations',             placeholder: 'Anything else relevant to overall site risk…' },
]

const textareaStyle = {
  width: '100%', background: '#1b1917', border: `1px solid ${c.line}`,
  borderRadius: 4, padding: '10px 12px', fontSize: 14, color: c.text,
  fontFamily: 'inherit', resize: 'vertical', minHeight: 72, outline: 'none', boxSizing: 'border-box',
}

export default function SiteNotes({ propertyId, property }) {
  const [notes,  setNotes]  = useState({ slope:'', fuel:'', wind:'', neighbors:'', other:'' })
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)

  useEffect(() => {
    supabase.from('site_notes').select('*').eq('property_id', propertyId).maybeSingle()
      .then(({ data }) => { if (data) setNotes(data) })
  }, [propertyId])

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
      {/* FHSZ Info Card */}
      {(fhsz || sra || county) && (
        <div style={{ background: '#1b1917', border: `1px solid ${c.line}`, borderLeft: `4px solid ${FHSZ_COLOR[fhsz] ?? c.muted}`, borderRadius: 4, padding: '12px 14px', marginBottom: 24 }}>
          <p style={{ fontSize: 9.5, fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase', color: c.muted, marginBottom: 10 }}>
            CAL FIRE — Fire Hazard Severity Zone
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Responsibility Area */}
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

            {/* FHSZ Rating */}
            {fhsz && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: c.muted }}>Fire Hazard Severity Zone</span>
                <span style={{
                  fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.06em', textTransform: 'uppercase',
                  color: FHSZ_COLOR[fhsz] ?? c.muted,
                  border: `1px solid ${FHSZ_COLOR[fhsz] ?? c.muted}`,
                  borderRadius: 20, padding: '2px 10px',
                }}>
                  {fhsz}
                </span>
              </div>
            )}

            {/* County */}
            {county && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: c.muted }}>Jurisdiction</span>
                <span style={{ fontSize: 12, fontFamily: 'monospace', color: c.text }}>{county} County</span>
              </div>
            )}

            {/* LRA note */}
            {sra === 'LRA' && (
              <p style={{ fontSize: 11, color: c.muted, marginTop: 4, lineHeight: 1.5, borderTop: `1px dashed ${c.line}`, paddingTop: 8 }}>
                This property is in a Local Responsibility Area — financial responsibility for wildfire prevention rests with the local agency (city, county, or district). Final adopted zones may differ from state recommendations; contact your local agency for confirmed FHSZ designation.
              </p>
            )}

            {!fhsz && sra === 'LRA' && (
              <p style={{ fontSize: 11, color: c.muted, lineHeight: 1.5 }}>
                No Fire Hazard Severity Zone identified by the State Fire Marshal for this LRA parcel per Government Code §51178.
              </p>
            )}
          </div>
        </div>
      )}

      <p style={{ fontSize: 12, color: c.muted, marginBottom: 20, lineHeight: 1.5 }}>
        Capture context that applies to the whole property — fill in after walking the site.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {FIELDS.map(f => (
          <div key={f.key}>
            <label style={{ display: 'block', fontSize: 9.5, fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase', color: c.accent, marginBottom: 6 }}>
              {f.label}
            </label>
            <textarea style={textareaStyle} placeholder={f.placeholder} value={notes[f.key] ?? ''} onChange={e => setNotes(n => ({ ...n, [f.key]: e.target.value }))} />
          </div>
        ))}
      </div>

      <button onClick={save} disabled={saving} style={{ marginTop: 20, width: '100%', background: c.accent, color: '#1b1917', border: 'none', borderRadius: 4, fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', padding: 13, cursor: 'pointer', opacity: saving ? 0.5 : 1 }}>
        {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Site Notes'}
      </button>
    </div>
  )
}
