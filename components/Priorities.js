'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const inputCls = 'w-full bg-stone-900 border border-stone-700 rounded px-3 py-2 text-sm text-stone-100 placeholder-stone-600 focus:outline-none focus:border-orange-600 mb-1.5'

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
    // Delete existing and re-insert (simplest approach for small datasets)
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
      <p className="text-xs text-stone-500 mb-5 leading-relaxed">
        Pick up to 5 items to feature as top priorities in the final report. Order matters.
      </p>

      <div className="space-y-3 mb-4">
        {items.map((item, idx) => (
          <div key={item.id} className="flex gap-3 items-start bg-stone-900 border border-stone-800 rounded-lg p-3">
            {/* Rank number */}
            <span className="text-2xl font-bold text-orange-600 w-6 text-center leading-tight mt-1">{idx + 1}</span>

            {/* Inputs */}
            <div className="flex-1 min-w-0">
              <input
                className={inputCls}
                placeholder="Priority item"
                value={item.text ?? ''}
                onChange={e => update(item.id, 'text', e.target.value)}
              />
              <input
                className={inputCls}
                placeholder="Why it's a priority"
                value={item.why ?? ''}
                onChange={e => update(item.id, 'why', e.target.value)}
              />
            </div>

            {/* Controls */}
            <div className="flex flex-col gap-1">
              <button onClick={() => move(item.id, -1)} className="text-stone-500 text-xs border border-stone-700 rounded w-6 h-6 flex items-center justify-center">▲</button>
              <button onClick={() => move(item.id,  1)} className="text-stone-500 text-xs border border-stone-700 rounded w-6 h-6 flex items-center justify-center">▼</button>
              <button onClick={() => remove(item.id)}   className="text-red-800    text-xs border border-stone-700 rounded w-6 h-6 flex items-center justify-center">✕</button>
            </div>
          </div>
        ))}
      </div>

      {items.length < 5 && (
        <button
          onClick={addItem}
          className="w-full border border-stone-700 text-stone-500 text-xs font-mono uppercase tracking-wide py-2.5 rounded mb-4 hover:border-orange-600 hover:text-orange-600 transition-colors"
        >
          + Add Priority
        </button>
      )}

      <button
        onClick={save}
        disabled={saving}
        className="w-full bg-orange-700 text-stone-950 font-bold text-sm py-3 rounded uppercase tracking-wide disabled:opacity-50"
      >
        {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Priorities'}
      </button>
    </div>
  )
}
