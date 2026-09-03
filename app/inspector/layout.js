'use client'

import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import ThemeToggle from '@/components/ThemeToggle'
import LoginPage from '@/app/login/page'

// CG Inspector — the mobile-first, staff-only field capture portal. See
// PORTALS_AND_ROLES_PLAN.md: this is deliberately NOT the admin shell
// (no AdminSidebar, no BackNav) — a stripped-down surface built for
// standing at a property with a phone, not a desk. Any staff role can use
// it (employee/admin/partner/field_inspector/manager); homeowners cannot.
//
// Deliberately self-contained for signing in: the root `/` page forces
// every signed-in staff account to /manage (the BOS shell) regardless of
// where they started, which defeats the point of bookmarking /inspector
// directly on a phone. Rendering LoginPage here — rather than routing
// through `/` — means signing in from a bookmarked /inspector link keeps
// you on /inspector afterward instead of bouncing through BOS first.
export default function InspectorLayout({ children }) {
  const router = useRouter()
  const { user, loading, isHomeowner, profileReady } = useAuth()

  if (loading || (user && !profileReady)) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: 13 }}>Loading…</span>
    </div>
  )

  if (!user) return <LoginPage />

  if (isHomeowner) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>Inspector account required to view this page.</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--header-bg)', borderBottom: '1px solid var(--line)' }}>
        <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={() => router.push('/inspector')}
            style={{
              background: 'none', border: 'none', padding: 0, margin: 0, cursor: 'pointer', textAlign: 'left',
              fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent)', fontFamily: 'monospace',
            }}
          >
            CG Inspector
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ThemeToggle />
            <button
              onClick={() => supabase.auth.signOut().then(() => { window.location.href = '/' })}
              style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--header-text)', opacity: 0.7, background: 'none', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4, padding: '4px 7px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em' }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  )
}
