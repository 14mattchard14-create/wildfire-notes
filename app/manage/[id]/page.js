'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { authFetch } from '@/lib/authFetch'
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
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Pencil, Check, X, ClipboardList, UserCog, UserPlus, Eye } from 'lucide-react'

// This page used to be a 4-tab property workspace (Entries / Site Notes /
// Priorities / Report). Site Notes is now embedded directly in Guided Entry
// (one freeform note per segment), Priorities was removed outright, and
// Report generation/editing/publishing/customer-send moved to its own page
// at /manage/[id]/review — reachable from the button below or from the
// Review column on the properties table.

export default function PropertyReviewPage() {
  const { id } = useParams()
  const router = useRouter()
  const { user, loading, isHomeowner, isAdmin, profileReady } = useAuth()
  const [property, setProperty] = useState(null)
  const [entries,  setEntries]  = useState([])
  const [fetching, setFetching] = useState(true)
  const [guidedOpen, setGuidedOpen] = useState(false)
  const [editingAddress, setEditingAddress] = useState(false)
  const [addressDraft, setAddressDraft] = useState('')
  const [savingAddress, setSavingAddress] = useState(false)
  const [staff, setStaff] = useState([])
  const [savingInspector, setSavingInspector] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteLink, setInviteLink] = useState(null)
  const [inviteCopied, setInviteCopied] = useState(false)

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

  // Assigned Inspector picker is admin-only (same permission tier as
  // creating properties/invites, per PORTALS_AND_ROLES_PLAN.md) — only
  // fetch the staff list when an admin is actually viewing this page.
  useEffect(() => {
    if (!isAdmin) return
    authFetch('/api/admin/users').then(res => res.json()).then(data => setStaff(data.users ?? [])).catch(() => {})
  }, [isAdmin])

  async function setAssignedInspector(inspectorId) {
    setSavingInspector(true)
    const { error } = await supabase.from('properties').update({ assigned_inspector_id: inspectorId || null }).eq('id', id)
    setSavingInspector(false)
    if (error) { alert('Could not update assigned inspector: ' + error.message); return }
    setProperty(p => ({ ...p, assigned_inspector_id: inspectorId || null }))
  }

  // Restored from the pre-rebuild PropertySelector.js — that component
  // became orphaned when /manage was rebuilt as a full table (round 33+),
  // taking the only "Invite Homeowner" entry point in the app with it.
  // Since then the sole way a homeowner invite got created was the public
  // guided-request flow on charred-guard-site. This puts a manual trigger
  // back for the case where a lead didn't come through that funnel.
  async function inviteHomeowner() {
    if (!inviteEmail.trim()) return
    setInviting(true); setInviteLink(null); setInviteCopied(false)
    try {
      const res = await authFetch('/api/homeowner-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId: id, email: inviteEmail.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not create invite')
      setInviteLink(`${window.location.origin}/invite/${data.token}`)
    } catch (err) {
      alert('Invite failed: ' + err.message)
    } finally {
      setInviting(false)
    }
  }

  function copyInviteLink() {
    if (!inviteLink) return
    navigator.clipboard.writeText(inviteLink)
    setInviteCopied(true)
    setTimeout(() => setInviteCopied(false), 2000)
  }

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

                {/* Assigning who sees this property in the CG Inspector
                    portal (filtered to assigned_inspector_id there,
                    regardless of the assignee's overall role). Two tiers:
                    any signed-in staff account can self-assign with one
                    click (no admin needed — this is what unblocks a single-
                    operator account before anyone's gone through /users to
                    set up admin), while assigning it to *someone else*
                    stays admin-only, matching property/invite creation's
                    permission tier per PORTALS_AND_ROLES_PLAN.md. */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  <UserCog className="size-3.5" style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  {property?.assigned_inspector_id ? (
                    <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                      Assigned to: {property.assigned_inspector_id === user?.id ? 'you' : (staff.find(s => s.id === property.assigned_inspector_id)?.fullName || staff.find(s => s.id === property.assigned_inspector_id)?.email || property.assigned_inspector_id)}
                      {' '}
                      <button
                        onClick={() => setAssignedInspector(null)}
                        disabled={savingInspector}
                        style={{ background: 'none', border: 'none', padding: 0, marginLeft: 4, color: 'var(--warn)', fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        Unassign
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setAssignedInspector(user?.id)}
                      disabled={savingInspector || !user}
                      style={{ fontSize: 11, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: 20, padding: '3px 9px', background: 'transparent', cursor: 'pointer' }}
                    >
                      Assign to me
                    </button>
                  )}

                  {isAdmin && (
                    <Select
                      value={property?.assigned_inspector_id || 'unassigned'}
                      onValueChange={val => setAssignedInspector(val === 'unassigned' ? null : val)}
                      disabled={savingInspector}
                    >
                      <SelectTrigger className="h-7 w-[200px]" style={{ fontSize: 11.5 }}>
                        <SelectValue placeholder="Assign someone else…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {staff.map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.fullName || s.email}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {isAdmin && staff.length === 0 && (
                    <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>(no other staff accounts found)</span>
                  )}
                </div>

                {/* Manual homeowner invite — the only other way an invite
                    gets created is the public guided-request flow on
                    charred-guard-site, which won't apply to every lead
                    (phone-in, walk-up, referral). Any staff role can send
                    one; the API only blocks actual homeowner accounts. */}
                <div style={{ marginTop: 8 }}>
                  {!inviteOpen && !inviteLink && (
                    <button
                      onClick={() => setInviteOpen(true)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: 20, padding: '3px 9px', background: 'transparent', cursor: 'pointer' }}
                    >
                      <UserPlus className="size-3" /> Invite Homeowner
                    </button>
                  )}

                  {inviteOpen && !inviteLink && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, border: '1px solid var(--line)', background: 'var(--surface)', borderRadius: 6, padding: 10, maxWidth: 420 }}>
                      <span style={{ fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Homeowner's email</span>
                      <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: 0 }}>The invite link only works with this exact email — it locks the field on their end.</p>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Input
                          type="email"
                          placeholder="homeowner@email.com"
                          value={inviteEmail}
                          onChange={e => setInviteEmail(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && inviteHomeowner()}
                          autoFocus
                          className="h-8 text-[13px]"
                        />
                        <Button onClick={inviteHomeowner} disabled={inviting || !inviteEmail.trim()} className="h-8 shrink-0 px-3 font-mono text-[10.5px] normal-case">
                          {inviting ? 'Generating…' : 'Generate Link'}
                        </Button>
                        <Button variant="outline" onClick={() => { setInviteOpen(false); setInviteEmail('') }} className="h-8 shrink-0 px-3 font-mono text-[10.5px] normal-case">
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {inviteLink && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, border: '1px solid var(--line)', background: 'var(--surface)', borderRadius: 6, padding: 10, maxWidth: 460 }}>
                      <span style={{ fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Invite link for {inviteEmail} — share this separately</span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Input readOnly value={inviteLink} onFocus={e => e.target.select()} className="h-8 font-mono text-[12px]" />
                        <Button variant="outline" onClick={copyInviteLink} className="h-8 shrink-0 px-3 font-mono text-[10.5px] normal-case">
                          {inviteCopied ? '✓ Copied' : 'Copy'}
                        </Button>
                      </div>
                      <button onClick={() => { setInviteOpen(false); setInviteLink(null); setInviteEmail('') }} style={{ alignSelf: 'flex-start', fontSize: 10.5, color: 'var(--text-muted)', textDecoration: 'underline', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                        Done
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <Button
                  variant="outline"
                  onClick={() => router.push(`/inspector/${id}`)}
                  title="Open the mobile-first field capture portal for this property"
                  className="gap-1.5 text-[11.5px] font-bold uppercase tracking-wide h-auto py-2 px-3"
                >
                  <UserCog className="size-3.5" /> Field Capture
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push(`/manage/${id}/homeowner-preview`)}
                  title="See exactly what a homeowner sees on this property — safe to click around, nothing is sent to the customer"
                  className="gap-1.5 text-[11.5px] font-bold uppercase tracking-wide h-auto py-2 px-3"
                >
                  <Eye className="size-3.5" /> Preview as Homeowner
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push(`/manage/${id}/review`)}
                  disabled={entries.length === 0}
                  title={entries.length === 0 ? 'Log at least one entry first' : undefined}
                  className="gap-1.5 text-[11.5px] font-bold uppercase tracking-wide h-auto py-2 px-3"
                >
                  <ClipboardList className="size-3.5" /> Review & Publish
                </Button>
              </div>
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
