'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const c = {
  surface:  '#242220',
  line:     '#3a352f',
  accent:   '#be5b1d',
  text:     '#ece6db',
  muted:    '#9a9285',
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

export default function FireData({ property, propertyId }) {
  const [fireHistory, setFireHistory] = useState(null)
  const [fireLoading, setFireLoading] = useState(false)
  const [notes,  setNotes]  = useState({ wui: '', local_agency: '' })
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)

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

  useEffect(() => {
    supabase.from('site_notes').select('wui, local_agency').eq('property_id', propertyId).maybeSingle()
      .then(({ data }) => { if (data) setNotes({ wui: data.wui ?? '', local_agency: data.local_agency ?? '' }) })
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

  const fhsz   = property?.fhsz
  const sra    = property?.fhsz_sra
  const county = property?.fhsz_county

  return (
    <div>
      <p style={{ fontSize: 12, color: c.muted, marginBottom: 20, lineHeight: 1.5 }}>
        Automatically pulled from CAL FIRE's public GIS data based on the property address.
      </p>

      {/* FHSZ Info Card */}
      {(fhsz || sra || county) ? (
        <div style={{ background: '#1b1917', border: `1px solid ${c.line}`, borderLeft: `4px solid ${FHSZ_COLOR[fhsz] ?? c.muted}`, borderRadius: 4, padding: '12px 14px', marginBottom: 20 }}>
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
      ) : (
        <p style={{ fontSize: 12, color: c.muted, fontStyle: 'italic', marginBottom: 8 }}>
          No fire hazard zone data yet — edit the property or use "Fetch fire data" on the property selector to look it up.
        </p>
      )}

      <a
        href="https://osfm.fire.ca.gov/what-we-do/community-wildfire-preparedness-and-mitigation/fire-hazard-severity-zones"
        target="_blank" rel="noopener noreferrer"
        style={{ display: 'inline-block', fontSize: 11, fontFamily: 'monospace', color: c.accent, marginBottom: 20, textDecoration: 'underline' }}
      >
        ↗ Verify on official State Fire Marshal FHSZ map
      </a>

      {/* Fire History Card */}
      {(fireLoading || (fireHistory && fireHistory.length > 0)) && (
        <div style={{ background: '#1b1917', border: `1px solid ${c.line}`, borderLeft: `4px solid ${c.warn}`, borderRadius: 4, padding: '12px 14px', marginBottom: 20 }}>
          <p style={{ fontSize: 9.5, fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase', color: c.muted, marginBottom: 10 }}>
            CAL FIRE — Fire History (within 5 mi)
          </p>
          {fireLoading && <p style={{ fontSize: 12, color: c.muted, margin: 0 }}>Looking up nearby fire history…</p>}
          {!fireLoading && fireHistory && fireHistory.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {fireHistory.map((fire, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                  <span style={{ color: c.text }}>{fire.name?.trim() || 'Unnamed Fire'} ({fire.year})</span>
                  {fire.acres && <span style={{ fontFamily: 'monospace', color: c.muted, fontSize: 11 }}>{fire.acres.toLocaleString()} ac</span>}
                </div>
              ))}
              <p style={{ fontSize: 10.5, color: c.muted, marginTop: 6, lineHeight: 1.4 }}>
                Source: CAL FIRE FRAP historical fire perimeter database. Coverage may be incomplete, especially for older or smaller fires.
              </p>
            </div>
          )}
        </div>
      )}

      {!fireLoading && fireHistory && fireHistory.length === 0 && (
        <p style={{ fontSize: 12, color: c.muted, fontStyle: 'italic', marginBottom: 20 }}>
          No recorded fire history within 5 miles of this property.
        </p>
      )}

      {/* Manual fields — no reliable automated source exists for these */}
      <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px dashed ${c.line}` }}>
        <p style={{ fontSize: 11, color: c.muted, marginBottom: 16, lineHeight: 1.5 }}>
          The fields below have no reliable automated lookup — CAL FIRE's own WUI dataset is explicitly not suited for individual-property determinations. Note manually if known.
        </p>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 9.5, fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase', color: c.accent, marginBottom: 6 }}>
            Wildland-Urban Interface (WUI) Designation
          </label>
          <textarea
            style={textareaStyle}
            placeholder="If known — interface, intermix, or influence zone. Reference the official CAL FIRE WUI map if visually inspecting."
            value={notes.wui}
            onChange={e => setNotes(n => ({ ...n, wui: e.target.value }))}
          />
          <a
            href="https://www.arcgis.com/apps/mapviewer/index.html?url=https://services.gis.ca.gov/arcgis/rest/services/Environment/WUI/MapServer&source=sd"
            target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-block', fontSize: 11, fontFamily: 'monospace', color: c.accent, marginTop: 6, textDecoration: 'underline' }}
          >
            ↗ View official CAL FIRE WUI map
          </a>
        </div>

        <div style={{ marginBottom: 8 }}>
          <label style={{ display: 'block', fontSize: 9.5, fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase', color: c.accent, marginBottom: 6 }}>
            Local Fire Agency Contact
          </label>
          <textarea
            style={textareaStyle}
            placeholder="Name, phone, or website of the local fire district/agency responsible for this LRA property, if known."
            value={notes.local_agency}
            onChange={e => setNotes(n => ({ ...n, local_agency: e.target.value }))}
          />
        </div>

        <button onClick={save} disabled={saving} style={{ marginTop: 12, width: '100%', background: c.accent, color: '#1b1917', border: 'none', borderRadius: 4, fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', padding: 13, cursor: 'pointer', opacity: saving ? 0.5 : 1 }}>
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save'}
        </button>
      </div>
    </div>
  )
}
