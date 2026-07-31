'use client'

import { useRouter } from 'next/navigation'

// The "logo" — small monospace brand mark used in every inspector-facing
// header. Always navigates to /manage (the properties table), which is
// home for this app. Kept as a shared component so every page's header
// stays in sync rather than re-implementing the same clickable span.
export default function BrandLogo() {
  const router = useRouter()
  return (
    <button
      onClick={() => router.push('/manage')}
      title="Home — All Properties"
      style={{
        display: 'block', background: 'none', border: 'none', padding: 0, margin: 0,
        cursor: 'pointer', textAlign: 'left',
        fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase',
        color: 'var(--accent)', fontFamily: 'monospace',
      }}
    >
      Field Notes · Wildfire Inspection
    </button>
  )
}
