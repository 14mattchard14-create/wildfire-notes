'use client'

import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import ThemeToggle from '@/components/ThemeToggle'
import BrandLogo from '@/components/BrandLogo'
import BackNav from '@/components/BackNav'
import AdminSidebar from '@/components/AdminSidebar'

// Shared shell for the /insights section — the "documents all reports,
// changes, and lessons learned" home base, kept separate from /quality
// (which stays as the ad-hoc AI-draft-vs-Final export tool). Uses the same
// AdminSidebar as every other admin page for a consistent nav, and
// centralizes the employee-only auth guard here rather than duplicating it
// in every sub-page.
export default function InsightsLayout({ children }) {
  const pathname = usePathname()
  const { user, loading, isHomeowner, profileReady } = useAuth()
  const headerTitle = pathname === '/insights/settings' ? 'Settings' : 'Insights'

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
  // /insights itself (Activity) is the top of this section, so its back
  // button goes up to Properties; sub-pages (currently just Settings)
  // back up to Activity instead.
  const back = pathname === '/insights' ? { href: '/manage', label: 'All Properties' } : { href: '/insights', label: 'Insights Activity' }

  return (
    <div style={{ minHeight: '100vh' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--header-bg)', borderBottom: '1px solid var(--line)' }}>
        <div style={{ padding: '18px 20px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ marginBottom: 4 }}><BrandLogo /></div>
            <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.02em', textTransform: 'uppercase', margin: 0, color: 'var(--header-text)' }}>{headerTitle}</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ThemeToggle />
            <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--header-text)', opacity: 0.6 }}>{userName}</span>
            <button
              onClick={() => supabase.auth.signOut().then(() => { window.location.href = '/' })}
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
          <BackNav href={back.href} label={back.label} maxWidth="none" />
          <main style={{ padding: '20px 24px 64px' }}>
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
