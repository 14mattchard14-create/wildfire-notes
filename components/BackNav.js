'use client'

import { useRouter } from 'next/navigation'

// A thin nav strip placed directly under the sticky header (not part of it,
// and not itself sticky) carrying just a "← back to [wherever this page's
// parent is]" link. Separate from BrandLogo, which always goes home —
// this goes to the logical previous page instead (which can differ, e.g.
// the review page's back target is the property page, not the properties
// table).
export default function BackNav({ href, label, maxWidth = 900 }) {
  const router = useRouter()
  return (
    <div style={{ background: 'var(--bg)', borderBottom: '1px solid var(--line)' }}>
      <div style={{ maxWidth, margin: '0 auto', padding: '9px 16px' }}>
        <button
          onClick={() => router.push(href)}
          style={{ fontSize: 10.5, fontFamily: 'monospace', color: 'var(--accent)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
        >
          ← {label}
        </button>
      </div>
    </div>
  )
}
