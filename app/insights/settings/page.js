'use client'

import { Settings } from 'lucide-react'

// Placeholder — no settings live here yet. Reserved spot in the /insights
// sidebar for whatever configuration (e.g. auto-injecting applied lessons
// into the report-draft prompt, notification preferences, etc.) comes next.
export default function InsightsSettingsPage() {
  return (
    <div style={{ maxWidth: 520, textAlign: 'center', margin: '60px auto 0', color: 'var(--text-muted)' }}>
      <Settings className="size-6" style={{ margin: '0 auto 10px', opacity: 0.5 }} />
      <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>Settings for this section — coming soon.</p>
    </div>
  )
}
