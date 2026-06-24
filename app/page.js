'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import PropertySelector from '@/components/PropertySelector'
import EntryForm      from '@/components/EntryForm'
import EntriesList    from '@/components/EntriesList'
import SiteNotes      from '@/components/SiteNotes'
import Priorities     from '@/components/Priorities'
import ExportPanel    from '@/components/ExportPanel'

const TABS = ['Entries', 'Site Notes', 'Priorities', 'Export']

export default function Home() {
  const [property,    setProperty]    = useState(null)   // selected property object
  const [activeTab,   setActiveTab]   = useState('Entries')
  const [entries,     setEntries]     = useState([])
  const [refreshKey,  setRefreshKey]  = useState(0)      // bump to re-fetch entries

  // Fetch entries whenever the property changes or a new entry is saved
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

  return (
    <div className="max-w-2xl mx-auto flex flex-col min-h-screen">

      {/* ── Top bar ── */}
      <header className="sticky top-0 z-20 bg-stone-950 border-b border-stone-800 px-4 pt-5 pb-3">
        <p className="text-orange-600 text-[10px] font-mono tracking-widest uppercase mb-1">
          Field Notes · Wildfire Inspection
        </p>
        <h1 className="font-bold text-xl tracking-wide uppercase mb-3">Site Intake</h1>
        <PropertySelector selected={property} onSelect={setProperty} />
      </header>

      {/* ── Tab bar ── */}
      <nav className="sticky top-[88px] z-10 bg-stone-950 border-b border-stone-800 flex">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 text-[10px] font-mono tracking-wider uppercase transition-colors
              ${activeTab === tab
                ? 'text-stone-100 border-b-2 border-orange-600'
                : 'text-stone-500 border-b-2 border-transparent'}`}
          >
            {tab}
          </button>
        ))}
      </nav>

      {/* ── Tab content ── */}
      <main className="flex-1 p-4 pb-16">

        {!property && (
          <p className="text-stone-500 text-sm text-center mt-12">
            Select or create a property above to begin.
          </p>
        )}

        {property && activeTab === 'Entries' && (
          <>
            <EntryForm propertyId={property.id} onSaved={onEntrySaved} />
            <EntriesList entries={entries} onDeleted={onEntrySaved} />
          </>
        )}

        {property && activeTab === 'Site Notes' && (
          <SiteNotes propertyId={property.id} />
        )}

        {property && activeTab === 'Priorities' && (
          <Priorities propertyId={property.id} />
        )}

        {property && activeTab === 'Export' && (
          <ExportPanel property={property} entries={entries} />
        )}

      </main>
    </div>
  )
}
