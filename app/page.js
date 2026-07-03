'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import PropertySelector from '@/components/PropertySelector'
import EntryForm        from '@/components/EntryForm'
import EntriesList      from '@/components/EntriesList'
import SiteNotes        from '@/components/SiteNotes'
import FireData         from '@/components/FireData'
import ExportPanel      from '@/components/ExportPanel'
import LoginPage        from '@/app/login/page'
import GuidedEntry      from '@/components/GuidedEntry'
import ThemeToggle      from '@/components/ThemeToggle'

const TABS = ['Entries', 'Site Notes', 'Fire Data', 'Export']

export default function Home() {
  const { user, loading } = useAuth()
  const [property,   setProperty]   = useState(null)
  const [activeTab,  setActiveTab]  = useState('Entries')
  const [entries,    setEntries]    = useState([])
  const [refreshKey, setRefreshKey] = useState(0)
  const [guidedOpen, setGuidedOpen] = useState(false)

  useEffect(() => {
    if (!property) { setEntries([]); return }
    supabase
      .from('entries')
      .select('*')
      .eq('property_id', property.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setEntries(data ?? []))
  }, [property, refreshKey])

  const onEntrySaved = () => setRefreshKey(k => k + 1)

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: 13 }}>Loading…</span>
    </div>
  )

  if (!user) return <LoginPage />

  const userName = user.user_metadata?.full_name || user.email

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', minHeight: '100vh', paddingBottom: 48 }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--header-bg)', borderBottom: '1px solid var(--line)', padding: '18px 16px 14px' }}>
        <span style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 4, fontFamily: 'monospace', display: 'block' }}>
          Field Notes · Wildfire Inspection
        </span>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.02em', textTransform: 'uppercase', margin: 0, color: 'var(--header-text)' }}>Site Intake</h1>
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
        <PropertySelector selected={property} onSelect={setProperty} user={user} />
      </header>

      <nav style={{ position: 'sticky', top: 88, zIndex: 10, background: 'var(--bg)', borderBottom: '1px solid var(--line)', display: 'flex' }}>
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            flex: 1, padding: '12px 4px', fontSize: 11, fontFamily: 'monospace',
            letterSpacing: '0.06em', textTransform: 'uppercase', background: 'transparent', border: 'none',
            borderBottom: activeTab === tab ? '2px solid var(--tab-active)' : '2px solid transparent',
            color: activeTab === tab ? 'var(--text)' : 'var(--tab-text)',
            cursor: 'pointer',
          }}>
            {tab}
          </button>
        ))}
      </nav>

      <main style={{ flex: 1, padding: '16px 16px 64px' }}>
        {!property && <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', marginTop: 48 }}>Select or create a property above to begin.</p>}

        {property && activeTab === 'Entries' && (
          <>
            <button
              onClick={() => setGuidedOpen(true)}
              style={{ width: '100%', background: 'transparent', border: '1px solid var(--accent)', borderRadius: 4, color: 'var(--accent)', fontSize: 12, fontFamily: 'monospace', letterSpacing: '0.04em', textTransform: 'uppercase', padding: 12, cursor: 'pointer', marginBottom: 16 }}
            >
              ◎ Guided Entry — Walk Me Through It
            </button>
            <EntryForm propertyId={property.id} onSaved={onEntrySaved} user={user} />
            <EntriesList entries={entries} onDeleted={onEntrySaved} />
            {guidedOpen && (
              <GuidedEntry
                propertyId={property.id}
                user={user}
                onClose={() => { setGuidedOpen(false); onEntrySaved() }}
                onSaved={onEntrySaved}
              />
            )}
          </>
        )}

        {property && activeTab === 'Site Notes' && <SiteNotes propertyId={property.id} />}
        {property && activeTab === 'Fire Data'  && <FireData property={property} propertyId={property.id} />}
        {property && activeTab === 'Export'     && <ExportPanel property={property} entries={entries} user={user} />}
      </main>
    </div>
  )
}
