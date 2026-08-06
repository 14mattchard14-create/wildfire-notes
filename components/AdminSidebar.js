'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Home, Users, Activity, Sparkles, Settings, SidebarClose, SidebarOpen, Calculator, TrendingUp } from 'lucide-react'

// Persistent left-nav for every inspector-facing admin page — same list,
// same highlighting, everywhere (properties table, a single property, the
// review editor, CRM, Insights, Report Quality), so the app has one
// consistent shell instead of each section inventing its own nav. `match`
// decides which single item lights up as "you are here", checked in order —
// more specific routes are listed before the broader ones they'd otherwise
// also match. Lessons Learned lives inside the Report Quality page itself
// (as a tab) rather than as its own nav entry — see components/LessonsLearned.js.
const NAV = [
  { href: '/insights/settings', label: 'Settings', icon: Settings, match: p => p.startsWith('/insights/settings') },
  { href: '/insights', label: 'Activity', icon: Activity, match: p => p === '/insights' },
  { href: '/quality', label: 'Report Quality', icon: Sparkles, match: p => p.startsWith('/quality') },
  { href: '/estimate', label: 'Estimate', icon: Calculator, match: p => p.startsWith('/estimate') },
  { href: '/business', label: 'Business', icon: TrendingUp, match: p => p.startsWith('/business') },
  { href: '/crm', label: 'CRM', icon: Users, match: p => p.startsWith('/crm') },
  { href: '/manage', label: 'Properties', icon: Home, match: p => p === '/manage' || p.startsWith('/manage/') },
]

// Rendered in NAV's intended display order — the array above is ordered
// for match-priority, not display, so we sort it here. Settings is pinned
// to the very bottom regardless of what else is added to this list later.
const DISPLAY_ORDER = ['/manage', '/crm', '/estimate', '/business', '/insights', '/quality']
const ORDERED_NAV = DISPLAY_ORDER.map(href => NAV.find(item => item.href === href))
const SETTINGS_ITEM = NAV.find(item => item.href === '/insights/settings')

const STORAGE_KEY = 'adminSidebarCollapsed'
const EXPANDED_WIDTH = 190
const COLLAPSED_WIDTH = 56
const HEADER_HEIGHT = 78

function NavButton({ item, active, collapsed, onClick }) {
  const Icon = item.icon
  return (
    <button
      onClick={onClick}
      title={item.label}
      style={{
        display: 'flex', alignItems: 'center', gap: 9, width: '100%',
        justifyContent: collapsed ? 'center' : 'flex-start', textAlign: 'left',
        padding: collapsed ? '9px 0' : '9px 12px', marginBottom: 2, borderRadius: 6, border: 'none', cursor: 'pointer',
        fontSize: 13, fontWeight: active ? 700 : 500, fontFamily: 'inherit',
        background: active ? 'var(--surface-2)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-muted)',
      }}
    >
      <Icon className="size-4" style={{ flexShrink: 0 }} />
      {!collapsed && item.label}
    </button>
  )
}

export default function AdminSidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const activeItem = NAV.find(item => item.match(pathname))
  const [collapsed, setCollapsed] = useState(false)
  const [ready, setReady] = useState(false)

  // Reads the saved preference once on mount — kept in a separate `ready`
  // flag rather than initializing useState from localStorage directly, so
  // server-rendered and first-client-render markup match (avoids a
  // hydration mismatch warning) and only flips to the saved value once
  // we're safely on the client.
  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved === '1') setCollapsed(true)
    setReady(true)
  }, [])

  function toggle() {
    setCollapsed(c => {
      window.localStorage.setItem(STORAGE_KEY, c ? '0' : '1')
      return !c
    })
  }

  const width = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH
  const ToggleIcon = collapsed ? SidebarOpen : SidebarClose

  return (
    <nav
      style={{
        width, flexShrink: 0, borderRight: '1px solid var(--line)', minHeight: `calc(100vh - ${HEADER_HEIGHT}px)`,
        padding: '14px 10px', display: 'flex', flexDirection: 'column', position: 'sticky', top: HEADER_HEIGHT,
        visibility: ready ? 'visible' : 'hidden', transition: 'width 0.15s ease',
      }}
    >
      {/* The collapse/expand toggle sits centered on the sidebar's right
          edge (half overlapping the border), not inline with the nav
          content — a floating handle rather than a menu item. */}
      <button
        onClick={toggle}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        style={{
          position: 'absolute', top: '50%', right: -12, transform: 'translateY(-50%)',
          width: 24, height: 24, borderRadius: '50%', background: 'var(--surface)',
          border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', padding: 0, color: 'var(--text-muted)', boxShadow: '0 1px 3px rgba(0,0,0,0.12)', zIndex: 21,
        }}
      >
        <ToggleIcon className="size-3.5" />
      </button>

      <div>
        {ORDERED_NAV.map(item => (
          <NavButton key={item.href} item={item} active={item === activeItem} collapsed={collapsed} onClick={() => router.push(item.href)} />
        ))}
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ borderTop: '1px solid var(--line)', paddingTop: 8 }}>
        <NavButton item={SETTINGS_ITEM} active={SETTINGS_ITEM === activeItem} collapsed={collapsed} onClick={() => router.push(SETTINGS_ITEM.href)} />
      </div>
    </nav>
  )
}
