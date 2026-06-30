'use client'

import { useState, useEffect } from 'react'

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

export default function FireData({ property }) {
  const [fireHistory, setFireHistory] = useState(null)
  const [fireLoading, setFireLoading] = useState(false)

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
        <p style={{ fontSize: 12, color: c.muted, fontStyle: 'italic', marginBottom: 20 }}>
          No fire hazard zone data yet — edit the property or use "Fetch fire data" on the property selector to look it up.
        </p>
      )}

      {/* Fire History Card */}
      {(fireLoading || (fireHistory && fireHistory.length > 0)) && (
        <div style={{ background: '#1b1917', border: `1px solid ${c.line}`, borderLeft: `4px solid ${c.warn}`, borderRadius: 4, padding: '12px 14px' }}>
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
        <p style={{ fontSize: 12, color: c.muted, fontStyle: 'italic' }}>
          No recorded fire history within 5 miles of this property.
        </p>
      )}
    </div>
  )
}
