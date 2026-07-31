'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { MapPin, Pencil, Plus, RotateCw, UserPlus } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { authFetch } from '@/lib/authFetch'

const FHSZ_COLOR = { 'Moderate': 'var(--info)', 'High': '#c97c2a', 'Very High': 'var(--warn)' }

export default function PropertySelector({ selected, onSelect, user }) {
  const { isHomeowner } = useAuth() ?? {}
  const [properties,  setProperties]  = useState([])
  const [creating,    setCreating]    = useState(false)
  const [editing,     setEditing]     = useState(false)
  const [address,     setAddress]     = useState('')
  const [visitDate,   setVisitDate]   = useState('')
  const [loading,     setLoading]     = useState(false)
  const [fhszLoading, setFhszLoading] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [locating,    setLocating]    = useState(false)
  const [inviting,      setInviting]      = useState(false)
  const [inviteLink,    setInviteLink]    = useState(null)
  const [inviteCopied,  setInviteCopied]  = useState(false)
  const [inviteOpen,    setInviteOpen]    = useState(false)
  const [inviteEmail,   setInviteEmail]   = useState('')
  const debounceRef = useRef(null)

  useEffect(() => {
    supabase.from('properties').select('*').order('created_at', { ascending: false }).then(({ data }) => setProperties(data ?? []))
  }, [])

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

  function selectSuggestion(s) { setAddress(s); setSuggestions([]) }

  function locateMe() {
    if (!navigator.geolocation) { alert('Geolocation not supported.'); return }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(async pos => {
      try {
        const { latitude: lat, longitude: lng } = pos.coords
        const res = await fetch(`/api/reverse-geocode?lat=${lat}&lng=${lng}`)
        const data = await res.json()
        if (data.address) { setAddress(data.address); setSuggestions([]) }
      } catch { alert('Could not reverse geocode location.') }
      setLocating(false)
    }, () => { alert('Location access denied.'); setLocating(false) }, { enableHighAccuracy: true, timeout: 10000 })
  }

  async function lookupFHSZ(addr) {
    try {
      const res = await fetch('/api/fhsz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address: addr }) })
      return await res.json()
    } catch { return null }
  }

  async function refreshFHSZ() {
    if (!selected) return
    setFhszLoading(true)
    const fhsz = await lookupFHSZ(selected.address)
    setFhszLoading(false)
    const { data, error } = await supabase.from('properties').update({ fhsz: fhsz?.fhsz ?? null, fhsz_sra: fhsz?.sra ?? null, fhsz_county: fhsz?.county ?? null, lat: fhsz?.lat ?? null, lng: fhsz?.lng ?? null }).eq('id', selected.id).select().single()
    if (error) { alert('Refresh failed: ' + error.message); return }
    setProperties(prev => prev.map(p => p.id === data.id ? data : p)); onSelect(data)
  }

  async function createProperty() {
    if (!address.trim()) return
    setLoading(true); setFhszLoading(true)
    const fhsz = await lookupFHSZ(address.trim())
    setFhszLoading(false)
    const userName = user?.user_metadata?.full_name || user?.email || 'Unknown'
    const { data, error } = await supabase.from('properties').insert({ address: address.trim(), visit_date: visitDate || null, created_by: user?.id || null, created_by_name: userName, fhsz: fhsz?.fhsz ?? null, fhsz_sra: fhsz?.sra ?? null, fhsz_county: fhsz?.county ?? null, lat: fhsz?.lat ?? null, lng: fhsz?.lng ?? null }).select().single()
    setLoading(false)
    if (error) { alert('Could not create property: ' + error.message); return }
    setProperties(prev => [data, ...prev]); onSelect(data); setCreating(false); setAddress(''); setVisitDate('')
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
    setProperties(prev => prev.map(p => p.id === data.id ? data : p)); onSelect(data); setEditing(false)
  }

  function startEditing() { setAddress(selected.address); setVisitDate(selected.visit_date ?? ''); setEditing(true) }

  async function inviteHomeowner() {
    if (!selected || !inviteEmail.trim()) return
    setInviting(true); setInviteLink(null); setInviteCopied(false)
    try {
      const res = await authFetch('/api/homeowner-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId: selected.id, email: inviteEmail.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not create invite')
      setInviteLink(`${window.location.origin}/invite/${data.token}`)
    } catch (err) {
      alert('Invite failed: ' + err.message)
    } finally {
      setInviting(false)
    }
  }

  function copyInviteLink() {
    if (!inviteLink) return
    navigator.clipboard.writeText(inviteLink)
    setInviteCopied(true)
    setTimeout(() => setInviteCopied(false), 2000)
  }

  if (creating || editing) return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <div className="relative flex items-center">
          <Input
            type="text"
            placeholder="Property address"
            value={address}
            onChange={e => onAddressChange(e.target.value)}
            className="pr-10"
            autoFocus
          />
          <button
            onClick={locateMe}
            disabled={locating}
            title="Use current location"
            className="absolute right-2 flex items-center justify-center rounded p-1 text-primary disabled:opacity-40"
          >
            <MapPin className="size-[18px]" strokeWidth={2} />
          </button>
        </div>
        {suggestions.length > 0 && (
          <div className="absolute inset-x-0 top-full z-50 mt-0.5 rounded-md border border-border bg-card shadow-md">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => selectSuggestion(s)}
                className={cnBorder(i, suggestions.length)}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
      <Input type="date" value={visitDate} onChange={e => setVisitDate(e.target.value)} />
      {fhszLoading && <p className="m-0 font-mono text-[11px] text-muted-foreground">Looking up fire hazard zone…</p>}
      <div className="flex gap-2">
        <Button onClick={editing ? saveEdit : createProperty} disabled={loading} className="flex-1 uppercase tracking-wide">
          {loading ? 'Saving…' : editing ? 'Save' : 'Create'}
        </Button>
        <Button variant="outline" onClick={() => { setCreating(false); setEditing(false); setSuggestions([]) }}>
          Cancel
        </Button>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Select
          value={selected?.id ?? undefined}
          onValueChange={id => { const prop = properties.find(p => p.id === id); onSelect(prop ?? null) }}
        >
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="— Select a property —" />
          </SelectTrigger>
          <SelectContent>
            {properties.map(p => (
              <SelectItem key={p.id} value={p.id}>
                {p.address}{p.visit_date ? ` (${p.visit_date})` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selected && (
          <Button
            variant="outline"
            size="icon"
            onClick={startEditing}
            title="Edit property"
            className="text-muted-foreground hover:text-foreground"
          >
            <Pencil className="size-4" />
          </Button>
        )}
        <Button
          variant="outline"
          size="icon"
          onClick={() => setCreating(true)}
          title="Add property"
          className="border-primary/40 text-primary hover:bg-primary/10 hover:text-primary"
        >
          <Plus className="size-4" />
        </Button>
      </div>
      {selected && (
        <div className="flex flex-wrap items-center gap-2">
          {selected.fhsz && (
            <>
              <span className="font-mono text-[9.5px] uppercase tracking-wide text-muted-foreground">Fire Hazard Zone:</span>
              <span
                className="rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wide"
                style={{ color: FHSZ_COLOR[selected.fhsz] ?? 'var(--text-muted)', borderColor: FHSZ_COLOR[selected.fhsz] ?? 'var(--line)' }}
              >
                {selected.fhsz}
              </span>
              {selected.fhsz_county && <span className="font-mono text-[9.5px] text-muted-foreground">{selected.fhsz_county} County</span>}
            </>
          )}
          {!selected.lat && (
            <Button variant="outline" size="sm" onClick={refreshFHSZ} disabled={fhszLoading} className="h-auto gap-1 border-primary/40 px-2 py-1 font-mono text-[10px] normal-case text-primary hover:bg-primary/10 hover:text-primary">
              <RotateCw className="size-3" />
              {fhszLoading ? 'Looking up…' : 'Fetch fire data'}
            </Button>
          )}
          {!isHomeowner && !inviteOpen && (
            <Button variant="outline" size="sm" onClick={() => { setInviteOpen(true); setInviteLink(null) }} className="h-auto gap-1 border-primary/40 px-2 py-1 font-mono text-[10px] normal-case text-primary hover:bg-primary/10 hover:text-primary">
              <UserPlus className="size-3" />
              Invite Homeowner
            </Button>
          )}
        </div>
      )}

      {inviteOpen && !inviteLink && (
        <div className="flex flex-col gap-1.5 rounded-md border border-border bg-secondary p-3">
          <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Homeowner's email</span>
          <p className="m-0 text-xs text-muted-foreground">The invite link will only work with this exact email — it locks the field on their end so they can't sign up with a different address.</p>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="homeowner@email.com"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && inviteHomeowner()}
              autoFocus
            />
            <Button onClick={inviteHomeowner} disabled={inviting || !inviteEmail.trim()} className="h-auto shrink-0 px-3 font-mono text-[10px] normal-case">
              {inviting ? 'Generating…' : 'Generate Link'}
            </Button>
            <Button variant="outline" onClick={() => { setInviteOpen(false); setInviteEmail('') }} className="h-auto shrink-0 px-3 font-mono text-[10px] normal-case">
              Cancel
            </Button>
          </div>
        </div>
      )}

      {inviteLink && (
        <div className="flex flex-col gap-1.5 rounded-md border border-border bg-secondary p-3">
          <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Invite link for {inviteEmail} — share this separately</span>
          <div className="flex gap-2">
            <Input readOnly value={inviteLink} className="font-mono text-xs" onFocus={e => e.target.select()} />
            <Button variant="outline" size="sm" onClick={copyInviteLink} className="h-auto shrink-0 px-3 font-mono text-[10px] normal-case">
              {inviteCopied ? '✓ Copied' : 'Copy'}
            </Button>
          </div>
          <button onClick={() => { setInviteOpen(false); setInviteLink(null); setInviteEmail('') }} className="self-start font-mono text-[10px] text-muted-foreground underline">
            Done
          </button>
        </div>
      )}
    </div>
  )
}

function cnBorder(i, len) {
  const base = 'block w-full border-0 bg-transparent px-3 py-2 text-left font-sans text-[13px] text-foreground'
  return i < len - 1 ? `${base} border-b border-border` : base
}
