'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import LoginPage        from '@/app/login/page'
import HomeownerHome    from '@/components/HomeownerHome'

export default function Home() {
  const { user, loading, isHomeowner, profileReady } = useAuth()
  const router = useRouter()

  // Employees now land on /manage by default. Preserve the old
  // /?property=<id> deep link by forwarding straight to that property's
  // review page instead of the bare table.
  useEffect(() => {
    if (loading || !user || isHomeowner || !profileReady) return
    const propertyId = typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('property')
      : null
    router.replace(propertyId ? `/manage/${propertyId}` : '/manage')
  }, [loading, user, isHomeowner, profileReady, router])

  if (loading || (user && !profileReady)) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: 13 }}>Loading…</span>
    </div>
  )

  if (!user) return <LoginPage />

  if (isHomeowner) return <HomeownerHome user={user} />

  // Employee: redirecting to /manage via the effect above.
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: 13 }}>Loading…</span>
    </div>
  )
}
