'use client'

import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import ThemeToggle from '@/components/ThemeToggle'
import BrandLogo from '@/components/BrandLogo'
import BackNav from '@/components/BackNav'
import AdminSidebar from '@/components/AdminSidebar'

// Shared shell for /business — same pattern as app/insights/layout.js and
// app/estimate/layout.js, plus its own horizontal sub-tab row for the
// sections inside "Business" (Forecast and Plan are built; Roadmap/Legal &
// Research are stubbed as "coming soon" so the intended shape is visible
// without shipping half-built pages).
const SUB_TABS = [
  { href: '/business/forecast', label: 'Forecast', ready: true },
  { href: '/business/plan', label: 'Plan', ready: true },
  { href: '/business/roadmap', label: 'Roadmap', ready: false },
  { href: '/business/legal', label: 'Legal & Research', ready: false },
]

export default function BusinessLayout({ children }) {
  const pathname = usePathname()
  const router = useRouter()
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

  const userName = user.user_metadata?.full_name || user.email

  return (
    <div style={{ minHeight: '100vh' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--header-bg)', borderBottom: '1px solid var(--line)' }}>
        <div style={{ padding: '18px 20px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ marginBottom: 4 }}><BrandLogo /></div>
            <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.02em', textTransform: 'uppercase', margin: 0, color: 'var(--header-text)' }}>Business</h1>
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

      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
        <AdminSidebar />
        <div style={{ flex: 1, minWidth: 0 }}>
          <BackNav href="/manage" label="All Properties" maxWidth="none" />
          <div style={{ display: 'flex', gap: 4, padding: '4px 24px 0', borderBottom: '1px solid var(--line)' }}>
            {SUB_TABS.map(tab => {
              const active = pathname.startsWith(tab.href)
              return (
                <button
                  key={tab.href}
                  onClick={() => tab.ready && router.push(tab.href)}
                  disabled={!tab.ready}
                  title={tab.ready ? undefined : 'Coming soon'}
                  style={{
                    padding: '10px 14px', fontSize: 12.5, fontWeight: active ? 700 : 500, fontFamily: 'inherit',
                    background: 'none', border: 'none', borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
                    color: !tab.ready ? 'var(--text-muted)' : active ? 'var(--accent)' : 'var(--text)',
                    cursor: tab.ready ? 'pointer' : 'default', opacity: tab.ready ? 1 : 0.5, marginBottom: -1,
                  }}
                >
                  {tab.label}{!tab.ready && ' (soon)'}
                </button>
              )
            })}
          </div>
          <main style={{ padding: '20px 24px 64px' }}>
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
