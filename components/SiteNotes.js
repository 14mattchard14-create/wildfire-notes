'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const c = {
  surface:  '#242220',
  line:     '#3a352f',
  accent:   '#be5b1d',
  text:     '#ece6db',
  muted:    '#9a9285',
}

const FIELDS = [
  { key: 'slope',     label: 'Slope & Topography',                         placeholder: 'Grade, aspect, position on hillside…' },
  { key: 'fuel',      label: 'Fuel Type / Vegetation',                     placeholder: 'Dominant vegetation, fuel continuity, ladder fuels…' },
  { key: 'wind',      label: 'Prevailing Wind / Weather Exposure',          placeholder: 'Wind corridors, exposure, historical fire weather…' },
  { key: 'neighbors', label: 'Neighboring Properties / Conflagration Risk', placeholder: 'Adjacent structures, shared vegetation, spacing…' },
  { key: 'other',     label: 'Other Geographic Considerations',             placeholder: 'Anything else relevant to overall site risk…' },
]

const textareaStyle = {
  width: '100%',
  background: '#1b1917',
  border: `1px solid ${c.line}`,
  borderRadius: 4,
  padding: '10px 12px',
  fontSize: 14,
  color: c.text,
  fontFamily: 'inherit',
  resize: 'vertical',
  minHeight: 72,
  outline: 'none',
  boxSizing: 'border-box',
}

export default function SiteNotes({ propertyId }) {
  const [notes,  setNotes]  = useState({ slope:'', fuel:'', wind:'', neighbors:'', other:'' })
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)

  useEffect(() => {
    supabase
      .from('site_notes')
      .select('*')
      .eq('property_id', propertyId)
      .maybeSingle()
      .then(({ data }) => { if (data) setNotes(data) })
  }, [propertyId])

  async function save() {
    setSaving(true)
    const { error } = await supabase
      .from('site_notes')
      .upsert({ property_id: propertyId, ...notes, updated_at: new Date().toISOString() },
               { onConflict: 'property_id' })
    setSaving(false)
    if (error) { alert('Save failed: ' + error.message); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <p style={{ fontSize: 12, color: c.muted, marginBottom: 20, lineHeight: 1.5 }}>
        Capture context that applies to the whole property — fill in after walking the site.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {FIELDS.map(f => (
          <div key={f.key}>
            <label style={{ display: 'block', fontSize: 9.5, fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase', color: c.accent, marginBottom: 6 }}>
              {f.label}
            </label>
            <textarea
              style={textareaStyle}
              placeholder={f.placeholder}
              value={notes[f.key] ?? ''}
              onChange={e => setNotes(n => ({ ...n, [f.key]: e.target.value }))}
            />
          </div>
        ))}
      </div>

      <button
        onClick={save}
        disabled={saving}
        style={{
          marginTop: 20,
          width: '100%',
          background: c.accent,
          color: '#1b1917',
          border: 'none',
          borderRadius: 4,
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          padding: 13,
          cursor: 'pointer',
          opacity: saving ? 0.5 : 1,
        }}
      >
        {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Site Notes'}
      </button>
    </div>
  )
}
