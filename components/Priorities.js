'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const c = {
  surface: '#242220',
  line:    '#3a352f',
  accent:  '#be5b1d',
  text:    '#ece6db',
  muted:   '#9a9285',
  warn:    '#b5483a',
}

const inputStyle = {
  width: '100%',
  background: '#1b1917',
  border: `1px solid ${c.line}`,
  borderRadius: 4,
  padding: '8px 10px',
  fontSize: 14,
  color: c.text,
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
  marginBottom: 6,
}

export default function Priorities({ propertyId }) {
  const [items,  setItems]  = useState([])
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)

  useEffect(() => {
    supabase
      .from('priorities')
      .select('*')
      .eq('property_id', propertyId)
      .order('rank')
      .then(({ data }) => setItems(data ?? []))
  }, [propertyId])

  function addItem() {
    if (items.length >= 5) return
    setItems(prev => [
      ...prev,
      { id: 'new_' + Date.now(), property_id: propertyId, rank: prev.length + 1, text: '', why: '' }
    ])
  }

  function update(id, field, value) {
    setItems(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p))
  }

  function move(id, dir) {
    const idx = items.findIndex(p => p.id === id)
    const next = idx + dir
    if (next < 0 || next >= items.length) return
    const arr = [...items]
    ;[arr[idx], arr[next]] = [arr[next], arr[idx]]
    setItems(arr.map((p, i) => ({ ...p, rank: i + 1 })))
  }

  function remove(id) {
    setItems(prev => prev.filter(p => p.id !== id).map((p, i) => ({ ...p, rank: i + 1 })))
  }

  async function save() {
    setSaving(true)
    await supabase.from('priorities').delete().eq('property_id', propertyId)
    if (items.filter(p => p.text?.trim()).length > 0) {
      const rows = items
        .filter(p => p.text?.trim())
        .map(({ id, ...p }) => ({ ...p, id: id.startsWith('new_') ? undefined : id }))
      const { error } = await supabase.from('priorities').insert(rows)
      if (error) { alert('Save failed: ' + error.message); setSaving(false); return }
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <p style={{ fontSize: 12, color: c.muted, marginBottom: 20, lineHeight: 1.5 }}>
        Pick up to 5 items to feature as top priorities in the final report. Order matters.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
        {items.map((item, idx) => (
          <div key={item.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: '#1b1917', border: `1px solid ${c.line}`, borderRadius: 6, padding: 12 }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: c.accent, width: 24, textAlign: 'center', lineHeight: 1.2, marginTop: 4, flexShrink: 0 }}>{idx + 1}</span>

            <div style={{ flex: 1, minWidth: 0 }}>
              <input style={inputStyle} placeholder="Priority item" value={item.text ?? ''} onChange={e => update(item.id, 'text', e.target.value)} />
              <input style={{ ...inputStyle, marginBottom: 0 }} placeholder="Why it's a priority" value={item.why ?? ''} onChange={e => update(item.id, 'why', e.target.value)} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
              {[['▲', -1], ['▼', 1]].map(([arrow, dir]) => (
                <button key={dir} onClick={() => move(item.id, dir)} style={{ width: 24, height: 24, border: `1px solid ${c.line}`, borderRadius: 4, background: 'transparent', color: c.muted, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{arrow}</button>
              ))}
              <button onClick={() => remove(item.id)} style={{ width: 24, height: 24, border: `1px solid ${c.line}`, borderRadius: 4, background: 'transparent', color: c.warn, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
          </div>
        ))}
      </div>

      {items.length < 5 && (
        <button
          onClick={addItem}
          style={{ width: '100%', background: 'transparent', border: `1px solid ${c.line}`, borderRadius: 4, color: c.muted, fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '10px', cursor: 'pointer', marginBottom: 12 }}
        >
          + Add Priority
        </button>
      )}

      <button
        onClick={save}
        disabled={saving}
        style={{ width: '100%', background: c.accent, color: '#1b1917', border: 'none', borderRadius: 4, fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', padding: 13, cursor: 'pointer', opacity: saving ? 0.5 : 1 }}
      >
        {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Priorities'}
      </button>
    </div>
  )
}
