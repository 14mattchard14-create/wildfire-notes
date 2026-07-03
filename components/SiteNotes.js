'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { SITE_NOTE_SECTIONS, SITE_NOTE_CRITERIA_KEY } from '@/lib/criteria'
import InfoModal from './InfoModal'

export default function SiteNotes({ propertyId }) {
  const [notes,    setNotes]    = useState({})
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [infoOpen, setInfoOpen] = useState(null)

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
    setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  const textareaStyle = { width: '100%', background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 4, padding: '10px 12px', fontSize: 14, color: 'var(--text)', fontFamily: 'inherit', resize: 'vertical', minHeight: 64, outline: 'none', boxSizing: 'border-box' }

  return (
    <div>
      {infoOpen && <InfoModal category={infoOpen} onClose={() => setInfoOpen(null)} />}
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.5 }}>
        Record observations for each Wildfire Prepared Home category below.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {SITE_NOTE_SECTIONS.map(s => {
          const criteriaKey = SITE_NOTE_CRITERIA_KEY[s.key]
          return (
            <div key={s.key}>
              <label style={{ display: 'block', fontSize: 9.5, fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 6 }}>{s.label}</label>
              <textarea style={textareaStyle} placeholder={s.placeholder} value={notes[s.key] ?? ''} onChange={e => setNotes(n => ({ ...n, [s.key]: e.target.value }))} />
              {criteriaKey && <button onClick={() => setInfoOpen(criteriaKey)} style={{ marginTop: 6, fontSize: 11, fontFamily: 'monospace', color: 'var(--accent)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>ⓘ Read about this category</button>}
            </div>
          )
        })}
      </div>
      <button onClick={save} disabled={saving} style={{ marginTop: 20, width: '100%', background: 'var(--accent)', color: 'var(--bg)', border: 'none', borderRadius: 4, fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', padding: 13, cursor: 'pointer', opacity: saving ? 0.5 : 1 }}>
        {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Site Notes'}
      </button>
    </div>
  )
}
