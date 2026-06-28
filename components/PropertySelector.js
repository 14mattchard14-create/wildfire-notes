'use client'

import { useState, useEffect, useRef } from 'react'
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
}

const input = { flex: 1, background: c.surface, border: `1px solid ${c.line}`, borderRadius: 4, color: c.text, fontSize: 14, padding: '9px 10px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }

export default function PropertySelector({ selected, onSelect, user }) {
  const [properties,    setProperties]    = useState([])
  const [creating,      setCreating]      = useState(false)
  const [editing,       setEditing]       = useState(false)
  const [address,       setAddress]       = useState('')
  const [visitDate,     setVisitDate]     = useState('')
  const [loading,       setLoading]       = useState(false)
  const [fhszLoading,   setFhszLoading]   = useState(false)
  const [suggestions,   setSuggestions]   = useState([])
  const [locating,      setLocating]      = useState(false)
  const debounceRef = useRef(null)

  useEffect(() => {
    supabase.from('properties').select('*').order('created_at', { ascending: false }).then(({ data }) => setProperties(data ?? []))
  }, [])

  // Address autocomplete via Google Places Autocomplete API
  async function fetchSuggestions(val) {
    if (val.length < 3) { setSuggestions([]); return }
    try {
      const res = await fetch(`/api/autocomplete?input=${encodeURIComponent(val)}`)
      const data = await res.json()
      setSuggestions(data.suggestions ?? [])
    } catch { setSuggestions([]) }
  }

  function onAddressChange(val) {
    setAddress(val)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 300)
  }

  function selectSuggestion(s) {
    setAddress(s)
    setSuggestions([])
  }

  function locateMe() {
    if (!navigator.geolocation) { alert('Geolocation not supported by your browser.'); return }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude: lat, longitude: lng } = pos.coords
          const res = await fetch(`/api/reverse-geocode?lat=${lat}&lng=${lng}`)
          const data = await res.json()
          if (data.address) {
            setAddress(data.address)
            setSuggestions([])
          }
        } catch (e) {
          alert('Could not reverse geocode location.')
        }
        setLocating(false)
      },
      (err) => {
        alert('Location access denied or unavailable.')
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }

  async function lookupFHSZ(addr) {
    try {
      const res = await fetch('/api/fhsz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address: addr }) })
      return await res.json()
    } catch { return null }
  }

  async function createProperty() {
    if (!address.trim()) return
    setLoading(true); setFhszLoading(true)
    const fhsz = await lookupFHSZ(address.trim())
    setFhszLoading(false)
    const userName = user?.user_metadata?.full_name || user?.email || 'Unknown'
    const { data, error } = await supabase.from('properties').insert({
      address: address.trim(), visit_date: visitDate || null,
      created_by: user?.id || null, created_by_name: userName,
      fhsz: fhsz?.fhsz ?? null, fhsz_sra: fhsz?.sra ?? null,
      fhsz_county: fhsz?.county ?? null, lat: fhsz?.lat ?? null, lng: fhsz?.lng ?? null,
    }).select().single()
    setLoading(false)
    if (error) { alert('Could not create property: ' + error.message); return }
    setProperties(prev => [data, ...prev])
    onSelect(data); setCreating(false); setAddress(''); setVisitDate('')
  }

  async function saveEdit() {
    if (!address.trim()) return
    setLoading(true)
    let fhszFields = {}
    if (address.trim() !== selected.address) {
      setFhszLoading(true)
      const fhsz = await lookupFHSZ(address.trim())
      setFhszLoading(false)
      fhszFields = { fhsz: fhsz?.fhsz ?? null, fhsz_sra: fhsz?.sra ?? null, fhsz_county: fhsz?.county ?? null, lat: fhsz?.lat ?? null, lng: fhsz?.lng ?? null }
    }
    const { data, error } = await supabase.from('properties').update({ address: address.trim(), visit_date: visitDate || null, ...fhszFields }).eq('id', selected.id).select().single()
    setLoading(false)
    if (error) { alert('Could not update property: ' + error.message); return }
    setProperties(prev => prev.map(p => p.id === data.id ? data : p))
    onSelect(data); setEditing(false)
  }

  function startEditing() {
    setAddress(selected.address); setVisitDate(selected.visit_date ?? ''); setEditing(true)
  }

  if (creating || editing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Address with autocomplete */}
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              style={{ ...input, flex: 'none', width: '100%', paddingRight: 40 }}
              type="text" placeholder="Property address"
              value={address} onChange={e => onAddressChange(e.target.value)} autoFocus
            />
            <button
              onClick={locateMe} disabled={locating}
              title="Use current location"
              style={{
                position: 'absolute', right: 8,
                background: 'none', border: 'none', padding: 4,
                cursor: locating ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: locating ? 0.4 : 1,
              }}
            >
              {locating ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c.muted} strokeWidth="2">
                  <circle cx="12" cy="12" r="10" strokeDasharray="31.4" strokeDashoffset="10">
                    <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/>
                  </circle>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
                  <circle cx="12" cy="12" r="8" strokeDasharray="4 2"/>
                </svg>
              )}
            </button>
          </div>
          {/* Suggestions dropdown */}
          {suggestions.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: c.surface, border: `1px solid ${c.line}`, borderRadius: 4, marginTop: 2, boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>
              {suggestions.map((s, i) => (
                <button key={i} onClick={() => selectSuggestion(s)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', background: 'transparent', border: 'none', borderBottom: i < suggestions.length - 1 ? `1px solid ${c.line}` : 'none', color: c.text, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        <input style={{ ...input, flex: 'none', width: '100%' }} type="date" value={visitDate} onChange={e => setVisitDate(e.target.value)} />

        {fhszLoading && <p style={{ fontSize: 11, fontFamily: 'monospace', color: c.muted, margin: 0 }}>Looking up fire hazard zone…</p>}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={editing ? saveEdit : createProperty} disabled={loading} style={{ flex: 1, background: c.accent, color: '#1b1917', border: 'none', borderRadius: 4, fontWeight: 700, fontSize: 13, padding: '9px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {loading ? 'Saving…' : editing ? 'Save' : 'Create'}
          </button>
          <button onClick={() => { setCreating(false); setEditing(false); setSuggestions([]) }} style={{ padding: '9px 16px', background: c.surface, border: `1px solid ${c.line}`, borderRadius: 4, color: c.muted, fontSize: 13, cursor: 'pointer' }}>
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
          <button onClick={startEditing} style={{ padding: '9px 12px', background: c.surface, border: `1px solid ${c.line}`, borderRadius: 4, color: c.muted, fontSize: 13, cursor: 'pointer' }}>✎</button>
        )}
        <button onClick={() => setCreating(true)} style={{ padding: '9px 14px', background: c.surface, border: `1px solid ${c.line}`, borderRadius: 4, color: c.accent, fontSize: 18, cursor: 'pointer' }}>+</button>
      </div>

      {selected?.fhsz && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 9.5, fontFamily: 'monospace', letterSpacing: '0.08em', textTransform: 'uppercase', color: c.muted }}>Fire Hazard Zone:</span>
          <span style={{ fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.06em', textTransform: 'uppercase', color: FHSZ_COLOR[selected.fhsz] ?? c.muted, border: `1px solid ${FHSZ_COLOR[selected.fhsz] ?? c.muted}`, borderRadius: 20, padding: '2px 10px' }}>
            {selected.fhsz}
          </span>
          {selected.fhsz_county && <span style={{ fontSize: 9.5, fontFamily: 'monospace', color: c.muted }}>{selected.fhsz_county} County</span>}
        </div>
      )}
    </div>
  )
}
