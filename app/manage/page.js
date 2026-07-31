'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import ThemeToggle from '@/components/ThemeToggle'
import BrandLogo from '@/components/BrandLogo'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Plus, MapPin, Pencil } from 'lucide-react'

const HOMEOWNER_BADGE = {
  invited:     { label: 'Invited',     color: 'var(--text-muted)' },
  in_progress: { label: 'In Progress', color: 'var(--info)' },
  submitted:   { label: 'New Submission', color: 'var(--ok)' },
  done:        { label: 'Reviewed',    color: 'var(--text-muted)' },
}

// Drives the Review column below — the "initiate a review process" entry
// point. Disabled/muted until the property has at least one entry, then
// becomes a clickable action into /manage/[id]/review whose label tracks
// report_status (same lifecycle the old Report tab used).
const REVIEW_ACTION = {
  none:      { label: 'Start Review →',  color: 'var(--accent)' },
  draft:     { label: 'Continue Review', color: 'var(--info)' },
  published: { label: 'Published ✓',     color: 'var(--ok)' },
}

export default function PropertiesTablePage() {
  const router = useRouter()
  const { user, loading, isHomeowner, profileReady } = useAuth()
  const [properties, setProperties] = useState([])
  const [fetching,   setFetching]   = useState(true)
  const [search,     setSearch]     = useState('')

  const [creating,    setCreating]    = useState(false)
  const [address,     setAddress]     = useState('')
  const [visitDate,   setVisitDate]   = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [locating,    setLocating]    = useState(false)
  const [fhszLoading, setFhszLoading] = useState(false)
  const [savingNew,   setSavingNew]   = useState(false)
  const debounceRef = useRef(null)

  function loadProperties() {
    supabase
      .from('properties')
      .select('id, address, visit_date, created_at, created_by_name, homeowner_status, report_status, entries(count)')
      .order('created_at', { ascending: false })
      .then(({ data }) => { setProperties(data ?? []); setFetching(false) })
  }

  useEffect(() => { loadProperties() }, [])

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

  async function createProperty() {
    if (!address.trim()) return
    setSavingNew(true); setFhszLoading(true)
    const fhsz = await lookupFHSZ(address.trim())
    setFhszLoading(false)
    const userName = user?.user_metadata?.full_name || user?.email || 'Unknown'
    const { data, error } = await supabase.from('properties').insert({
      address: address.trim(), visit_date: visitDate || null, created_by: user?.id || null, created_by_name: userName,
      fhsz: fhsz?.fhsz ?? null, fhsz_sra: fhsz?.sra ?? null, fhsz_county: fhsz?.county ?? null, lat: fhsz?.lat ?? null, lng: fhsz?.lng ?? null,
      customer_email: customerEmail.trim() || null,
    }).select().single()
    setSavingNew(false)
    if (error) { alert('Could not create property: ' + error.message); return }
    router.push(`/manage/${data.id}`)
  }

  if (loading || (user && !profileReady)) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: 13 }}>Loading…</span>
    </div>
  )

  if (!user || isHomeowner) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Inspector account required to view this page.</p>
    </div>
  )

  const userName = user.user_metadata?.full_name || user.email
  const filtered = properties.filter(p => p.address?.toLowerCase().includes(search.toLowerCase()))
  const CONTENT_WIDTH = 1000

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 48 }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--header-bg)', borderBottom: '1px solid var(--line)' }}>
        <div style={{ maxWidth: CONTENT_WIDTH, margin: '0 auto', padding: '18px 16px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ marginBottom: 4 }}><BrandLogo /></div>
            <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.02em', textTransform: 'uppercase', margin: 0, color: 'var(--header-text)' }}>Properties</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ThemeToggle />
            <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--header-text)', opacity: 0.6 }}>{userName}</span>
            <button
              onClick={() => supabase.auth.signOut()}
              style={{ fontSize: 10.5, fontFamily: 'monospace', color: 'var(--header-text)', opacity: 0.7, background: 'none', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4, padding: '4px 8px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em' }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: CONTENT_WIDTH, margin: '0 auto', padding: '20px 16px 64px' }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <Input
            type="text"
            placeholder="Search by address…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="max-w-sm"
          />
          {!creating && (
            <Button onClick={() => setCreating(true)} className="gap-1.5 text-[12px] font-bold uppercase tracking-wide h-auto py-2.5 px-4 ml-auto">
              <Plus className="size-4" /> New Property
            </Button>
          )}
        </div>

        {creating && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 6, padding: 16, marginBottom: 20 }}>
            <div className="relative mb-2">
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
                      onClick={() => { setAddress(s); setSuggestions([]) }}
                      className={`block w-full border-0 bg-transparent px-3 py-2 text-left font-sans text-[13px] text-foreground ${i < suggestions.length - 1 ? 'border-b border-border' : ''}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Input type="date" value={visitDate} onChange={e => setVisitDate(e.target.value)} className="mb-2" />
            <Input
              type="email"
              placeholder="Customer email (optional — for sending the finished report)"
              value={customerEmail}
              onChange={e => setCustomerEmail(e.target.value)}
              className="mb-2"
            />
            {fhszLoading && <p className="m-0 mb-2 font-mono text-[11px] text-muted-foreground">Looking up fire hazard zone…</p>}
            <div className="flex gap-2">
              <Button onClick={createProperty} disabled={savingNew || !address.trim()} className="flex-1 text-[12px] font-bold uppercase tracking-wide h-auto py-2.5">
                {savingNew ? 'Creating…' : 'Create & Open'}
              </Button>
              <Button variant="outline" onClick={() => { setCreating(false); setAddress(''); setVisitDate(''); setCustomerEmail(''); setSuggestions([]) }} className="h-auto py-2.5 font-mono text-[11px] normal-case">
                Cancel
              </Button>
            </div>
          </div>
        )}

        {fetching && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading…</p>}

        {!fetching && filtered.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No properties found.</p>
        )}

        {!fetching && filtered.length > 0 && (
          <div style={{ border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)' }}>
                  {['Address', 'Inspector', 'Visit Date', 'Entries', 'Homeowner', 'Review'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 10.5, fontFamily: 'monospace', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--line)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const hBadge = HOMEOWNER_BADGE[p.homeowner_status]
                  const entriesCount = p.entries?.[0]?.count ?? 0
                  const review = REVIEW_ACTION[p.report_status] ?? REVIEW_ACTION.none
                  return (
                    <tr
                      key={p.id}
                      onClick={() => router.push(`/manage/${p.id}`)}
                      style={{ cursor: 'pointer', borderBottom: '1px solid var(--line)', background: 'var(--surface)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'var(--surface)'}
                    >
                      <td style={{ padding: '11px 14px', fontSize: 13.5, color: 'var(--text)', fontWeight: 600 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                          {p.address}
                          <Pencil
                            className="size-3.5"
                            style={{ color: 'var(--text-muted)', opacity: 0.6, cursor: 'pointer', flexShrink: 0 }}
                            onClick={e => { e.stopPropagation(); router.push(`/manage/${p.id}`) }}
                          />
                        </span>
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: 12.5, color: 'var(--text-muted)' }}>{p.created_by_name ?? '—'}</td>
                      <td style={{ padding: '11px 14px', fontSize: 12.5, color: 'var(--text-muted)' }}>{p.visit_date ?? '—'}</td>
                      <td style={{ padding: '11px 14px', fontSize: 12.5, color: 'var(--text-muted)' }}>{entriesCount}</td>
                      <td style={{ padding: '11px 14px' }}>
                        {hBadge && (
                          <span style={{ fontSize: 10.5, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.04em', color: hBadge.color, border: `1px solid ${hBadge.color}`, borderRadius: 20, padding: '2px 8px' }}>{hBadge.label}</span>
                        )}
                      </td>
                      <td style={{ padding: '11px 14px' }} onClick={e => e.stopPropagation()}>
                        {entriesCount === 0 ? (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Add entries first</span>
                        ) : (
                          <button
                            onClick={() => router.push(`/manage/${p.id}/review`)}
                            style={{
                              fontSize: 10.5, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.04em',
                              color: review.color, border: `1px solid ${review.color}`, borderRadius: 20, padding: '3px 9px',
                              background: 'transparent', cursor: 'pointer',
                            }}
                          >
                            {review.label}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
