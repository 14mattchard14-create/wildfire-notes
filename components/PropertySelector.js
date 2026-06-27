'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const c = {
  surface: '#242220',
  line:    '#3a352f',
  accent:  '#be5b1d',
  text:    '#ece6db',
  muted:   '#9a9285',
}

const input = { flex: 1, background: c.surface, border: `1px solid ${c.line}`, borderRadius: 4, color: c.text, fontSize: 14, padding: '9px 10px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }

export default function PropertySelector({ selected, onSelect, user }) {
  const [properties, setProperties] = useState([])
  const [creating,   setCreating]   = useState(false)
  const [address,    setAddress]    = useState('')
  const [visitDate,  setVisitDate]  = useState('')
  const [loading,    setLoading]    = useState(false)

  useEffect(() => {
    supabase.from('properties').select('*').order('created_at', { ascending: false }).then(({ data }) => setProperties(data ?? []))
  }, [])

  async function createProperty() {
    if (!address.trim()) return
    setLoading(true)
    const userName = user?.user_metadata?.full_name || user?.email || 'Unknown'
    const { data, error } = await supabase.from('properties').insert({
      address: address.trim(),
      visit_date: visitDate || null,
      created_by: user?.id || null,
      created_by_name: userName,
    }).select().single()
    setLoading(false)
    if (error) { alert('Could not create property: ' + error.message); return }
    setProperties(prev => [data, ...prev])
    onSelect(data)
    setCreating(false)
    setAddress('')
    setVisitDate('')
  }

  if (creating) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input style={input} type="text" placeholder="Property address" value={address} onChange={e => setAddress(e.target.value)} autoFocus />
          <input style={{ ...input, flex: 'none', width: 130 }} type="date" value={visitDate} onChange={e => setVisitDate(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={createProperty} disabled={loading} style={{ flex: 1, background: c.accent, color: '#1b1917', border: 'none', borderRadius: 4, fontWeight: 700, fontSize: 13, padding: '9px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {loading ? 'Saving…' : 'Create'}
          </button>
          <button onClick={() => setCreating(false)} style={{ padding: '9px 16px', background: c.surface, border: `1px solid ${c.line}`, borderRadius: 4, color: c.muted, fontSize: 13, cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <select style={{ ...input, flex: 1 }} value={selected?.id ?? ''} onChange={e => { const prop = properties.find(p => p.id === e.target.value); onSelect(prop ?? null) }}>
        <option value="">— Select a property —</option>
        {properties.map(p => <option key={p.id} value={p.id}>{p.address}{p.visit_date ? ` (${p.visit_date})` : ''}</option>)}
      </select>
      <button onClick={() => setCreating(true)} style={{ padding: '9px 14px', background: c.surface, border: `1px solid ${c.line}`, borderRadius: 4, color: c.accent, fontSize: 18, cursor: 'pointer' }}>
        +
      </button>
    </div>
  )
}
