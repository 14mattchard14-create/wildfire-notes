'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import GuidedEntry from '@/components/GuidedEntry'

// The actual field-capture screen. GuidedEntry already renders as a fixed,
// full-viewport overlay (position: fixed, inset: 0) — in the BOS review
// page it's toggled open over the desktop shell, but here it just *is* the
// page, permanently open, since capture is the only thing this route does.
// "Close" here means "done for now, back to my property list" rather than
// "dismiss a modal", so onClose routes to /inspector instead of closing
// state in place.
export default function InspectorCapturePage() {
  const { id } = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [property, setProperty] = useState(null)
  const [entries, setEntries] = useState([])
  const [fetching, setFetching] = useState(true)

  const load = useCallback(async () => {
    const [{ data: prop }, { data: ents }] = await Promise.all([
      supabase.from('properties').select('*').eq('id', id).maybeSingle(),
      supabase.from('entries').select('*').eq('property_id', id).order('created_at', { ascending: false }),
    ])
    setProperty(prop)
    setEntries(ents ?? [])
    setFetching(false)
  }, [id])

  useEffect(() => { load() }, [load])

  if (fetching) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: 13 }}>Loading…</span>
    </div>
  )

  if (!property) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Property not found.</p>
    </div>
  )

  return (
    <GuidedEntry
      propertyId={id}
      property={property}
      entries={entries}
      user={user}
      onClose={() => router.push('/inspector')}
      onSaved={load}
    />
  )
}
