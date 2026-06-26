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
        Pick up to
