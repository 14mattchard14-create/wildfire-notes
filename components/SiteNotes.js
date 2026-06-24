'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const FIELDS = [
  { key: 'slope',     label: 'Slope & Topography',                        placeholder: 'Grade, aspect, position on hillside…' },
  { key: 'fuel',      label: 'Fuel Type / Vegetation',                    placeholder: 'Dominant vegetation, fuel continuity, ladder fuels…' },
  { key: 'wind',      label: 'Prevailing Wind / Weather Exposure',         placeholder: 'Wind corridors, exposure, historical fire weather…' },
  { key: 'neighbors', label: 'Neighboring Properties / Conflagration Risk', placeholder: 'Adjacent structures, shared vegetation, spacing…' },
  { key: 'other',     label: 'Other Geographic Considerations',            placeholder: 'Anything else relevant to overall site risk…' },
]

const inputCls = 'w-full bg-stone-900 border border-stone-700 rounded px-3 py-2.5 text-sm text-stone-100 placeholder-stone-600 resize-y min-h-[72px] focus:outline-none focus:border-orange-600'

export default function SiteNotes({ propertyId }) {
  const [notes,   setNotes]   = useState({ slope:'', fuel:'', wind:'', neighbors:'', other:'' })
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)

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
      <p className="text-xs text-stone-500 mb-5 leading-relaxed">
        Capture context that applies to the whole property — fill in after walking the site.
      </p>

      <div className="space-y-4">
        {FIELDS.map(f => (
          <div key={f.key}>
            <label className="block text-[10px] font-mono text-orange-600 tracking-widest uppercase mb-1.5">
              {f.label}
            </label>
            <textarea
              className={inputCls}
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
        className="mt-5 w-full bg-orange-700 text-stone-950 font-bold text-sm py-3 rounded uppercase tracking-wide disabled:opacity-50"
      >
        {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Site Notes'}
      </button>
    </div>
  )
}
