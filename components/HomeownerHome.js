'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { authFetch } from '@/lib/authFetch'
import { ZONES } from '@/lib/criteria'
import PhotoUpload from './PhotoUpload'
import ThemeToggle from './ThemeToggle'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { useConfirmDialog } from '@/components/ConfirmDialogProvider'

// Homeowner-facing capture view. Deliberately has NO status/compliance UI
// anywhere — homeowners only ever record raw facts (what they see, a
// photo, an optional distance). All requests go through the
// /api/homeowner/entries route, which is the actual place compliance
// status is kept out of the response — this component staying "clean"
// is a UX nicety, not the security boundary.

// `propertyId` + `previewMode`: used only by the admin-only Preview as
// Homeowner tool (app/manage/[id]/homeowner-preview/page.js) so staff can
// QA this exact screen against a real property without a second account.
// A real homeowner never passes these — their own hook call omits both,
// same as before this override existed.
export default function HomeownerHome({ user, propertyId = null, previewMode = false }) {
  const router = useRouter()
  const { confirmDialog, alertDialog } = useConfirmDialog()
  const [property, setProperty] = useState(null)
  const [entries,  setEntries]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [zone,     setZone]     = useState(ZONES[0])
  const [note,     setNote]     = useState('')
  const [detail,   setDetail]   = useState('')
  const [photoUrl, setPhotoUrl] = useState(null)
  const [photoKey, setPhotoKey] = useState(0)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState(null)
  const [finishing, setFinishing] = useState(false)

  const qs = propertyId ? `?propertyId=${propertyId}` : ''

  async function load() {
    setLoading(true)
    try {
      const res = await authFetch(`/api/homeowner/entries${qs}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not load your property')
      setProperty(data.property)
      setEntries(data.entries ?? [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [propertyId])

  async function finish() {
    if (entries.length === 0) {
      await alertDialog("Add at least one note before finishing — walk around and jot down what you see.")
      return
    }
    // Preview mode never calls the real finish endpoint — that route sends
    // a live notification email and flips the property's real
    // homeowner_status, neither of which should happen from a staff
    // clicking around to see what this screen looks like.
    if (previewMode) {
      await alertDialog("Preview mode — this doesn't actually submit anything or email the team. A real homeowner clicking this would.")
      return
    }
    if (!(await confirmDialog("Ready to send this to your inspector? You can still add more later if you remember something."))) return
    setFinishing(true)
    try {
      const res = await authFetch('/api/homeowner/finish', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not submit')
      setProperty(p => ({ ...p, homeowner_status: 'submitted' }))
    } catch (err) {
      await alertDialog('Could not submit: ' + err.message)
    } finally {
      setFinishing(false)
    }
  }

  async function save() {
    if (!note.trim()) { await alertDialog('Add a quick note describing what you see.'); return }
    setSaving(true)
    try {
      const res = await authFetch('/api/homeowner/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zone, note: note.trim(), detail: detail.trim() || null, photo_url: photoUrl || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setEntries(prev => [data.entry, ...prev])
      setNote(''); setDetail(''); setPhotoUrl(null); setPhotoKey(k => k + 1)
    } catch (err) {
      await alertDialog('Save failed: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const CONTENT_WIDTH = 640

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 48 }}>
      {previewMode && (
        <div style={{ position: 'sticky', top: 0, zIndex: 21, background: 'var(--accent)', color: '#fff', textAlign: 'center', padding: '6px 12px', fontSize: 11, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Preview mode — this is what the homeowner sees. Notes you add here are saved for real; "I'm Done" does not submit or email anyone.
        </div>
      )}
      <header style={{ position: 'sticky', top: previewMode ? 30 : 0, zIndex: 20, background: 'var(--header-bg)', borderBottom: '1px solid var(--line)' }}>
        <div style={{ maxWidth: CONTENT_WIDTH, margin: '0 auto', padding: '18px 16px 14px' }}>
          <span style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 4, fontFamily: 'monospace', display: 'block' }}>
            Field Notes · Wildfire Inspection
          </span>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '0.02em', margin: 0, color: 'var(--header-text)' }}>
                {property?.address ?? 'Your Property'}
              </h1>
              <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--header-text)', opacity: 0.6 }}>{user?.user_metadata?.full_name || user?.email}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ThemeToggle />
              {previewMode ? (
                <button
                  onClick={() => router.push(`/manage/${propertyId}`)}
                  style={{ fontSize: 10.5, fontFamily: 'monospace', color: 'var(--header-text)', opacity: 0.7, background: 'none', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4, padding: '4px 8px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                >
                  ← Back to Property
                </button>
              ) : (
                <button
                  onClick={() => supabase.auth.signOut().then(() => { window.location.href = '/' })}
                  style={{ fontSize: 10.5, fontFamily: 'monospace', color: 'var(--header-text)', opacity: 0.7, background: 'none', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4, padding: '4px 8px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                >
                  Sign Out
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: CONTENT_WIDTH, margin: '0 auto', padding: '20px 16px 64px' }}>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 20 }}>
          Walk around your property and add a note and photo for anything you notice — vegetation, fencing, vents, your roof, decks, anything. Your inspector will review everything you add.
        </p>

        {error && <p style={{ fontSize: 13, color: 'var(--warn)', marginBottom: 16 }}>{error}</p>}

        {!loading && !property && !error && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No property is linked to your account yet — ask your inspector to send a new invite.</p>
        )}

        {(property?.homeowner_status === 'submitted' || property?.homeowner_status === 'done') && (
          <div style={{ background: 'rgba(58,125,68,.15)', border: '1px solid var(--ok)', borderRadius: 6, padding: '14px 16px', marginBottom: 20 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ok)', margin: '0 0 4px' }}>✓ Sent to your inspector</p>
            <p style={{ fontSize: 13, color: 'var(--text)', margin: '0 0 10px', lineHeight: 1.5 }}>Your inspector has been notified and will review everything you added. Your formal report will be ready within 48 hours. Remembered something else? Add it below.</p>
            <button
              onClick={finish}
              disabled={finishing}
              style={{ fontSize: 11.5, fontFamily: 'monospace', color: 'var(--ok)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline' }}
            >
              {finishing ? 'Sending…' : 'Notify my inspector again'}
            </button>
          </div>
        )}

        {property && (
          <>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 6, padding: 16, marginBottom: 20 }}>
              <div style={{ marginBottom: 14 }}>
                <Label>What area?</Label>
                <Select value={zone} onValueChange={setZone}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ZONES.map(z => <SelectItem key={z} value={z}>{z}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div style={{ marginBottom: 14 }}>
                <Label>What do you see?</Label>
                <Input type="text" placeholder="Short description" value={note} onChange={e => setNote(e.target.value)} />
              </div>

              <div style={{ marginBottom: 14 }}>
                <Label>Anything else? (optional)</Label>
                <Input type="text" placeholder="More detail if useful" value={detail} onChange={e => setDetail(e.target.value)} />
              </div>

              <div style={{ marginBottom: 16 }}>
                <Label>Photo</Label>
                <PhotoUpload key={photoKey} propertyId={property.id} onPhotoUrl={setPhotoUrl} />
              </div>

              <Button onClick={save} disabled={saving} className="w-full text-[13px] font-bold uppercase tracking-wide py-3 h-auto">
                {saving ? 'Saving…' : 'Add This'}
              </Button>
            </div>

            <h2 style={{ fontSize: 13, fontFamily: 'monospace', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>
              What you've added ({entries.length})
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {entries.map(en => (
                <div key={en.id} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 6, padding: 12 }}>
                  <span style={{ fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--accent)' }}>{en.zone}</span>
                  <p style={{ fontSize: 14, color: 'var(--text)', margin: '4px 0' }}>{en.note}</p>
                  {en.detail && <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>{en.detail}</p>}
                  {en.photo_url && <img src={en.photo_url} alt="" style={{ marginTop: 8, maxHeight: 160, borderRadius: 4, border: '1px solid var(--line)' }} />}
                </div>
              ))}
              {entries.length === 0 && !loading && (
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Nothing added yet — start with whatever you're standing in front of.</p>
              )}
            </div>

            {property.homeowner_status !== 'submitted' && property.homeowner_status !== 'done' && (
              <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--line)' }}>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 12 }}>
                  Walked the whole property? Once you're done, your inspector will get everything you've added, review it, and put together your formal report — usually within 48 hours.
                </p>
                <Button onClick={finish} disabled={finishing} variant="outline" className="w-full border-primary/40 text-primary hover:bg-primary/10 hover:text-primary text-[13px] font-bold uppercase tracking-wide py-3 h-auto">
                  {finishing ? 'Submitting…' : "I'm Done — Send to My Inspector"}
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
