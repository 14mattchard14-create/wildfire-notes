'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { authFetch } from '@/lib/authFetch'
import { GUIDED_SEGMENTS } from '@/lib/criteria'
import PhotoUpload from './PhotoUpload'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
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
//      photo per segment; the checklist below is shown as a short
//      plain-language reference list only, never clickable/loggable.
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
  const [segRows, setSegRows] = useState({}) // segment_key -> { photo_url, considerations, notes }
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [showOverview, setShowOverview] = useState(true)
  const [activeIdx, setActiveIdx] = useState(0)
  const [checklistOpen, setChecklistOpen] = useState(false)
  const [photoDraft, setPhotoDraft] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [notesDraft, setNotesDraft] = useState('')
  const [notesStatus, setNotesStatus] = useState(null) // null | 'saving' | 'saved'
  const [finishing, setFinishing] = useState(false)
  const [modal, setModal] = useState(null) // { considerations, index } | null

  const notesDirty = useRef(false)
  const notesTimer = useRef(null)

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
    notesDirty.current = false
    setNotesDraft(segRows[activeSegment.key]?.notes ?? '')
    setPhotoDraft(null)
    setChecklistOpen(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdx, segRows[activeSegment.key]?.notes])

  async function persistNotes(value) {
    setNotesStatus('saving')
    try {
      const res = await authFetch(`/api/homeowner/segments${qs}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segmentKey: activeSegment.key, notes: value }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setSegRows(prev => ({ ...prev, [activeSegment.key]: { ...(prev[activeSegment.key] || {}), notes: value } }))
      setNotesStatus('saved')
    } catch {
      setNotesStatus(null)
    }
  }

  // Auto-save, debounced — no Save button. Only fires from real typing
  // (notesDirty), not from the sync effect above re-setting the draft.
  useEffect(() => {
    if (!notesDirty.current) return
    if (notesTimer.current) clearTimeout(notesTimer.current)
    notesTimer.current = setTimeout(() => { persistNotes(notesDraft); notesDirty.current = false }, 900)
    return () => { if (notesTimer.current) clearTimeout(notesTimer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notesDraft])

  function handleNotesChange(value) {
    notesDirty.current = true
    setNotesStatus(null)
    setNotesDraft(value)
  }

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
      const considerations = data.considerations || []
      setSegRows(prev => ({ ...prev, [activeSegment.key]: { ...(prev[activeSegment.key] || {}), photo_url: photoUrl, considerations } }))
      if (considerations.length > 0) setModal({ considerations, index: 0 })
    } catch (err) {
      await alertDialog('Could not check your photo: ' + err.message)
    } finally {
      setAnalyzing(false)
    }
  }

  function updateModalConsideration(updated) {
    setModal(m => {
      if (!m) return m
      const considerations = m.considerations.map(c => c.id === updated.id ? updated : c)
      return { ...m, considerations }
    })
    setSegRows(prev => {
      const row = prev[activeSegment.key]
      if (!row) return prev
      const considerations = (row.considerations || []).map(c => c.id === updated.id ? updated : c)
      return { ...prev, [activeSegment.key]: { ...row, considerations } }
    })
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
  const unansweredCount = (activeRow?.considerations || []).filter(c => c.isQuestion && !c.answer).length

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 48 }}>
      {previewMode && (
        <div style={{ position: 'sticky', top: 0, zIndex: 21, background: 'var(--accent)', color: '#fff', textAlign: 'center', padding: '6px 12px', fontSize: 11, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Preview mode. This is what the homeowner sees. Photos/notes you add here are saved for real; &quot;Ready to send&quot; does not submit or email anyone.
        </div>
      )}
      <header style={{ position: 'sticky', top: previewMode ? 30 : 0, zIndex: 20, background: 'var(--header-bg)', borderBottom: '1px solid var(--line)' }}>
        <div style={{ maxWidth: CONTENT_WIDTH, margin: '0 auto', padding: '18px 100px 14px 16px', position: 'relative' }}>
          <button
            onClick={previewMode ? () => router.push(`/manage/${propertyId}`) : () => supabase.auth.signOut().then(() => { window.location.href = '/' })}
            style={{ position: 'absolute', top: 14, right: 16, fontSize: 10.5, fontFamily: 'monospace', color: 'var(--header-text)', opacity: 0.7, background: 'none', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4, padding: '4px 8px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}
          >
            {previewMode ? '← Back' : 'Sign Out'}
          </button>
          <span style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 4, fontFamily: 'monospace', display: 'block' }}>
            CharredGuard Guided Inspection
          </span>
          <h1 style={{ fontSize: 'clamp(16px, 5vw, 20px)', fontWeight: 700, letterSpacing: '0.02em', margin: 0, color: 'var(--header-text)' }}>
            {property?.address ?? 'Your Property'}
          </h1>
          <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--header-text)', opacity: 0.6 }}>{user?.user_metadata?.full_name || user?.email}</span>
        </div>

        {/* Step nav — Overview is the first tab, not a separate header button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto', padding: '10px 16px', borderTop: '1px solid var(--line)' }}>
          <button onClick={() => setShowOverview(true)} style={{
            flexShrink: 0, display: 'inline-flex', alignItems: 'center', boxSizing: 'border-box',
            padding: '6px 10px', borderRadius: 14, cursor: 'pointer', lineHeight: 1.3,
            border: `1px solid ${showOverview ? 'var(--accent)' : 'var(--line)'}`,
            background: showOverview ? 'rgba(190,91,29,.15)' : 'transparent',
            color: showOverview ? 'var(--accent)' : 'var(--text-muted)',
            fontFamily: 'monospace', fontSize: 10.5, whiteSpace: 'nowrap',
          }}>
            Overview
          </button>
          {GUIDED_SEGMENTS.map((seg, idx) => {
            const done = !!(segRows[seg.key]?.photo_url || segRows[seg.key]?.notes?.trim())
            const active = !showOverview && idx === activeIdx
            return (
              <button key={seg.key} onClick={() => { setShowOverview(false); setActiveIdx(idx) }} style={{
                flexShrink: 0, display: 'inline-flex', alignItems: 'center', boxSizing: 'border-box',
                padding: '6px 10px', borderRadius: 14, cursor: 'pointer', lineHeight: 1.3,
                border: `1px solid ${active ? 'var(--accent)' : 'var(--line)'}`,
                background: active ? 'rgba(190,91,29,.15)' : 'transparent',
                color: active ? 'var(--accent)' : (done ? 'var(--ok)' : 'var(--text-muted)'),
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
            Sent to your inspector. Thanks! You can still add more if you think of something else.
          </div>
        )}

        {showOverview ? (
          <OverviewScreen
            property={property}
            segRows={segRows}
            doneCount={doneCount}
            onStart={() => setShowOverview(false)}
          />
        ) : (
          <SegmentScreen
            activeSegment={activeSegment}
            activeIdx={activeIdx}
            activeRow={activeRow}
            propertyId={propertyId}
            checklistOpen={checklistOpen}
            setChecklistOpen={setChecklistOpen}
            photoDraft={photoDraft}
            setPhotoDraft={setPhotoDraft}
            analyzing={analyzing}
            analyzeSegment={analyzeSegment}
            unansweredCount={unansweredCount}
            openConsiderations={() => setModal({ considerations: activeRow.considerations, index: 0 })}
            notesDraft={notesDraft}
            onNotesChange={handleNotesChange}
            notesStatus={notesStatus}
            notePlaceholder={activeSegment.notePlaceholder}
            onPrev={() => setActiveIdx(i => Math.max(0, i - 1))}
            onNext={() => setActiveIdx(i => Math.min(GUIDED_SEGMENTS.length - 1, i + 1))}
            isFirst={activeIdx === 0}
            isLast={activeIdx === GUIDED_SEGMENTS.length - 1}
            doneCount={doneCount}
            finish={finish}
            finishing={finishing}
          />
        )}
      </div>

      {modal && (
        <ConsiderationModal
          modal={modal}
          setModal={setModal}
          propertyId={propertyId}
          segmentKey={activeSegment.key}
          onUpdate={updateModalConsideration}
        />
      )}
    </div>
  )
}

// Segment items are often labeled "Front — windows" to disambiguate which
// side within lib/criteria.js's shared data (used by the inspector tool
// too) — but the side is already the page heading here, so strip that
// prefix for display rather than repeating it and showing a dash.
function shortLabel(label) {
  return label.replace(/^.*? — /, '')
}

function OverviewScreen({ property, segRows, doneCount, onStart }) {
  return (
    <>
      <h2 style={{ fontSize: 21, fontWeight: 700, color: 'var(--text)', margin: '0 0 8px' }}>
        {doneCount > 0 ? 'Welcome back' : "Let's document your property"}
      </h2>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 20 }}>
        {doneCount > 0
          ? `You've captured ${doneCount} of ${GUIDED_SEGMENTS.length} sides so far. Use the tabs above to pick up where you left off.`
          : "No inspector visit needed. You'll walk your property yourself, one side at a time, while an assistant checks your photos as you go."}
      </p>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <span style={{ display: 'block', fontSize: 12, fontFamily: 'monospace', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 10 }}>
          How it works
        </span>
        <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <li style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>Take one wide photo of each side of your property, plus a couple of specific areas (vegetation, detached structures).</li>
          <li style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>An assistant checks each photo right away. If anything needs a closer look, it&apos;ll ask you about it one question at a time.</li>
          <li style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>Answer with a quick note, or add a follow-up photo for anything you want a second check on.</li>
          <li style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>Everything saves automatically. Come back anytime, and send it to your inspector when you&apos;re done.</li>
        </ol>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: 16, marginBottom: 24 }}>
        <span style={{ display: 'block', fontSize: 12, fontFamily: 'monospace', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 10 }}>
          What you&apos;ll cover
        </span>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column' }}>
          {GUIDED_SEGMENTS.map((seg, i) => (
            <li key={seg.key} style={{ fontSize: 13, color: 'var(--text)', padding: '7px 0', borderTop: i === 0 ? 'none' : '1px solid var(--line)' }}>
              {seg.label}
            </li>
          ))}
        </ul>
      </div>

      <Button onClick={onStart} style={{ width: '100%' }}>
        {doneCount > 0 ? 'Continue Walkthrough' : 'Start Walkthrough'}
      </Button>
    </>
  )
}

function SegmentScreen({
  activeSegment, activeRow, propertyId, checklistOpen, setChecklistOpen,
  photoDraft, setPhotoDraft, analyzing, analyzeSegment, unansweredCount, openConsiderations,
  notesDraft, onNotesChange, notesStatus, notePlaceholder,
  onPrev, onNext, isFirst, isLast, doneCount, finish, finishing,
}) {
  const considerations = activeRow?.considerations || []
  const hasPhoto = !!(photoDraft || activeRow?.photo_url)
  const alreadyChecked = !!activeRow?.considerations

  return (
    <>
      <h2 style={{ fontSize: 19, fontWeight: 700, color: 'var(--text)', margin: '0 0 6px' }}>{activeSegment.label}</h2>
      <p style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 16 }}>{activeSegment.instructions}</p>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: 14, marginBottom: 16 }}>
        <button
          onClick={() => setChecklistOpen(o => !o)}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
        >
          <span style={{ fontSize: 12, fontFamily: 'monospace', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--accent)' }}>
            What to look for here ({activeSegment.items.length})
          </span>
          <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{checklistOpen ? '▲ Hide' : '▼ Show'}</span>
        </button>
        {checklistOpen && (
          <ul style={{ margin: '10px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {activeSegment.items.map(item => (
              <li key={item.label} style={{ fontSize: 12, color: 'var(--text)', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 12, padding: '4px 10px' }}>
                {shortLabel(item.label)}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: 14, marginBottom: 16 }}>
        <span style={{ display: 'block', fontSize: 12, fontFamily: 'monospace', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 8 }}>
          Your photo
        </span>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, margin: '0 0 10px' }}>
          One wide shot of this whole side, then check it.
        </p>
        <PhotoUpload key={activeSegment.key} propertyId={propertyId} onPhotoUrl={setPhotoDraft} initialUrl={activeRow?.photo_url} />
        {hasPhoto && (
          <button onClick={analyzeSegment} disabled={analyzing} style={{ marginTop: 10, fontSize: 11.5, fontFamily: 'monospace', color: 'var(--accent)', background: 'transparent', border: '1px solid var(--accent)', borderRadius: 4, padding: '7px 12px', cursor: 'pointer', opacity: analyzing ? 0.5 : 1 }}>
            {analyzing ? 'Checking…' : alreadyChecked ? 'Check Again' : 'Check My Photo'}
          </button>
        )}

        {alreadyChecked && considerations.length === 0 && (
          <p style={{ marginTop: 10, fontSize: 12.5, color: 'var(--text-muted)' }}>Nothing else to flag here.</p>
        )}
        {considerations.length > 0 && (
          <button onClick={openConsiderations} style={{ marginTop: 10, display: 'block', fontSize: 12.5, fontFamily: 'monospace', color: unansweredCount > 0 ? 'var(--accent)' : 'var(--text-muted)', background: 'transparent', border: `1px solid ${unansweredCount > 0 ? 'var(--accent)' : 'var(--line)'}`, borderRadius: 4, padding: '8px 12px', cursor: 'pointer' }}>
            {unansweredCount > 0
              ? `Review ${considerations.length} consideration${considerations.length === 1 ? '' : 's'} (${unansweredCount} unanswered)`
              : `Review ${considerations.length} consideration${considerations.length === 1 ? '' : 's'}`}
          </button>
        )}
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: 14, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontFamily: 'monospace', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--accent)' }}>
            Notes
          </span>
          <span style={{ fontSize: 10.5, fontFamily: 'monospace', color: 'var(--text-muted)' }}>
            {notesStatus === 'saving' ? 'Saving…' : notesStatus === 'saved' ? '✓ Saved' : ''}
          </span>
        </div>
        <textarea
          value={notesDraft}
          onChange={e => onNotesChange(e.target.value)}
          placeholder={notePlaceholder || 'Anything else about this area…'}
          rows={3}
          style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 4, color: 'var(--text)', fontSize: 14, padding: '10px 12px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', minHeight: 76, resize: 'vertical' }}
        />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <button onClick={onPrev} disabled={isFirst} style={{ flex: 1, padding: '12px', background: 'transparent', border: '1px solid var(--line)', borderRadius: 4, color: isFirst ? 'var(--line)' : 'var(--text-muted)', fontSize: 12.5, fontFamily: 'monospace', cursor: isFirst ? 'default' : 'pointer' }}>
          ← Previous
        </button>
        <button onClick={onNext} disabled={isLast} style={{ flex: 1, padding: '12px', background: isLast ? 'transparent' : 'var(--accent)', border: isLast ? '1px solid var(--line)' : 'none', borderRadius: 4, color: isLast ? 'var(--line)' : '#FFFFFF', fontSize: 12.5, fontFamily: 'monospace', fontWeight: 700, cursor: isLast ? 'default' : 'pointer' }}>
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
    </>
  )
}

function ConsiderationModal({ modal, setModal, propertyId, segmentKey, onUpdate }) {
  const { alertDialog } = useConfirmDialog()
  const { considerations, index } = modal
  const current = considerations[index]
  const [answerDraft, setAnswerDraft] = useState(current?.answer || '')
  const [followUpPhoto, setFollowUpPhoto] = useState(null)
  const [checkingFollowUp, setCheckingFollowUp] = useState(false)
  const answerDirty = useRef(false)
  const answerTimer = useRef(null)

  useEffect(() => {
    answerDirty.current = false
    setAnswerDraft(current?.answer || '')
    setFollowUpPhoto(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id])

  async function saveAnswer(value, extra = {}) {
    try {
      const res = await authFetch('/api/homeowner/consideration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId, segmentKey, considerationId: current.id, answer: value, ...extra }),
      })
      const data = await res.json()
      if (res.ok && data.consideration) onUpdate(data.consideration)
      return data
    } catch {
      return null
    }
  }

  // Auto-save the typed answer, debounced — no Save button.
  useEffect(() => {
    if (!answerDirty.current) return
    if (answerTimer.current) clearTimeout(answerTimer.current)
    answerTimer.current = setTimeout(() => { saveAnswer(answerDraft); answerDirty.current = false }, 900)
    return () => { if (answerTimer.current) clearTimeout(answerTimer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answerDraft])

  async function runFollowUp(photoUrl) {
    setCheckingFollowUp(true)
    const data = await saveAnswer(answerDraft, { followUpPhotoUrl: photoUrl })
    setCheckingFollowUp(false)
    if (!data) return
    if (!data.consideration) {
      await alertDialog(data.error || 'Follow-up check failed.')
    }
  }

  function goTo(newIndex) {
    if (answerDirty.current) { saveAnswer(answerDraft); answerDirty.current = false }
    if (newIndex >= considerations.length) { setModal(null); return }
    setModal(m => ({ ...m, index: newIndex }))
  }

  if (!current) return null

  return (
    <div onClick={() => goTo(considerations.length)} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0 12px 20px' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, width: '100%', maxWidth: 520, maxHeight: '85vh', overflowY: 'auto', padding: '22px 22px 24px', boxShadow: '0 8px 48px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontSize: 10.5, fontFamily: 'monospace', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            Consideration {index + 1} of {considerations.length}
          </span>
          <Button onClick={() => goTo(considerations.length)} variant="outline" size="icon" className="size-[28px] rounded-full shrink-0 text-muted-foreground">
            <X className="size-3.5" />
          </Button>
        </div>

        <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
          {considerations.map((c, i) => (
            <div key={c.id} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= index ? 'var(--accent)' : 'var(--line)' }} />
          ))}
        </div>

        <p style={{ fontSize: 15, color: 'var(--text)', lineHeight: 1.5, marginBottom: 16 }}>{current.text}</p>

        {current.isQuestion && (
          <textarea
            value={answerDraft}
            onChange={e => { answerDirty.current = true; setAnswerDraft(e.target.value) }}
            placeholder="Your answer…"
            rows={2}
            style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 4, color: 'var(--text)', fontSize: 14, padding: '10px 12px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', minHeight: 60, resize: 'vertical', marginBottom: 12 }}
          />
        )}

        <div style={{ marginBottom: 16 }}>
          <span style={{ display: 'block', fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)', marginBottom: 6 }}>Or add a closer photo</span>
          <PhotoUpload key={current.id} propertyId={propertyId} onPhotoUrl={setFollowUpPhoto} initialUrl={current.followUpPhotoUrl} />
          {(followUpPhoto || current.followUpPhotoUrl) && !current.followUpResponse && (
            <button onClick={() => runFollowUp(followUpPhoto || current.followUpPhotoUrl)} disabled={checkingFollowUp} style={{ marginTop: 8, fontSize: 11.5, fontFamily: 'monospace', color: 'var(--accent)', background: 'transparent', border: '1px solid var(--accent)', borderRadius: 4, padding: '7px 12px', cursor: 'pointer', opacity: checkingFollowUp ? 0.5 : 1 }}>
              {checkingFollowUp ? 'Checking…' : 'Check This Photo'}
            </button>
          )}
          {current.followUpResponse && (
            <div style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 6, padding: '10px 12px', marginTop: 10, fontSize: 12.5, color: 'var(--text)', lineHeight: 1.5 }}>
              {current.followUpResponse}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => goTo(index - 1)} disabled={index === 0} style={{ flex: 1, padding: '11px', background: 'transparent', border: '1px solid var(--line)', borderRadius: 4, color: index === 0 ? 'var(--line)' : 'var(--text-muted)', fontSize: 12.5, fontFamily: 'monospace', cursor: index === 0 ? 'default' : 'pointer' }}>
            Back
          </button>
          <button onClick={() => goTo(index + 1)} style={{ flex: 1, padding: '11px', background: 'var(--accent)', border: 'none', borderRadius: 4, color: '#FFFFFF', fontSize: 12.5, fontFamily: 'monospace', fontWeight: 700, cursor: 'pointer' }}>
            {index === considerations.length - 1 ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
