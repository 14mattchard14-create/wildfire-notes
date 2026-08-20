'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { MapPin, ChevronRight } from 'lucide-react'

// "My assigned properties" — filtered to assigned_inspector_id = me,
// regardless of overall role, per PORTALS_AND_ROLES_PLAN.md. Admin and
// Partner see the full unfiltered list here too (same as they do in BOS),
// since they may need to jump into field capture on any property, not
// just ones formally assigned to them.
export default function InspectorHomePage() {
  const router = useRouter()
  const { user, role } = useAuth()
  const [properties, setProperties] = useState([])
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    if (!user) return
    const seesAll = role === 'admin' || role === 'partner'
    let query = supabase
      .from('properties')
      .select('id, address, visit_date, job_number, entries(count)')
      .order('visit_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
    if (!seesAll) query = query.eq('assigned_inspector_id', user.id)
    query.then(({ data }) => { setProperties(data ?? []); setFetching(false) })
  }, [user, role])

  return (
    <div style={{ padding: '16px', maxWidth: 560, margin: '0 auto' }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, margin: '4px 0 14px', color: 'var(--text)' }}>
        {role === 'admin' || role === 'partner' ? 'All Properties' : 'Your Assigned Properties'}
      </h1>

      {fetching && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading…</p>}

      {!fetching && properties.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          No properties assigned to you yet. Ask an Admin to assign one from the Properties table.
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {properties.map(p => {
          const entriesCount = p.entries?.[0]?.count ?? 0
          return (
            <button
              key={p.id}
              onClick={() => router.push(`/inspector/${p.id}`)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10,
                padding: '14px 14px', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <MapPin className="size-4" style={{ flexShrink: 0, color: 'var(--accent)' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.address}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {p.job_number ? `${p.job_number} · ` : ''}{entriesCount} {entriesCount === 1 ? 'entry' : 'entries'} logged
                  {p.visit_date ? ` · ${p.visit_date}` : ''}
                </div>
              </div>
              <ChevronRight className="size-4" style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
            </button>
          )
        })}
      </div>
    </div>
  )
}
