'use client'

import { useParams } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import HomeownerHome from '@/components/HomeownerHome'

// Admin/staff-only QA tool: renders the exact HomeownerHome screen a real
// homeowner would see for this property, without needing a second account
// or email. See app/api/homeowner/entries/route.js's resolvePropertyId()
// for the server-side half of this — that route only honors the
// ?propertyId= override for non-homeowner accounts, so a real homeowner
// can never use this to see another property's data.
export default function HomeownerPreviewPage() {
  const { id } = useParams()
  const { user, loading, isHomeowner, profileReady } = useAuth()

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

  return <HomeownerHome user={user} propertyId={id} previewMode />
}
