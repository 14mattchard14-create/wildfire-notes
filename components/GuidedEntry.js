'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { authFetch } from '@/lib/authFetch'
import { GUIDED_SEGMENTS, OVERALL_SITE_SEGMENT, STATUSES } from '@/lib/criteria'
import { parseSatellite, getAreaText } from '@/lib/satellite'
import PhotoUpload from './PhotoUpload'
import InfoModal from './InfoModal'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const c = {
  bg:      'var(--bg)',
  surface: 'var(--surface)',
  line:    'var(--line)',
  accent:  'var(--accent)',
  text:    'var(--text)',
  muted:   'var(--text-muted)',
  ok:      'var(--ok)',
  warn:    'var(--warn)',
  info:    'var(--info)',
}

const input = { width: '100%', background: c.surface, border: `1px solid ${c.line}`, borderRadius: 4, color: c.text, fontSize: 14, padding: '10px 12px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }

function itemDone(entries, item) {
  return entries.some(e => e.zone === item.zone && e.detail === item.label)
}

// Inline form for logging a single checklist item. Opens in place under the
// item row rather than taking over the whole screen — the point of the
// redesign is that you can move through a side of the house without losing
// your place.
function ItemInlineForm({ item, propertyId, user, onSaved, onCancel }) {
  const [status,   setStatus]   = useState(null)
  const [note,     setNote]     = useState('')
  const [photoUrl, setPhotoUrl] = useState(null)
  const [saving,   setSaving]   = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)

  async function save() {
    if (!note.trim()) { alert('Add a quick note describing what you see.'); return }
    if (!status)      { alert('Select a status.'); return }
    setSaving(true)
    const userName = user?.user_metadata?.full_name || user?.email || 'Unknown'
    const { error } = await supabase.from('entries').insert({
      property_id: propertyId,
      zone: item.zone,
      category: item.zone,
      status,
      note: note.trim(),
      detail: item.label,
      photo_url: photoUrl || null,
      created_by: user?.id || null,
      created_by_name: userName,
    })
    setSaving(false)
    if (error) { alert('Save failed: ' + error.message); return }
    onSaved()
  }

  return (
    <div style={{ background: c.bg, border: `1px solid ${c.line}`, borderRadius: 6, padding: 14, marginTop: 6, marginBottom: 6 }}>
      {infoOpen && <InfoModal category={item.zone} onClose={() => setInfoOpen(false)} />}

      <p style={{ fontSize: 12, color: c.muted, lineHeight: 1.5, margin: '0 0 6px' }}>{item.hint}</p>
      <button onClick={() => setInfoOpen(true)} style={{ marginBottom: 12, fontSize: 11, fontFamily: 'monospace', color: c.accent, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
        ⓘ Read about this category
      </button>

      <div style={{ marginBottom: 12 }}>
        <PhotoUpload propertyId={propertyId} onPhotoUrl={setPhotoUrl} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 5 }}>
          {STATUSES.map(s => (
            <button key={s.value} onClick={() => setStatus(s.value)} style={{
              padding: '6px 2px', border: `1px solid ${status === s.value ? c.accent : c.line}`,
              borderRadius: 4, cursor: 'pointer', fontFamily: 'monospace', fontSize: 9.5,
              letterSpacing: '0.02em', textTransform: 'uppercase', lineHeight: 1.2,
              color: status === s.value ? c.accent : c.muted,
              background: status === s.value ? 'rgba(190,91,29,.15)' : 'transparent',
            }}>{s.label}</button>
          ))}
        </div>
      </div>

      <input style={{ ...input, marginBottom: 12 }} type="text" placeholder="What do you see?" value={note} onChange={e => setNote(e.target.value)} />

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={save} disabled={saving} style={{ flex: 1, background: c.accent, color: '#FFFFFF', border: 'none', borderRadius: 4, fontSize: 12.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', padding: 11, cursor: 'pointer', opacity: saving ? 0.5 : 1 }}>
          {saving ? 'Saving…' : 'Save Entry'}
        </button>
        <button onClick={onCancel} style={{ padding: '11px 14px', background: 'transparent', border: `1px solid ${c.line}`, borderRadius: 4, color: c.muted, fontSize: 12.5, cursor: 'pointer' }}>
          Cancel
        </button>
      </div>
    </div>
  )
}

function SuggestionBanner({ text }) {
  if (!text) return null
  return (
    <div style={{ background: 'rgba(58,125,68,.1)', border: `1px solid ${c.ok}`, borderRadius: 6, padding: '10px 12px', marginTop: 10, fontSize: 12, color: c.text, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
      {text}
    </div>
  )
}

// The walkthrough is: "Overall Site" (satellite scan + the overall-site
// checklist + access/driveway, all combined — everything that happens
// before you start walking the house) → every GUIDED_SEGMENTS entry in
// order. Keeps OVERALL_SITE_SEGMENT's key ('overall_site') so entries, the
// whole-side photo, and the gap-check API all resolve the same way a
// normal segment would — only the instructions/virtual flag differ.
const SATELLITE_STEP = {
  ...OVERALL_SITE_SEGMENT,
  virtual: true,
  instructions: 'Start here — scan the overhead view of the whole property, then capture the same wide shots you’d take for the overall site: street view, terrain, neighboring properties, and the driveway/access route. This flags large features per category so you already know what to watch for once you reach each side.',
}
const STEPS = [SATELLITE_STEP, ...GUIDED_SEGMENTS]

export default function GuidedEntry({ propertyId, property, entries: entriesProp, user, onClose, onSaved }) {
  const [entries, setEntries] = useState(entriesProp || [])
  const [activeKey, setActiveKey] = useState(SATELLITE_STEP.key)
  const [openItemLabel, setOpenItemLabel] = useState(null)
  const [segRows, setSegRows] = useState({}) // segment_key -> { photo_url, ai_suggestions }
  const [segPhotoDraft, setSegPhotoDraft] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [satellite, setSatellite] = useState(() => parseSatellite(property?.satellite_analysis))
  const [satelliteAt, setSatelliteAt] = useState(property?.satellite_analyzed_at ?? null)
  const [satelliteRunning, setSatelliteRunning] = useState(false)
  const [satelliteImageUrl, setSatelliteImageUrl] = useState(property?.satellite_image_url ?? null)
  const [notesDraft, setNotesDraft] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)
  const navScrollRef = useRef(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  useEffect(() => { setEntries(entriesProp || []) }, [entriesProp])

  // Step-nav horizontal scroll affordance — on mobile there's no visible
  // scrollbar hinting that the pill row scrolls, so track scroll position
  // to dim/undim the arrow buttons at each end.
  const updateNavScrollState = useCallback(() => {
    const el = navScrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 2)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2)
  }, [])

  useEffect(() => { updateNavScrollState() }, [updateNavScrollState])

  function scrollNav(dir) {
    navScrollRef.current?.scrollBy({ left: dir * 180, behavior: 'smooth' })
  }

  const loadSegments = useCallback(async () => {
    const { data } = await supabase.from('guided_segments').select('*').eq('property_id', propertyId)
    const map = {}
    ;(data || []).forEach(row => { map[row.segment_key] = row })
    setSegRows(map)
  }, [propertyId])

  useEffect(() => { loadSegments() }, [loadSegments])

  const activeIdx = STEPS.findIndex(s => s.key === activeKey)
  const activeStep = STEPS[activeIdx]
  const activeSegment = activeStep
  const activeRow = segRows[activeKey]

  // Site notes used to live in their own tab/table — now it's one freeform
  // box per segment, saved onto the same guided_segments row as the
  // segment's photo/ai_suggestions. Re-syncs whenever the active step
  // changes or this segment's saved notes value changes (e.g. after our
  // own save below) — but not on unrelated segRows updates, so in-progress
  // typing here doesn't get clobbered by other segments loading/saving.
  useEffect(() => {
    setNotesDraft(segRows[activeKey]?.notes ?? '')
  }, [activeKey, segRows[activeKey]?.notes])

  async function saveNotes() {
    setSavingNotes(true)
    const { error } = await supabase.from('guided_segments').upsert(
      { property_id: propertyId, segment_key: activeKey, notes: notesDraft, updated_at: new Date().toISOString() },
      { onConflict: 'property_id,segment_key' }
    )
    setSavingNotes(false)
    if (error) { alert('Save failed: ' + error.message); return }
    setSegRows(prev => ({ ...prev, [activeKey]: { ...(prev[activeKey] || {}), segment_key: activeKey, notes: notesDraft } }))
    setNotesSaved(true); setTimeout(() => setNotesSaved(false), 2000)
  }

  function refreshEntries() {
    setOpenItemLabel(null)
    onSaved?.()
  }

  async function runSatelliteAnalysis() {
    setSatelliteRunning(true)
    try {
      const res = await authFetch('/api/satellite-analysis', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Analysis failed')
      setSatellite(data.suggestions)
      setSatelliteImageUrl(data.imageUrl ?? null)
      setSatelliteAt(new Date().toISOString())
    } catch (err) {
      alert('Satellite analysis failed: ' + err.message)
    } finally {
      setSatelliteRunning(false)
    }
  }

  async function analyzeSegment() {
    const photoUrl = segPhotoDraft || activeRow?.photo_url
    if (!photoUrl) { alert('Take a whole-side photo first.'); return }
    setAnalyzing(true)
    try {
      const res = await authFetch('/api/segment-analysis', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId, segmentKey: activeKey, photoUrl }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Analysis failed')
      setSegRows(prev => ({ ...prev, [activeKey]: { ...(prev[activeKey] || {}), segment_key: activeKey, photo_url: photoUrl, ai_suggestions: data.suggestions } }))
    } catch (err) {
      alert('Segment analysis failed: ' + err.message)
    } finally {
      setAnalyzing(false)
    }
  }

  function goStep(idx) {
    if (idx < 0) return
    if (idx >= STEPS.length) { onClose(); return }
    setSegPhotoDraft(null)
    setOpenItemLabel(null)
    setActiveKey(STEPS[idx].key)
  }

  const doneCount = seg => seg.items.filter(item => itemDone(entries, item)).length

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: c.bg, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      {/* Header + step nav share one sticky wrapper so they always stick
          together as a unit — two separately-sticky elements with a
          hardcoded `top` offset between them breaks the moment the header's
          actual height doesn't match that guess (it didn't), clipping the
          nav row behind the header. */}
      <div style={{ position: 'sticky', top: 0, background: c.bg, zIndex: 5 }}>
        <div style={{ borderBottom: `1px solid ${c.line}`, padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase', color: c.accent, display: 'block' }}>Guided Entry</span>
            <span style={{ fontSize: 11, fontFamily: 'monospace', color: c.muted }}>{activeStep.label}</span>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: '50%', border: `1px solid ${c.line}`, background: 'transparent', color: c.muted, fontSize: 14, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Step nav — jump to any step (satellite or any segment), in order
            but freely skippable. Left/right arrow buttons flank the
            scrollable pill row so it's obvious (and usable with a tap
            rather than a swipe) that there's more to scroll to on mobile. */}
        <div style={{ display: 'flex', alignItems: 'center', borderBottom: `1px solid ${c.line}` }}>
          <button
            onClick={() => scrollNav(-1)}
            disabled={!canScrollLeft}
            aria-label="Scroll steps left"
            style={{ flexShrink: 0, width: 30, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', borderRight: `1px solid ${c.line}`, color: canScrollLeft ? c.text : c.line, cursor: canScrollLeft ? 'pointer' : 'default' }}
          >
            <ChevronLeft size={16} />
          </button>

          <div
            ref={navScrollRef}
            onScroll={updateNavScrollState}
            style={{ flex: 1, minWidth: 0, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto' }}
          >
            {STEPS.map((step, idx) => {
              const done = doneCount(step), total = step.items.length
              const complete = step.virtual ? (!!satellite && done === total) : done === total
              return (
                <button key={step.key} onClick={() => goStep(idx)} style={{
                  flexShrink: 0, display: 'inline-flex', alignItems: 'center', boxSizing: 'border-box',
                  padding: '6px 10px', borderRadius: 14, cursor: 'pointer', lineHeight: 1.3,
                  border: `1px solid ${step.key === activeKey ? c.accent : c.line}`,
                  background: step.key === activeKey ? 'rgba(190,91,29,.15)' : 'transparent',
                  color: step.key === activeKey ? c.accent : (complete ? c.ok : c.muted),
                  fontFamily: 'monospace', fontSize: 10.5, whiteSpace: 'nowrap',
                }}>
                  {complete ? '✓ ' : (step.virtual ? '◈ ' : '')}{step.label} <span style={{ opacity: 0.7, marginLeft: 3 }}>({done}/{total})</span>
                </button>
              )
            })}
          </div>

          <button
            onClick={() => scrollNav(1)}
            disabled={!canScrollRight}
            aria-label="Scroll steps right"
            style={{ flexShrink: 0, width: 30, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', borderLeft: `1px solid ${c.line}`, color: canScrollRight ? c.text : c.line, cursor: canScrollRight ? 'pointer' : 'default' }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div style={{ flex: 1, padding: 20, maxWidth: 560, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>

        {/* Active step — Satellite Overview (+ Overall Site) or a checklist segment */}
        {activeSegment && (
          <>
            <div style={{ marginBottom: 8 }}>
              <h2 style={{ fontSize: 19, fontWeight: 700, color: c.text, margin: '0 0 6px' }}>{activeSegment.label}</h2>
              <p style={{ fontSize: 12.5, color: c.muted, lineHeight: 1.5, marginBottom: 12 }}>{activeSegment.instructions}</p>

              {/* Satellite scan controls — only on the combined first step */}
              {activeStep.virtual && (
                <div style={{ background: c.surface, border: `1px solid ${c.line}`, borderRadius: 8, padding: 14, marginBottom: 16 }}>
                  <button onClick={runSatelliteAnalysis} disabled={satelliteRunning} style={{ fontSize: 12, fontFamily: 'monospace', color: c.accent, background: 'transparent', border: `1px solid ${c.accent}`, borderRadius: 4, padding: '9px 14px', cursor: 'pointer', opacity: satelliteRunning ? 0.5 : 1 }}>
                    {satelliteRunning ? 'Analyzing…' : satellite ? 'Re-analyze Satellite View' : 'Analyze Satellite View'}
                  </button>
                  {satelliteAt && <span style={{ marginLeft: 10, fontSize: 10.5, color: c.muted, fontFamily: 'monospace' }}>Last run {new Date(satelliteAt).toLocaleString()}</span>}

                  {satellite?.overview && <SuggestionBanner text={satellite.overview} />}

                  {satelliteImageUrl && (
                    <div style={{ marginTop: 14, borderRadius: 6, overflow: 'hidden', border: `1px solid ${c.line}`, lineHeight: 0 }}>
                      <img src={satelliteImageUrl} alt="Satellite view of the property, cropped in tight" style={{ display: 'block', width: '100%', height: 'auto' }} />
                    </div>
                  )}

                  {satellite && (
                    <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {GUIDED_SEGMENTS.filter(seg => getAreaText(satellite, seg.key).trim()).map(seg => (
                        <div key={seg.key} style={{ fontSize: 12, color: c.text, lineHeight: 1.5 }}>
                          <strong style={{ color: c.accent }}>{seg.label}:</strong> {getAreaText(satellite, seg.key)}
                        </div>
                      ))}
                      {GUIDED_SEGMENTS.every(seg => !getAreaText(satellite, seg.key).trim()) && (
                        <p style={{ fontSize: 12, color: c.muted, margin: 0 }}>Nothing else notable per category — proceed to the walkthrough below.</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {!activeStep.virtual && getAreaText(satellite, activeSegment.key).trim() && (
                <div style={{ background: 'rgba(190,91,29,.08)', border: `1px solid ${c.accent}`, borderRadius: 6, padding: '10px 12px', marginBottom: 16, fontSize: 12, color: c.text, lineHeight: 1.5 }}>
                  <strong style={{ color: c.accent }}>◈ From the satellite scan:</strong> {getAreaText(satellite, activeSegment.key)}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
              {activeSegment.items.map(item => {
                const done = itemDone(entries, item)
                const isOpen = openItemLabel === item.label
                return (
                  <div key={item.label}>
                    <button
                      onClick={() => setOpenItemLabel(isOpen ? null : item.label)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                        background: c.surface, border: `1px solid ${isOpen ? c.accent : (done ? c.ok : c.line)}`,
                        borderRadius: 6, padding: '10px 12px', cursor: 'pointer', textAlign: 'left',
                      }}
                    >
                      <span style={{
                        width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                        border: `1px solid ${done ? c.ok : c.line}`,
                        background: done ? c.ok : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, color: '#FFFFFF',
                      }}>{done ? '✓' : ''}</span>
                      <span style={{ fontSize: 13, color: done ? c.muted : c.text, flex: 1 }}>{item.label}</span>
                      <span style={{ fontSize: 11, color: c.muted }}>{isOpen ? '▲' : (done ? 'Add another' : '+')}</span>
                    </button>
                    {isOpen && (
                      <ItemInlineForm
                        item={item}
                        propertyId={propertyId}
                        user={user}
                        onSaved={refreshEntries}
                        onCancel={() => setOpenItemLabel(null)}
                      />
                    )}
                  </div>
                )
              })}
            </div>

            {/* Whole-side photo + AI gap check */}
            {activeSegment.wholeSidePhoto && (
              <div style={{ background: c.surface, border: `1px solid ${c.line}`, borderRadius: 8, padding: 14, marginBottom: 24 }}>
                <span style={{ display: 'block', fontSize: 12, fontFamily: 'monospace', letterSpacing: '0.06em', textTransform: 'uppercase', color: c.accent, marginBottom: 8 }}>
                  Whole-Side Photo
                </span>
                <p style={{ fontSize: 12, color: c.muted, lineHeight: 1.5, margin: '0 0 10px' }}>
                  Take one wide shot of this whole segment, then run the check for anything the checklist above might have missed.
                </p>
                <PhotoUpload propertyId={propertyId} onPhotoUrl={url => setSegPhotoDraft(url)} />
                {(segPhotoDraft || activeRow?.photo_url) && (
                  <button onClick={analyzeSegment} disabled={analyzing} style={{ marginTop: 10, fontSize: 11.5, fontFamily: 'monospace', color: c.accent, background: 'transparent', border: `1px solid ${c.accent}`, borderRadius: 4, padding: '7px 12px', cursor: 'pointer', opacity: analyzing ? 0.5 : 1 }}>
                    {analyzing ? 'Analyzing…' : activeRow?.ai_suggestions ? 'Re-run Gap Check' : 'Run Gap Check'}
                  </button>
                )}
                <SuggestionBanner text={activeRow?.ai_suggestions} />
              </div>
            )}

            {/* Freeform notes — one box per segment, replaces the old standalone Site Notes tab */}
            <div style={{ background: c.surface, border: `1px solid ${c.line}`, borderRadius: 8, padding: 14, marginBottom: 24 }}>
              <span style={{ display: 'block', fontSize: 12, fontFamily: 'monospace', letterSpacing: '0.06em', textTransform: 'uppercase', color: c.accent, marginBottom: 8 }}>
                Notes
              </span>
              <textarea
                value={notesDraft}
                onChange={e => setNotesDraft(e.target.value)}
                placeholder={activeSegment.notePlaceholder || 'Additional notes for this area (optional)…'}
                rows={3}
                style={{ ...input, minHeight: 76, resize: 'vertical', fontFamily: 'inherit' }}
              />
              <button onClick={saveNotes} disabled={savingNotes} style={{ marginTop: 10, fontSize: 11.5, fontFamily: 'monospace', color: c.accent, background: 'transparent', border: `1px solid ${c.accent}`, borderRadius: 4, padding: '7px 12px', cursor: 'pointer', opacity: savingNotes ? 0.5 : 1 }}>
                {savingNotes ? 'Saving…' : notesSaved ? '✓ Saved' : 'Save Notes'}
              </button>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => goStep(activeIdx - 1)} disabled={activeIdx === 0} style={{ flex: 1, padding: '12px', background: 'transparent', border: `1px solid ${c.line}`, borderRadius: 4, color: activeIdx === 0 ? c.line : c.muted, fontSize: 12.5, fontFamily: 'monospace', cursor: activeIdx === 0 ? 'default' : 'pointer' }}>
                ← Previous
              </button>
              <button onClick={() => goStep(activeIdx + 1)} style={{ flex: 1, padding: '12px', background: c.accent, border: 'none', borderRadius: 4, color: '#FFFFFF', fontSize: 12.5, fontFamily: 'monospace', fontWeight: 700, cursor: 'pointer' }}>
                {activeIdx === STEPS.length - 1 ? 'Finish' : 'Next Segment →'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
