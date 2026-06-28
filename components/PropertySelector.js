'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const c = {
  surface: '#242220',
  line:    '#3a352f',
  accent:  '#be5b1d',
  text:    '#ece6db',
  muted:   '#9a9285',
  ok:      '#6b8e63',
  warn:    '#b5483a',
  info:    '#7d8fa6',
}

const FHSZ_COLOR = {
  'Moderate':  c.info,
  'High':      '#c97c2a',
  'Very High': c.warn,
  'Unknown':   c.muted,
}

const input = { flex: 1, background: c.surface, border: `1px solid ${c.line}`, borderRadius: 4, color: c.text, fontSize: 14, padding: '9px 10px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }

export default function PropertySelector({ selected, onSelect, user }) {
  const [properties, setProperties] = useState([])
  const [creating,   setCreating]   = useState(false)
  const [editing,    setEditing]    = useState(false)
  const [address,    setAddress]    = useState('')
  const [visitDate,  setVisitDate]  = useState('')
  const [loading,    setLoading]    = useState(false)
  const [fhszLoading, setFhszLoading] = useState(false)

  useEffect(() => {
    supabase.from('properties').select('*').order('created_at', { ascending: false }).then(({ data }) => setProperties(data ?? []))
  }, [])

  async function lookupFHSZ(addr) {
    try {
      const res = await fetch('/api/fhsz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: addr }),
      })
      const data = await res.json()
      return data
    } catch { return null }
  }

  async function createProperty() {
    if (!address.trim()) return
    setLoading(true)
    setFhszLoading(true)

    const fhsz = await lookupFHSZ(address.trim())
    setFhszLoading(false)

    const userName = user?.user_metadata?.full_name || user?.email || 'Unknown'
    const { data, error } = await supabase.from('properties').insert({
      address: address.trim(),
      visit_date: visitDate || null,
      created_by: user?.id || null,
      created_by_name: userName,
      fhsz: fhsz?.fhsz ?? null,
      fhsz_sra: fhsz?.sra ?? null,
      fhsz_county: fhsz?.county ?? null,
      lat: fhsz?.lat ?? null,
      lng: fhsz?.lng ?? null,
    }).select().single()

    setLoading(false)
    if (error) { alert('Could not create property: ' + error.message); return }
    setProperties(prev => [data, ...prev])
    onSelect(data)
    setCreating(false)
    setAddress('')
    setVisitDate('')
  }

  async function saveEdit() {
    if (!address.trim()) return
    setLoading(true)

    // Re-lookup FHSZ if address changed
    let fhszFields = {}
    if (address.trim() !== selected.address) {
      setFhszLoading(true)
      const fhsz = await lookupFHSZ(address.trim())
      setFhszLoading(false)
      fhszFields = {
        fhsz: fhsz?.fhsz ?? null,
        fhsz_sra: fhsz?.sra ?? null,
        fhsz_county: fhsz?.county ?? null,
        lat: fhsz?.lat ?? null,
        lng: fhsz?.lng ?? null,
      }
    }

    const { data, error } = await supabase
      .from('properties')
      .update({ address: address.trim(), visit_date: visitDate || null, ...fhszFields })
      .eq('id', selected.id)
      .select()
      .single()
    setLoading(false)
    if (error) { alert('Could not update property: ' + error.message); return }
    setProperties(prev => prev.map(p => p.id === data.id ? data : p))
    onSelect(data)
    setEditing(false)
  }

  function startEditing() {
    setAddress(selected.address)
    setVisitDate(selected.visit_date ?? '')
    setEditing(true)
  }

  if (creating || editing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input style={{ ...input, flex: 'none', width: '100%' }} type="text" placeholder="Property address" value={address} onChange={e => setAddress(e.target.value)} autoFocus />
          <input style={{ ...input, flex: 'none', width: '100%' }} type="date" value={visitDate} onChange={e => setVisitDate(e.target.value)} />
        </div>
        {fhszLoading && (
          <p style={{ fontSize: 11, fontFamily: 'monospace', color: c.muted, margin: 0 }}>Looking up fire hazard zone…</p>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={editing ? saveEdit : createProperty} disabled={loading} style={{ flex: 1, background: c.accent, color: '#1b1917', border: 'none', borderRadius: 4, fontWeight: 700, fontSize: 13, padding: '9px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {loading ? 'Saving…' : editing ? 'Save' : 'Create'}
          </button>
          <button onClick={() => { setCreating(false); setEditing(false) }} style={{ padding: '9px 16px', background: c.surface, border: `1px solid ${c.line}`, borderRadius: 4, color: c.muted, fontSize: 13, cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <select style={{ ...input, flex: 1 }} value={selected?.id ?? ''} onChange={e => { const prop = properties.find(p => p.id === e.target.value); onSelect(prop ?? null) }}>
          <option value="">— Select a property —</option>
          {properties.map(p => <option key={p.id} value={p.id}>{p.address}{p.visit_date ? ` (${p.visit_date})` : ''}</option>)}
        </select>
        {selected && (
          <button onClick={startEditing} style={{ padding: '9px 12px', background: c.surface, border: `1px solid ${c.line}`, borderRadius: 4, color: c.muted, fontSize: 13, cursor: 'pointer' }}>
            ✎
          </button>
        )}
        <button onClick={() => setCreating(true)} style={{ padding: '9px 14px', background: c.surface, border: `1px solid ${c.line}`, borderRadius: 4, color: c.accent, fontSize: 18, cursor: 'pointer' }}>
          +
        </button>
      </div>

      {/* FHSZ badge */}
      {selected?.fhsz && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 9.5, fontFamily: 'monospace', letterSpacing: '0.08em', textTransform: 'uppercase', color: c.muted }}>Fire Hazard Zone:</span>
          <span style={{
            fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.06em', textTransform: 'uppercase',
            color: FHSZ_COLOR[selected.fhsz] ?? c.muted,
            border: `1px solid ${FHSZ_COLOR[selected.fhsz] ?? c.muted}`,
            borderRadius: 20, padding: '2px 10px',
          }}>
            {selected.fhsz}
          </span>
          {selected.fhsz_county && (
            <span style={{ fontSize: 9.5, fontFamily: 'monospace', color: c.muted }}>{selected.fhsz_county} County</span>
          )}
        </div>
      )}
    </div>
  )
}
