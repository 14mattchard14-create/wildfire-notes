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

// Inline form for logging (or editing) a single checklist item entry. Opens
// in place under the item row rather than taking over the whole screen —
// the point of the redesign is that you can move through a side of the
// house without losing your place. Pass `existingEntry` to edit an
// already-saved entry in place (pre-fills status/note/photo and updates
// instead of inserting) — omit it to add a new entry, which is the
// original behavior.
function ItemInlineForm({ item, propertyId, user, existingEntry, onSaved, onCancel, onDeleted }) {
  const [status,   setStatus]   = useState(existingEntry?.status || null)
  const [note,     setNote]     = useState(existingEntry?.note || '')
  const [photoUrl, setPhotoUrl] = useState(existingEntry?.photo_url || null)
  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const isEdit = !!existingEntry

  async function save() {
    if (!note.trim()) { alert('Add a quick note describing what you see.'); return }
    if (!status)      { alert('Select a status.'); return }
    setSaving(true)
    if (isEdit) {
      const { error } = await supabase.from('entries')
        .update({ status, note: note.trim(), photo_url: photoUrl || null })
        .eq('id', existingEntry.id)
      setSaving(false)
      if (error) { alert('Save failed: ' + error.message); return }
    } else {
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
    }
    onSaved()
  }

  async function del() {
    if (!confirm('Delete this entry? This can\'t be undone.')) return
    setDeleting(true)
    const { error } = await supabase.from('entries').delete().eq('id', existingEntry.id)
    setDeleting(false)
    if (error) { alert('Delete failed: ' + error.message); return }
    onDeleted()
  }

  return (
    <div style={{ background: c.bg, border: `1px solid ${c.line}`, borderRadius: 6, padding: 14, marginTop: 6, marginBottom: 6 }}>
      {infoOpen && <InfoModal category={item.zone} onClose={() => setInfoOpen(false)} />}

      <p style={{ fontSize: 12, color: c.muted, lineHeight: 1.5, margin: '0 0 6px' }}>{item.hint}</p>
      <button onClick={() => setInfoOpen(true)} style={{ marginBottom: 12, fontSize: 11, fontFamily: 'monospace', color: c.accent, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
        ⓘ Read about this category
      </button>

      <div style={{ marginBottom: 12 }}>
        <PhotoUpload propertyId={propertyId} onPhotoUrl={setPhotoUrl} initialUrl={existingEntry?.photo_url} />
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
          {saving ? 'Saving…' : isEdit ? 'Update Entry' : 'Save Entry'}
        </button>
        <button onClick={onCancel} style={{ padding: '11px 14px', background: 'transparent', border: `1px solid ${c.line}`, borderRadius: 4, color: c.muted, fontSize: 12.5, cursor: 'pointer' }}>
          Cancel
        </button>
        {isEdit && (
          <button onClick={del} disabled={deleting} style={{ padding: '11px 14px', background: 'transparent', border: `1px solid ${c.warn}`, borderRadius: 4, color: c.warn, fontSize: 12.5, cursor: 'pointer', opacity: deleting ? 0.5 : 1 }}>
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        )}
      </div>
    </div>
  )
}

// Inline form for a single plant photo — deliberately just a photo, no
// status/note fields, since plants aren't a WPH compliance category. Pass
// `existingPlant` to replace an already-saved photo (or delete it) instead
// of adding a new one. Mirrors ItemInlineForm's add/edit/delete shape.
function PlantInlineForm({ propertyId, zone, existingPlant, onSaved, onCancel, onDeleted }) {
  const [photoUrl, setPhotoUrl] = useState(existingPlant?.photo_url || null)
  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(false)
  const isEdit = !!existingPlant

  async function save() {
    if (!photoUrl) { alert('Take a photo of the plant first.'); return }
    setSaving(true)
    const { error } = isEdit
      ? await supabase.from('property_plants').update({ photo_url: photoUrl }).eq('id', existingPlant.id)
      : await supabase.from('property_plants').insert({ property_id: propertyId, zone, photo_url: photoUrl })
    setSaving(false)
    if (error) { alert('Save failed: ' + error.message); return }
    onSaved()
  }

  async function del() {
    if (!confirm('Delete this plant photo? This can\'t be undone.')) return
    setDeleting(true)
    const { error } = await supabase.from('property_plants').delete().eq('id', existingPlant.id)
    setDeleting(false)
    if (error) { alert('Delete failed: ' + error.message); return }
    onDeleted()
  }

  return (
    <div style={{ background: c.bg, border: `1px solid ${c.line}`, borderRadius: 6, padding: 14, marginTop: 6, marginBottom: 6 }}>
      <div style={{ marginBottom: 12 }}>
        <PhotoUpload propertyId={propertyId} onPhotoUrl={setPhotoUrl} initialUrl={existingPlant?.photo_url} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={save} disabled={saving || !photoUrl} style={{ flex: 1, background: c.accent, color: '#FFFFFF', border: 'none', borderRadius: 4, fontSize: 12.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', padding: 11, cursor: 'pointer', opacity: (saving || !photoUrl) ? 0.5 : 1 }}>
          {saving ? 'Saving…' : isEdit ? 'Update Photo' : 'Save Photo'}
        </button>
        <button onClick={onCancel} style={{ padding: '11px 14px', background: 'transparent', border: `1px solid ${c.line}`, borderRadius: 4, color: c.muted, fontSize: 12.5, cursor: 'pointer' }}>
          Cancel
        </button>
        {isEdit && (
          <button onClick={del} disabled={deleting} style={{ padding: '11px 14px', background: 'transparent', border: `1px solid ${c.warn}`, borderRadius: 4, color: c.warn, fontSize: 12.5, cursor: 'pointer', opacity: deleting ? 0.5 : 1 }}>
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        )}
      </div>
    </div>
  )
}

// Inline form for a single dimension capture — a photo of the thing being
// measured with a standard sheet of paper laid flat in the same shot as a
// scale reference, plus a short label and a mitigation category. No manual
// dimension entry: report-draft sends the photo to Claude vision, which
// locates the paper (known 8.5x11in size), locates the measured item, and
// computes an estimated real-world dimension from the two — see
// report-draft/route.js. Available on every segment (unlike Plants, which
// is vegetation-zones only), since mitigations needing a size estimate can
// turn up anywhere: fence runs, brush clearance width, tank-to-structure
// distance, etc.
//
// Category drives the unit (ft vs. sq ft) rather than the inspector picking
// it directly — the category IS the thing that gets priced later on the
// /estimate tab (see mitigation_price_rates, migration 022), so matching
// has to be an exact category lookup, not fuzzy label text.
function MeasurementInlineForm({ propertyId, zone, existingMeasurement, onSaved, onCancel, onDeleted }) {
  const [label,    setLabel]    = useState(existingMeasurement?.label || '')
  const [category, setCategory] = useState(existingMeasurement?.category || '')
  const [rates,    setRates]    = useState([])
  const [photoUrl, setPhotoUrl] = useState(existingMeasurement?.photo_url || null)
  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(false)
  const isEdit = !!existingMeasurement

  useEffect(() => {
    supabase.from('mitigation_price_rates').select('category, unit').order('category')
      .then(({ data }) => setRates(data || []))
  }, [])

  const selectedRate = rates.find(r => r.category === category)
  const unit = selectedRate?.unit || existingMeasurement?.unit || ''

  async function save() {
    if (!label.trim()) { alert('Describe what you\'re measuring (e.g. "brush clearance run").'); return }
    if (!category) { alert('Pick a mitigation category — it\'s how the Estimate tab matches this to a cost rate.'); return }
    if (!photoUrl) { alert('Take a photo first — lay a standard sheet of paper flat in the same shot as what you\'re measuring, for scale.'); return }
    setSaving(true)
    const payload = { label: label.trim(), category, unit, photo_url: photoUrl, reference_type: 'letter_paper' }
    const { error } = isEdit
      ? await supabase.from('property_measurements').update(payload).eq('id', existingMeasurement.id)
      : await supabase.from('property_measurements').insert({ property_id: propertyId, zone, ...payload })
    setSaving(false)
    if (error) { alert('Save failed: ' + error.message); return }
    onSaved()
  }

  async function del() {
    if (!confirm('Delete this measurement? This can\'t be undone.')) return
    setDeleting(true)
    const { error } = await supabase.from('property_measurements').delete().eq('id', existingMeasurement.id)
    setDeleting(false)
    if (error) { alert('Delete failed: ' + error.message); return }
    onDeleted()
  }

  return (
    <div style={{ background: c.bg, border: `1px solid ${c.line}`, borderRadius: 6, padding: 14, marginTop: 6, marginBottom: 6 }}>
      <p style={{ fontSize: 12, color: c.muted, lineHeight: 1.5, margin: '0 0 10px' }}>
        Lay a standard sheet of paper (8.5×11") flat in the same shot as what you're measuring — the report generator uses it as a scale reference to estimate the real-world size.
      </p>
      <input style={{ ...input, marginBottom: 10 }} type="text" placeholder='What are you measuring? (e.g. "brush clearance run")' value={label} onChange={e => setLabel(e.target.value)} />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...input, flex: 1 }}>
          <option value="">Mitigation category…</option>
          {rates.map(r => <option key={r.category} value={r.category}>{r.category}</option>)}
        </select>
        {unit && <span style={{ fontSize: 11, fontFamily: 'monospace', color: c.muted, whiteSpace: 'nowrap' }}>in {unit}</span>}
      </div>
      {rates.length === 0 && (
        <p style={{ fontSize: 11.5, color: c.warn, lineHeight: 1.5, margin: '-6px 0 12px' }}>
          No mitigation categories set up yet — add some on the Estimate tab first.
        </p>
      )}
      <div style={{ marginBottom: 12 }}>
        <PhotoUpload propertyId={propertyId} onPhotoUrl={setPhotoUrl} initialUrl={existingMeasurement?.photo_url} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={save} disabled={saving} style={{ flex: 1, background: c.accent, color: '#FFFFFF', border: 'none', borderRadius: 4, fontSize: 12.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', padding: 11, cursor: 'pointer', opacity: saving ? 0.5 : 1 }}>
          {saving ? 'Saving…' : isEdit ? 'Update Measurement' : 'Save Measurement'}
        </button>
        <button onClick={onCancel} style={{ padding: '11px 14px', background: 'transparent', border: `1px solid ${c.line}`, borderRadius: 4, color: c.muted, fontSize: 12.5, cursor: 'pointer' }}>
          Cancel
        </button>
        {isEdit && (
          <button onClick={del} disabled={deleting} style={{ padding: '11px 14px', background: 'transparent', border: `1px solid ${c.warn}`, borderRadius: 4, color: c.warn, fontSize: 12.5, cursor: 'pointer', opacity: deleting ? 0.5 : 1 }}>
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        )}
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
  // Within the currently-open item: null = just showing the list of
  // already-logged entries (no form), 'new' = form open to add another,
  // or an entry id = form open pre-filled to edit that specific entry.
  const [itemFormState, setItemFormState] = useState(null)
  const [segRows, setSegRows] = useState({}) // segment_key -> { photo_url, ai_suggestions }
  const [segPhotoDraft, setSegPhotoDraft] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [satellite, setSatellite] = useState(() => parseSatellite(property?.satellite_analysis))
  const [satelliteAt, setSatelliteAt] = useState(property?.satellite_analyzed_at ?? null)
  const [satelliteRunning, setSatelliteRunning] = useState(false)
  const [satelliteImageUrl, setSatelliteImageUrl] = useState(property?.satellite_image_url ?? null)
  const [streetViewImageUrl, setStreetViewImageUrl] = useState(property?.street_view_image_url ?? null)
  const [notesDraft, setNotesDraft] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)
  const [plants, setPlants] = useState([]) // all property_plants rows for this property
  const [plantsOpen, setPlantsOpen] = useState(false)
  // null = list only, 'new' = form open to add a photo, or an entry id =
  // form open to replace/remove that specific plant's photo.
  const [plantFormState, setPlantFormState] = useState(null)
  const [measurements, setMeasurements] = useState([]) // all property_measurements rows for this property
  const [measurementsOpen, setMeasurementsOpen] = useState(false)
  // null = list only, 'new' = form open to add a measurement, or an entry
  // id = form open to replace/remove that specific measurement.
  const [measurementFormState, setMeasurementFormState] = useState(null)
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

  // All plants for this property, loaded once — filtered per-zone at
  // render time (front/left/right/back all share the same zone, so this
  // avoids four separate queries for what's really one shared list).
  const loadPlants = useCallback(async () => {
    const { data } = await supabase.from('property_plants').select('*').eq('property_id', propertyId).order('created_at')
    setPlants(data || [])
  }, [propertyId])

  useEffect(() => { loadPlants() }, [loadPlants])

  // All measurements for this property, loaded once — filtered per-segment
  // at render time by zone (each segment stores its own zone label, unlike
  // Plants which shares one zone across front/left/right/back).
  const loadMeasurements = useCallback(async () => {
    const { data } = await supabase.from('property_measurements').select('*').eq('property_id', propertyId).order('created_at')
    setMeasurements(data || [])
  }, [propertyId])

  useEffect(() => { loadMeasurements() }, [loadMeasurements])

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

  // After a save/update/delete in the item form, close just the form (not
  // the whole item panel) so the inspector lands back on the list and can
  // see the entry they just added/edited, or add another right away —
  // previously this collapsed the entire item, losing that context.
  function refreshEntries() {
    setItemFormState(null)
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
      setStreetViewImageUrl(data.streetViewImageUrl ?? null)
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
    setItemFormState(null)
    setPlantsOpen(false)
    setPlantFormState(null)
    setMeasurementsOpen(false)
    setMeasurementFormState(null)
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

                  {(satelliteImageUrl || streetViewImageUrl) && (
                    <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      {satelliteImageUrl && (
                        <div style={{ flex: '1 1 200px', minWidth: 160 }}>
                          <div style={{ fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.06em', textTransform: 'uppercase', color: c.muted, marginBottom: 4 }}>Satellite</div>
                          <div style={{ borderRadius: 6, overflow: 'hidden', border: `1px solid ${c.line}`, lineHeight: 0 }}>
                            <img src={satelliteImageUrl} alt="Satellite view of the property, cropped in tight" style={{ display: 'block', width: '100%', height: 'auto' }} />
                          </div>
                        </div>
                      )}
                      {streetViewImageUrl && (
                        <div style={{ flex: '1 1 200px', minWidth: 160 }}>
                          <div style={{ fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.06em', textTransform: 'uppercase', color: c.muted, marginBottom: 4 }}>Street View</div>
                          <div style={{ borderRadius: 6, overflow: 'hidden', border: `1px solid ${c.line}`, lineHeight: 0 }}>
                            <img src={streetViewImageUrl} alt="Street View of the front of the property" style={{ display: 'block', width: '100%', height: 'auto' }} />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {satelliteAt && !streetViewImageUrl && (
                    <p style={{ marginTop: 10, marginBottom: 0, fontSize: 11, color: c.muted, fontStyle: 'italic' }}>No Street View coverage found for this address.</p>
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
                const itemEntries = entries.filter(e => e.zone === item.zone && e.detail === item.label)
                const done = itemEntries.length > 0
                const isOpen = openItemLabel === item.label
                const editingEntry = itemFormState && itemFormState !== 'new' ? itemEntries.find(en => en.id === itemFormState) : null
                return (
                  <div key={item.label}>
                    <button
                      onClick={() => {
                        const opening = !isOpen
                        setOpenItemLabel(opening ? item.label : null)
                        setItemFormState(null)
                      }}
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
                      <span style={{ fontSize: 11, color: c.muted }}>{isOpen ? '▲' : (done ? `${itemEntries.length} logged` : '+')}</span>
                    </button>
                    {isOpen && (
                      <div style={{ marginTop: 6, marginBottom: 6 }}>
                        {/* Already-logged entries for this item — click one to
                            edit it in place, rather than only ever being able
                            to add blind new entries next to it. */}
                        {itemEntries.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                            {itemEntries.map(en => (
                              <div key={en.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: c.surface, border: `1px solid ${c.line}`, borderRadius: 6, padding: '9px 11px' }}>
                                {en.photo_url && <img src={en.photo_url} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.04em', color: c.accent, marginBottom: 2 }}>
                                    {STATUSES.find(s => s.value === en.status)?.label || en.status || 'Pending'}
                                  </div>
                                  <div style={{ fontSize: 12.5, color: c.text, lineHeight: 1.4 }}>{en.note}</div>
                                </div>
                                <button onClick={() => setItemFormState(en.id)} style={{ fontSize: 11, fontFamily: 'monospace', color: c.accent, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', flexShrink: 0 }}>
                                  ✎ Edit
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {itemFormState === 'new' || editingEntry ? (
                          <ItemInlineForm
                            item={item}
                            propertyId={propertyId}
                            user={user}
                            existingEntry={editingEntry}
                            onSaved={refreshEntries}
                            onCancel={() => setItemFormState(null)}
                            onDeleted={refreshEntries}
                          />
                        ) : (
                          <button onClick={() => setItemFormState('new')} style={{ fontSize: 12, fontFamily: 'monospace', color: c.accent, background: 'transparent', border: `1px solid ${c.accent}`, borderRadius: 4, padding: '8px 12px', cursor: 'pointer' }}>
                            {done ? '+ Add another entry' : '+ Add entry'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Plants — styled and interacted with exactly like a checklist
                item above (collapsed row → expand → list of what's already
                logged, each editable in place, plus an add button), but
                it's not a WPH compliance category: no status, no note, just
                a photo. The AI identifies the plant and assesses it when
                the report is generated (see report-draft/route.js) — that's
                what "Vegetation Considerations" pulls from. */}
            {activeStep.plantsZone && (() => {
              const zonePlants = plants.filter(p => p.zone === activeStep.plantsZone)
              const plantsDone = zonePlants.length > 0
              const editingPlant = plantFormState && plantFormState !== 'new' ? zonePlants.find(p => p.id === plantFormState) : null
              return (
                <div style={{ marginBottom: 20 }}>
                  <button
                    onClick={() => {
                      const opening = !plantsOpen
                      setPlantsOpen(opening)
                      setPlantFormState(null)
                    }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                      background: c.surface, border: `1px solid ${plantsOpen ? c.accent : (plantsDone ? c.ok : c.line)}`,
                      borderRadius: 6, padding: '10px 12px', cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    <span style={{
                      width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                      border: `1px solid ${plantsDone ? c.ok : c.line}`,
                      background: plantsDone ? c.ok : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, color: '#FFFFFF',
                    }}>{plantsDone ? '✓' : ''}</span>
                    <span style={{ fontSize: 13, color: plantsDone ? c.muted : c.text, flex: 1 }}>Plants</span>
                    <span style={{ fontSize: 11, color: c.muted }}>{plantsOpen ? '▲' : (plantsDone ? `${zonePlants.length} logged` : '+')}</span>
                  </button>
                  {plantsOpen && (
                    <div style={{ marginTop: 6, marginBottom: 6 }}>
                      <p style={{ fontSize: 12, color: c.muted, lineHeight: 1.5, margin: '0 0 8px' }}>
                        Photograph each plant you can get a clear shot of — the report will identify it and note whether it's a good fire-safe choice, plus spacing guidance.
                      </p>
                      {zonePlants.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                          {zonePlants.map(p => (
                            <button key={p.id} onClick={() => setPlantFormState(p.id)} style={{ padding: 0, border: `1px solid ${plantFormState === p.id ? c.accent : c.line}`, borderRadius: 6, overflow: 'hidden', cursor: 'pointer', lineHeight: 0, background: 'none' }}>
                              <img src={p.photo_url} alt="Logged plant" style={{ width: 64, height: 64, objectFit: 'cover', display: 'block' }} />
                            </button>
                          ))}
                        </div>
                      )}

                      {(plantFormState === 'new' || editingPlant) ? (
                        <PlantInlineForm
                          propertyId={propertyId}
                          zone={activeStep.plantsZone}
                          existingPlant={editingPlant}
                          onSaved={async () => { await loadPlants(); setPlantFormState(null) }}
                          onCancel={() => setPlantFormState(null)}
                          onDeleted={async () => { await loadPlants(); setPlantFormState(null) }}
                        />
                      ) : (
                        <button onClick={() => setPlantFormState('new')} style={{ fontSize: 12, fontFamily: 'monospace', color: c.accent, background: 'transparent', border: `1px solid ${c.accent}`, borderRadius: 4, padding: '8px 12px', cursor: 'pointer' }}>
                          {plantsDone ? '+ Add another plant photo' : '+ Add plant photo'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Measurements — same collapsed-row/list/edit-in-place pattern
                as Plants, but available on every segment (mitigations
                needing a size estimate aren't confined to vegetation
                zones). Each entry is a photo + label + unit; report-draft
                turns it into an actual dimension estimate using the sheet
                of paper in-frame as a scale reference (see
                MeasurementInlineForm above and report-draft/route.js). */}
            {(() => {
              const zoneMeasurements = measurements.filter(m => m.zone === activeStep.label)
              const measurementsDone = zoneMeasurements.length > 0
              const editingMeasurement = measurementFormState && measurementFormState !== 'new' ? zoneMeasurements.find(m => m.id === measurementFormState) : null
              return (
                <div style={{ marginBottom: 20 }}>
                  <button
                    onClick={() => {
                      const opening = !measurementsOpen
                      setMeasurementsOpen(opening)
                      setMeasurementFormState(null)
                    }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                      background: c.surface, border: `1px solid ${measurementsOpen ? c.accent : (measurementsDone ? c.ok : c.line)}`,
                      borderRadius: 6, padding: '10px 12px', cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    <span style={{
                      width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                      border: `1px solid ${measurementsDone ? c.ok : c.line}`,
                      background: measurementsDone ? c.ok : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, color: '#FFFFFF',
                    }}>{measurementsDone ? '✓' : ''}</span>
                    <span style={{ fontSize: 13, color: measurementsDone ? c.muted : c.text, flex: 1 }}>Measurements</span>
                    <span style={{ fontSize: 11, color: c.muted }}>{measurementsOpen ? '▲' : (measurementsDone ? `${zoneMeasurements.length} logged` : '+')}</span>
                  </button>
                  {measurementsOpen && (
                    <div style={{ marginTop: 6, marginBottom: 6 }}>
                      <p style={{ fontSize: 12, color: c.muted, lineHeight: 1.5, margin: '0 0 8px' }}>
                        For anything that'll need a size estimate for mitigation costing — fence runs, brush clearance area, distance from a tank to the structure, etc.
                      </p>
                      {zoneMeasurements.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                          {zoneMeasurements.map(m => (
                            <div key={m.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: c.surface, border: `1px solid ${c.line}`, borderRadius: 6, padding: '9px 11px' }}>
                              {m.photo_url && <img src={m.photo_url} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12.5, color: c.text, lineHeight: 1.4 }}>{m.label}</div>
                                <div style={{ fontSize: 10, fontFamily: 'monospace', color: c.muted, marginTop: 2 }}>{m.category ? `${m.category} · ${m.unit}` : (m.unit || 'uncategorized')}</div>
                              </div>
                              <button onClick={() => setMeasurementFormState(m.id)} style={{ fontSize: 11, fontFamily: 'monospace', color: c.accent, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', flexShrink: 0 }}>
                                ✎ Edit
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {(measurementFormState === 'new' || editingMeasurement) ? (
                        <MeasurementInlineForm
                          propertyId={propertyId}
                          zone={activeStep.label}
                          existingMeasurement={editingMeasurement}
                          onSaved={async () => { await loadMeasurements(); setMeasurementFormState(null) }}
                          onCancel={() => setMeasurementFormState(null)}
                          onDeleted={async () => { await loadMeasurements(); setMeasurementFormState(null) }}
                        />
                      ) : (
                        <button onClick={() => setMeasurementFormState('new')} style={{ fontSize: 12, fontFamily: 'monospace', color: c.accent, background: 'transparent', border: `1px solid ${c.accent}`, borderRadius: 4, padding: '8px 12px', cursor: 'pointer' }}>
                          {measurementsDone ? '+ Add another measurement' : '+ Add measurement'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })()}

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
