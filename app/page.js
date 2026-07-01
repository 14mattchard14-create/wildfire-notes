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

const TABS = ['Entries', 'Site Notes', 'Fire Data', 'Export']

const s = {
  page:      { maxWidth: 640, margin: '0 auto', minHeight: '100vh', paddingBottom: 48 },
  header:    { position: 'sticky', top: 0, zIndex: 20, background: '#1b1917', borderBottom: '1px solid #3a352f', padding: '18px 16px 14px' },
  eyebrow:   { fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#be5b1d', marginBottom: 4, fontFamily: 'monospace', display: 'block' },
  h1:        { fontSize: 22, fontWeight: 700, letterSpacing: '0.02em', textTransform: 'uppercase', margin: '0 0 12px', color: '#ece6db' },
  nav:       { position: 'sticky', top: 88, zIndex: 10, background: '#1b1917', borderBottom: '1px solid #3a352f', display: 'flex' },
  tab:       { flex: 1, padding: '12px 4px', fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.06em', textTransform: 'uppercase', background: 'transparent', border: 'none', borderBottom: '2px solid transparent', color: '#9a9285', cursor: 'pointer' },
  tabActive: { flex: 1, padding: '12px 4px', fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.06em', textTransform: 'uppercase', background: 'transparent', border: 'none', borderBottom: '2px solid #be5b1d', color: '#ece6db', cursor: 'pointer' },
  main:      { flex: 1, padding: '16px 16px 64px' },
  empty:     { color: '#9a9285', fontSize: 13, textAlign: 'center', marginTop: 48 },
}

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
    <div style={{ minHeight: '100vh', background: '#1b1917', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: '#9a9285', fontFamily: 'monospace', fontSize: 13 }}>Loading…</span>
    </div>
  )

  if (!user) return <LoginPage />

  const userName = user.user_metadata?.full_name || user.email

  return (
    <div style={s.page}>
      <header style={s.header}>
        <span style={s.eyebrow}>Field Notes · Wildfire Inspection</span>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <h1 style={{ ...s.h1, margin: 0 }}>Site Intake</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#9a9285' }}>{userName}</span>
            <button
              onClick={() => supabase.auth.signOut()}
              style={{ fontSize: 10.5, fontFamily: 'monospace', color: '#9a9285', background: 'none', border: '1px solid #3a352f', borderRadius: 4, padding: '4px 8px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em' }}
            >
              Sign Out
            </button>
          </div>
        </div>
        <PropertySelector selected={property} onSelect={setProperty} user={user} />
      </header>

      <nav style={s.nav}>
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={activeTab === tab ? s.tabActive : s.tab}>
            {tab}
          </button>
        ))}
      </nav>

      <main style={s.main}>
        {!property && <p style={s.empty}>Select or create a property above to begin.</p>}

        {property && activeTab === 'Entries' && (
          <>
            <button
              onClick={() => setGuidedOpen(true)}
              style={{ width: '100%', background: 'transparent', border: '1px solid #be5b1d', borderRadius: 4, color: '#be5b1d', fontSize: 12, fontFamily: 'monospace', letterSpacing: '0.04em', textTransform: 'uppercase', padding: 12, cursor: 'pointer', marginBottom: 16 }}
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
        {property && activeTab === 'Fire Data'  && <FireData property={property} />}
        {property && activeTab === 'Export'     && <ExportPanel property={property} entries={entries} user={user} />}
      </main>
    </div>
  )
}
