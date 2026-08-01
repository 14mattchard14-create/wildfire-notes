'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import ThemeToggle from '@/components/ThemeToggle'
import BrandLogo from '@/components/BrandLogo'
import BackNav from '@/components/BackNav'
import AdminSidebar from '@/components/AdminSidebar'
import EntriesList from '@/components/EntriesList'
import EntryForm from '@/components/EntryForm'
import GuidedEntry from '@/components/GuidedEntry'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Pencil, Check, X, ClipboardList } from 'lucide-react'

// This page used to be a 4-tab property workspace (Entries / Site Notes /
// Priorities / Report). Site Notes is now embedded directly in Guided Entry
// (one freeform note per segment), Priorities was removed outright, and
// Report generation/editing/publishing/customer-send moved to its own page
// at /manage/[id]/review — reachable from the button below or from the
// Review column on the properties table.

export default function PropertyReviewPage() {
  const { id } = useParams()
  const router = useRouter()
  const { user, loading, isHomeowner, profileReady } = useAuth()
  const [property, setProperty] = useState(null)
  const [entries,  setEntries]  = useState([])
  const [fetching, setFetching] = useState(true)
  const [guidedOpen, setGuidedOpen] = useState(false)
  const [editingAddress, setEditingAddress] = useState(false)
  const [addressDraft, setAddressDraft] = useState('')
  const [savingAddress, setSavingAddress] = useState(false)

  const load = useCallback(async () => {
    setFetching(true)
    const [{ data: prop }, { data: ents }] = await Promise.all([
      supabase.from('properties').select('*').eq('id', id).maybeSingle(),
      supabase.from('entries').select('*').eq('property_id', id).order('created_at', { ascending: false }),
    ])
    setProperty(prop)
    setEntries(ents ?? [])
    setFetching(false)
  }, [id])

  useEffect(() => { load() }, [load])

  function startEditAddress() {
    setAddressDraft(property?.address ?? '')
    setEditingAddress(true)
  }

  async function saveAddress() {
    if (!addressDraft.trim()) return
    setSavingAddress(true)
    const { error } = await supabase.from('properties').update({ address: addressDraft.trim() }).eq('id', id)
    setSavingAddress(false)
    if (error) { alert('Could not update address: ' + error.message); return }
    setProperty(p => ({ ...p, address: addressDraft.trim() }))
    setEditingAddress(false)
  }

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

  const CONTENT_WIDTH = 900

  return (
    <div style={{ minHeight: '100vh' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--header-bg)', borderBottom: '1px solid var(--line)' }}>
        <div style={{ padding: '18px 20px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ marginBottom: 4 }}><BrandLogo /></div>
            <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.02em', textTransform: 'uppercase', margin: 0, color: 'var(--header-text)' }}>Properties</h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
        <AdminSidebar />
        <div style={{ flex: 1, minWidth: 0 }}>
          <BackNav href="/manage" label="All Properties" maxWidth="none" />
          <main style={{ maxWidth: CONTENT_WIDTH, padding: '20px 24px 64px' }}>
        {fetching && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading…</p>}

        {!fetching && (
          <>
            <div style={{ marginBottom: 16, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                {editingAddress ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Input
                      value={addressDraft}
                      onChange={e => setAddressDraft(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveAddress(); if (e.key === 'Escape') setEditingAddress(false) }}
                      autoFocus
                      className="h-8 max-w-xs text-[14px]"
                    />
                    <button onClick={saveAddress} disabled={savingAddress} title="Save" style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: 'var(--ok)' }}>
                      <Check className="size-4" />
                    </button>
                    <button onClick={() => setEditingAddress(false)} title="Cancel" style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: 'var(--text-muted)', opacity: 0.6 }}>
                      <X className="size-4" />
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h1
                      onClick={startEditAddress}
                      title="Click to edit address"
                      style={{ fontSize: 20, fontWeight: 700, letterSpacing: '0.02em', margin: 0, color: 'var(--text)', cursor: 'pointer' }}
                    >
                      {property?.address ?? 'Loading…'}
                    </h1>
                    {property && (
                      <button onClick={startEditAddress} title="Edit address" style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                        <Pencil className="size-3.5" />
                      </button>
                    )}
                  </div>
                )}
                {property?.visit_date && <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)' }}>Visit: {property.visit_date}</span>}
              </div>

              <Button
                variant="outline"
                onClick={() => router.push(`/manage/${id}/review`)}
                disabled={entries.length === 0}
                title={entries.length === 0 ? 'Log at least one entry first' : undefined}
                className="gap-1.5 text-[11.5px] font-bold uppercase tracking-wide h-auto py-2 px-3 shrink-0"
              >
                <ClipboardList className="size-3.5" /> Review & Publish
              </Button>
            </div>

            <Button
              variant="outline"
              onClick={() => setGuidedOpen(true)}
              className="w-full border-primary/40 text-primary hover:bg-primary/10 hover:text-primary text-[12px] uppercase tracking-wide h-auto py-3 mb-4 font-mono normal-case"
            >
              ◎ Guided Entry — Walk Me Through It
            </Button>
            <EntryForm propertyId={id} onSaved={load} user={user} />
            <EntriesList entries={entries} onDeleted={load} />
            {guidedOpen && (
              <GuidedEntry
                propertyId={id}
                property={property}
                entries={entries}
                user={user}
                onClose={() => { setGuidedOpen(false); load() }}
                onSaved={load}
              />
            )}
          </>
        )}
          </main>
        </div>
      </div>
    </div>
  )
}
