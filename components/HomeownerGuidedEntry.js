'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { authFetch } from '@/lib/authFetch'
import { GUIDED_SEGMENTS } from '@/lib/criteria'
import PhotoUpload from './PhotoUpload'
import ThemeToggle from './ThemeToggle'
import { Button } from '@/components/ui/button'
import { useConfirmDialog } from '@/components/ConfirmDialogProvider'

// Homeowner-facing guided walkthrough. This is the real self-guided
// AI-assisted experience the marketing site promises ("walks you through
// exactly what to photograph, so nothing gets missed") — replaces the
// older flat single-form HomeownerHome.js.
//
// Deliberately simpler than the inspector's GuidedEntry.js in three ways,
// on purpose, not as a stopgap:
//   1. No per-item checklist logging (photo+status+note per WPH item) —
//      that's a trained-inspector workflow. Homeowners take ONE whole-side
//      photo per segment; the checklist below is shown as plain-language
//      reference text only, never clickable/loggable.
//   2. No compliance status anywhere, full stop — matches
//      wildfire-notes-ai-design-context.md's explicit rule. Status is
//      determined later, server-side, from what's captured here.
//   3. No satellite pre-flight step yet (that API is still
//      employee/inspector-only) — homeowners start directly at the first
//      physical segment. Worth adding later, not required for the core
//      promise.
//
// Plants and Measurements (present in GuidedEntry.js) are also deferred —
// same reasoning as satellite: not required for the core "photo a side,
// get AI guidance" loop this replaces HomeownerHome.js with.
//
// `propertyId` + `previewMode`: staff-only QA override, same contract as
// HomeownerHome.js had — see app/manage/[id]/homeowner-preview/page.js.
export default function HomeownerGuidedEntry({ user, propertyId = null, previewMode = false }) {
  const router = useRouter()
  const { confirmDialog, alertDialog } = useConfirmDialog()
  const [property, setProperty] = useState(null)
  const [segRows, setSegRows] = useState({}) // segment_key -> { photo_url, ai_suggestions, notes }
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [activeIdx, setActiveIdx] = useState(0)
  const [photoDraft, setPhotoDraft] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [notesDraft, setNotesDraft] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)
  const [finishing, setFinishing] = useState(false)

  const qs = propertyId ? `?propertyId=${propertyId}` : ''
  const activeSegment = GUIDED_SEGMENTS[activeIdx]
  const activeRow = segRows[activeSegment.key]

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authFetch(`/api/homeowner/segments${qs}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not load your property')
      setProperty(data.property)
      const map = {}
      ;(data.segments || []).forEach(row => { map[row.segment_key] = row })
      setSegRows(map)
    } catch (err) {
      setLoadError(err.message)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId])

  useEffect(() => { load() }, [load])

  // Re-sync the notes draft whenever the active segment changes, or after
  // our own save updates that segment's saved value — but not on
  // unrelated segRows updates, so in-progress typing doesn't get clobbered.
  useEffect(() => {
    setNotesDraft(segRows[activeSegment.key]?.notes ?? '')
    setPhotoDraft(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdx, segRows[activeSegment.key]?.notes])

  async function analyzeSegment() {
    const photoUrl = photoDraft || activeRow?.photo_url
    if (!photoUrl) { await alertDialog('Take a photo of this side first.'); return }
    setAnalyzing(true)
    try {
      const res = await authFetch('/api/segment-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId, segmentKey: activeSegment.key, photoUrl }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Analysis failed')
      setSegRows(prev => ({ ...prev, [activeSegment.key]: { ...(prev[activeSegment.key] || {}), photo_url: photoUrl, ai_suggestions: data.suggestions } }))
    } catch (err) {
      await alertDialog('Could not check your photo: ' + err.message)
    } finally {
      setAnalyzing(false)
    }
  }

  async function saveNotes() {
    setSavingNotes(true)
    try {
      const res = await authFetch(`/api/homeowner/segments${qs}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segmentKey: activeSegment.key, notes: notesDraft }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setSegRows(prev => ({ ...prev, [activeSegment.key]: { ...(prev[activeSegment.key] || {}), notes: notesDraft } }))
      setNotesSaved(true); setTimeout(() => setNotesSaved(false), 2000)
    } catch (err) {
      await alertDialog('Could not save notes: ' + err.message)
    } finally {
      setSavingNotes(false)
    }
  }

  async function finish() {
    const hasAnything = Object.values(segRows).some(row => row?.photo_url || row?.notes?.trim())
    if (!hasAnything) {
      await alertDialog('Add at least one photo or note before finishing — walk around and capture what you see.')
      return
    }
    if (previewMode) {
      await alertDialog("Preview mode — this doesn't actually submit anything or email the team. A real homeowner clicking this would.")
      return
    }
    if (!(await confirmDialog('Ready to send this to your inspector? You can still add more later if you remember something.'))) return
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

  const CONTENT_WIDTH = 640

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: 13 }}>Loading…</span>
    </div>
  )

  if (loadError) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{loadError}</p>
    </div>
  )

  const doneCount = GUIDED_SEGMENTS.filter(s => segRows[s.key]?.photo_url || segRows[s.key]?.notes?.trim()).length
  const submitted = property?.homeowner_status === 'submitted' || property?.homeowner_status === 'done'

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 48 }}>
      {previewMode && (
        <div style={{ position: 'sticky', top: 0, zIndex: 21, background: 'var(--accent)', color: '#fff', textAlign: 'center', padding: '6px 12px', fontSize: 11, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Preview mode — this is what the homeowner sees. Photos/notes you add here are saved for real; &quot;Ready to send&quot; does not submit or email anyone.
        </div>
      )}
      <header style={{ position: 'sticky', top: previewMode ? 30 : 0, zIndex: 20, background: 'var(--header-bg)', borderBottom: '1px solid var(--line)' }}>
        <div style={{ maxWidth: CONTENT_WIDTH, margin: '0 auto', padding: '18px 16px 14px' }}>
          <span style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 4, fontFamily: 'monospace', display: 'block' }}>
            Field Notes · Guided Walkthrough
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

        {/* Step nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto', padding: '10px 16px', borderTop: '1px solid var(--line)' }}>
          {GUIDED_SEGMENTS.map((seg, idx) => {
            const done = !!(segRows[seg.key]?.photo_url || segRows[seg.key]?.notes?.trim())
            return (
              <button key={seg.key} onClick={() => setActiveIdx(idx)} style={{
                flexShrink: 0, display: 'inline-flex', alignItems: 'center', boxSizing: 'border-box',
                padding: '6px 10px', borderRadius: 14, cursor: 'pointer', lineHeight: 1.3,
                border: `1px solid ${idx === activeIdx ? 'var(--accent)' : 'var(--line)'}`,
                background: idx === activeIdx ? 'rgba(190,91,29,.15)' : 'transparent',
                color: idx === activeIdx ? 'var(--accent)' : (done ? 'var(--ok)' : 'var(--text-muted)'),
                fontFamily: 'monospace', fontSize: 10.5, whiteSpace: 'nowrap',
              }}>
                {done ? '✓ ' : ''}{seg.label}
              </button>
            )
          })}
        </div>
      </header>

      <div style={{ maxWidth: CONTENT_WIDTH, margin: '0 auto', padding: '20px 16px' }}>
        {submitted && (
          <div style={{ background: 'rgba(58,125,68,.1)', border: '1px solid var(--ok)', borderRadius: 6, padding: '10px 12px', marginBottom: 20, fontSize: 12.5, color: 'var(--text)' }}>
            Sent to your inspector — thanks! You can still add more if you think of something else.
          </div>
        )}

        <h2 style={{ fontSize: 19, fontWeight: 700, color: 'var(--text)', margin: '0 0 6px' }}>{activeSegment.label}</h2>
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 16 }}>{activeSegment.instructions}</p>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: 14, marginBottom: 16 }}>
          <span style={{ display: 'block', fontSize: 12, fontFamily: 'monospace', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 8 }}>
            What to look for here
          </span>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {activeSegment.items.map(item => (
              <li key={item.label} style={{ fontSize: 12.5, color: 'var(--text)', lineHeight: 1.5 }}>{item.hint}</li>
            ))}
          </ul>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: 14, marginBottom: 16 }}>
          <span style={{ display: 'block', fontSize: 12, fontFamily: 'monospace', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 8 }}>
            Your photo
          </span>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, margin: '0 0 10px' }}>
            One wide shot of this whole side, then check it — the assistant will tell you if anything looks worth a closer look.
          </p>
          <PhotoUpload propertyId={propertyId} onPhotoUrl={setPhotoDraft} initialUrl={activeRow?.photo_url} />
          {(photoDraft || activeRow?.photo_url) && (
            <button onClick={analyzeSegment} disabled={analyzing} style={{ marginTop: 10, fontSize: 11.5, fontFamily: 'monospace', color: 'var(--accent)', background: 'transparent', border: '1px solid var(--accent)', borderRadius: 4, padding: '7px 12px', cursor: 'pointer', opacity: analyzing ? 0.5 : 1 }}>
              {analyzing ? 'Checking…' : activeRow?.ai_suggestions ? 'Check Again' : 'Check My Photo'}
            </button>
          )}
          {activeRow?.ai_suggestions && (
            <div style={{ background: 'rgba(58,125,68,.1)', border: '1px solid var(--ok)', borderRadius: 6, padding: '10px 12px', marginTop: 10, fontSize: 12.5, color: 'var(--text)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
              {activeRow.ai_suggestions}
            </div>
          )}
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: 14, marginBottom: 24 }}>
          <span style={{ display: 'block', fontSize: 12, fontFamily: 'monospace', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 8 }}>
            Notes
          </span>
          <textarea
            value={notesDraft}
            onChange={e => setNotesDraft(e.target.value)}
            placeholder={activeSegment.notePlaceholder || 'Anything else about this area, or an answer to a question above…'}
            rows={3}
            style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 4, color: 'var(--text)', fontSize: 14, padding: '10px 12px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', minHeight: 76, resize: 'vertical' }}
          />
          <button onClick={saveNotes} disabled={savingNotes} style={{ marginTop: 10, fontSize: 11.5, fontFamily: 'monospace', color: 'var(--accent)', background: 'transparent', border: '1px solid var(--accent)', borderRadius: 4, padding: '7px 12px', cursor: 'pointer', opacity: savingNotes ? 0.5 : 1 }}>
            {savingNotes ? 'Saving…' : notesSaved ? '✓ Saved' : 'Save Notes'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          <button onClick={() => setActiveIdx(i => Math.max(0, i - 1))} disabled={activeIdx === 0} style={{ flex: 1, padding: '12px', background: 'transparent', border: '1px solid var(--line)', borderRadius: 4, color: activeIdx === 0 ? 'var(--line)' : 'var(--text-muted)', fontSize: 12.5, fontFamily: 'monospace', cursor: activeIdx === 0 ? 'default' : 'pointer' }}>
            ← Previous
          </button>
          <button onClick={() => setActiveIdx(i => Math.min(GUIDED_SEGMENTS.length - 1, i + 1))} disabled={activeIdx === GUIDED_SEGMENTS.length - 1} style={{ flex: 1, padding: '12px', background: activeIdx === GUIDED_SEGMENTS.length - 1 ? 'transparent' : 'var(--accent)', border: activeIdx === GUIDED_SEGMENTS.length - 1 ? '1px solid var(--line)' : 'none', borderRadius: 4, color: activeIdx === GUIDED_SEGMENTS.length - 1 ? 'var(--line)' : '#FFFFFF', fontSize: 12.5, fontFamily: 'monospace', fontWeight: 700, cursor: activeIdx === GUIDED_SEGMENTS.length - 1 ? 'default' : 'pointer' }}>
            Next Side →
          </button>
        </div>

        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 20, textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 12px' }}>
            {doneCount} of {GUIDED_SEGMENTS.length} sides captured. Walked the whole property?
          </p>
          <Button onClick={finish} disabled={finishing}>
            {finishing ? 'Sending…' : "I'm Done — Send to My Inspector"}
          </Button>
        </div>
      </div>
    </div>
  )
}
