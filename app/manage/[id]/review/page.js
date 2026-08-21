'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { authFetch } from '@/lib/authFetch'
import { ZONES } from '@/lib/criteria'
import {
  ACTION_PRIORITIES, parseReportData, emptyFinding, emptyActionItem,
  reportSectionSlice, diffSectionSlices, sectionLabel, zoneSectionKey,
  zonePhotoItems, excludedZonePhotos, photoTransformStyle, wordDiff,
} from '@/lib/reportSchema'
import {
  reportColors, StatusPill, RiskBadge, CollapsibleCard, priorityColor,
  FindingView, ZonePhotoGrid, ActionPlanTable, PhotoCarousel, Modal,
  VegetationConsiderationsSection,
  MitigationMeasurementsSection,
} from '@/components/ReportView'
import ThemeToggle from '@/components/ThemeToggle'
import BrandLogo from '@/components/BrandLogo'
import BackNav from '@/components/BackNav'
import AdminSidebar from '@/components/AdminSidebar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Pencil, Check, X, Plus, Trash2, Copy, History, Flag, RotateCcw, ZoomIn, GripVertical } from 'lucide-react'
import { useConfirmDialog } from '@/components/ConfirmDialogProvider'

const c = reportColors
const iconBtnStyle = { background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }
const focusRing = 'focus:outline-none focus:ring-1 focus:ring-[#C1502E] focus:ring-offset-1 rounded-sm'
// Editable text that reads as plain report copy until you click into it —
// same font/size/color as the read-only version, no visible border/box
// until focused, so the editing surface genuinely looks like the report
// rather than a form sitting next to it.
const blend = { border: 'none', background: 'transparent', outline: 'none', width: '100%', fontFamily: 'inherit', padding: '2px 4px', margin: '-2px -4px', boxSizing: 'border-box' }

// One finding, styled exactly like the read-only FindingView on the
// published report — category + status pill, a "Learn more" toggle over
// the finding/rationale text (open by default here since you're editing
// them, unlike the closed-by-default customer view), and the recommendation
// always visible below since that's the one thing every customer needs to
// see. Every piece of text is a blended input/textarea instead of a static
// string, and status is the same pill component in its `editable` mode.
function EditableFinding({ f, onChange, onRemove }) {
  const [expanded, setExpanded] = useState(true)
  const isNC = /non-compliant/i.test(f.status || '')
  const isOK = /^(base|plus) compliant/i.test(f.status || '')
  return (
    <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderLeft: `4px solid ${isNC ? c.warn : isOK ? c.ok : c.border}`, borderRadius: 8, padding: '14px 16px', marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
        <input
          value={f.category}
          onChange={e => onChange('category', e.target.value)}
          placeholder="Category / item"
          className={focusRing}
          style={{ ...blend, fontWeight: 700, color: c.navy, fontSize: 14.5, flex: 1, minWidth: 0 }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <StatusPill status={f.status} editable onChange={v => onChange('status', v)} />
          <button onClick={onRemove} title="Remove finding" style={{ background: 'none', border: 'none', color: c.muted, cursor: 'pointer', display: 'flex', padding: 2 }}>
            <X size={15} />
          </button>
        </div>
      </div>

      <div style={{ background: c.surfaceAlt, borderRadius: 6, padding: '9px 13px', marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: c.navy, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recommendation — always shown</div>
        <textarea
          value={f.recommendation}
          onChange={e => onChange('recommendation', e.target.value)}
          placeholder="Leave blank if fully compliant"
          rows={2}
          className={focusRing}
          style={{ ...blend, resize: 'vertical', fontSize: 13.5, color: c.text, lineHeight: 1.6 }}
        />
      </div>

      <button
        onClick={() => setExpanded(x => !x)}
        style={{ background: 'none', border: 'none', padding: 0, margin: expanded ? '0 0 8px' : 0, color: c.slate, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
      >
        {expanded ? '▾ Hide details' : '▸ Learn more about this finding'} <span style={{ opacity: 0.6, fontWeight: 400 }}>(what the customer sees when they click it)</span>
      </button>

      {expanded && (
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: c.muted, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>What was observed</div>
          <textarea
            value={f.finding}
            onChange={e => onChange('finding', e.target.value)}
            placeholder="What was observed, across the whole house"
            rows={2}
            className={focusRing}
            style={{ ...blend, resize: 'vertical', fontSize: 13.5, color: c.text, lineHeight: 1.6, marginBottom: 8 }}
          />
          <div style={{ fontSize: 10.5, fontWeight: 700, color: c.muted, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Rationale — why this status</div>
          <textarea
            value={f.rationale}
            onChange={e => onChange('rationale', e.target.value)}
            placeholder="Why this status was assigned"
            rows={2}
            className={focusRing}
            style={{ ...blend, resize: 'vertical', fontSize: 13, color: c.muted, fontStyle: 'italic', lineHeight: 1.55 }}
          />
        </div>
      )}
    </div>
  )
}

const addFindingBtnStyle = { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontFamily: 'monospace', color: c.slate, background: 'none', border: `1px solid ${c.border}`, borderRadius: 4, padding: '6px 10px', cursor: 'pointer' }

// Finds the draggable item (if any) under a given viewport point, and
// which half of it the point falls in — items mark themselves with
// data-drop-target (an opaque id the caller parses) and data-drop-axis
// ("x" for the horizontal photo strip, "y" for vertical lists), so this
// works generically across all three drag contexts.
//
// This replaced an earlier version built around thin strips rendered
// *between* items: technically correct, but real-world drag logging
// showed people's actual mouse movements were only a few pixels — nowhere
// near enough to reach a strip sitting 90+ px away between two items. The
// items themselves are a far larger, much easier target, so hit-testing
// against the whole item (split into a "before"/"after" half by cursor
// position) is what actually gets landed on in practice.
function dropTargetAt(x, y) {
  const el = typeof document !== 'undefined' ? document.elementFromPoint(x, y) : null
  const targetEl = el?.closest('[data-drop-target]')
  if (!targetEl) return null
  const rect = targetEl.getBoundingClientRect()
  const axis = targetEl.dataset.dropAxis
  const side = axis === 'x'
    ? (x < rect.left + rect.width / 2 ? 'before' : 'after')
    : (y < rect.top + rect.height / 2 ? 'before' : 'after')
  return { id: targetEl.dataset.dropTarget, side }
}

// Shared drag-to-reorder handle for findings, zone panels, and photo tiles
// alike, rather than making the whole row/tile draggable (which fights
// with clicking buttons or selecting text inside it). Hidden until
// hovered via Tailwind's group-hover, so callers wrap each draggable row
// in className="group".
//
// Built on the Pointer Events API rather than native HTML5 drag-and-drop.
// Native drag turned out to be unreliable here across several rounds of
// fixes (silently needs dataTransfer.setData to even start; is flaky when
// the draggable element sits inside a horizontally-scrolling, scroll-snap
// container like the photo strip). Pointer events put the whole gesture
// under our own control instead of the browser's native drag session.
function DragHandle({ onDragStart, onDragMove, onDragEnd, dark, style }) {
  return (
    <div
      onPointerDown={e => {
        if (e.button != null && e.button !== 0) return // left click / primary touch only
        e.preventDefault()
        e.stopPropagation()
        // preventDefault() on the initial press doesn't reliably stop the
        // browser from starting its own text/content selection drag as the
        // pointer moves over sibling elements mid-gesture (this is a known
        // browser quirk, not something scoped to just the pressed element)
        // — explicitly killing selection on the whole document for the
        // duration of the drag is the standard fix, restored on release.
        const prevUserSelect = document.body.style.userSelect
        const prevWebkitUserSelect = document.body.style.webkitUserSelect
        document.body.style.userSelect = 'none'
        document.body.style.webkitUserSelect = 'none'
        window.getSelection?.()?.removeAllRanges?.()
        onDragStart?.()
        function handleMove(ev) {
          window.getSelection?.()?.removeAllRanges?.()
          onDragMove?.(ev.clientX, ev.clientY)
        }
        function handleUp(ev) {
          window.removeEventListener('pointermove', handleMove)
          window.removeEventListener('pointerup', handleUp)
          window.removeEventListener('pointercancel', handleUp)
          document.body.style.userSelect = prevUserSelect
          document.body.style.webkitUserSelect = prevWebkitUserSelect
          onDragEnd?.(ev.clientX, ev.clientY)
        }
        window.addEventListener('pointermove', handleMove)
        window.addEventListener('pointerup', handleUp)
        window.addEventListener('pointercancel', handleUp)
      }}
      title="Drag to reorder"
      className="opacity-0 group-hover:opacity-100 transition-opacity"
      style={{ cursor: 'grab', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: dark ? 'rgba(255,255,255,0.75)' : c.muted, flexShrink: 0, ...style }}
    >
      <GripVertical size={16} />
    </div>
  )
}

// Inline style for the edge-highlight indicator shown on whichever item is
// currently being dragged over — a thin colored line on the "before" or
// "after" edge (left/right for the horizontal photo strip, top/bottom for
// vertical lists) showing exactly where the dragged item will land. Uses
// an inset box-shadow rather than a border so it doesn't affect layout/
// trigger reflow while dragging.
function dropIndicatorStyle(side, axis) {
  if (!side) return {}
  if (axis === 'x') {
    return { boxShadow: side === 'before' ? `inset 3px 0 0 0 ${c.navy}` : `inset -3px 0 0 0 ${c.navy}` }
  }
  return { boxShadow: side === 'before' ? `inset 0 3px 0 0 ${c.navy}` : `inset 0 -3px 0 0 ${c.navy}` }
}

function CopyButton({ text }) {
  const { alertDialog } = useConfirmDialog()
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      await alertDialog('Could not copy automatically — copy it manually: ' + text)
    }
  }
  return (
    <button onClick={copy} title={copied ? 'Copied!' : 'Copy'} style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: copied ? 'var(--ok)' : 'var(--text-muted)', display: 'inline-flex', verticalAlign: 'middle', marginLeft: 5 }}>
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  )
}

// Compresses to a reasonable size and uploads to the same Supabase Storage
// bucket entry photos already use (components/PhotoUpload.js), just under a
// distinct path prefix so report-only photos don't collide with entry
// photos. Reused for every "+ Add Photo" upload in the zone photo editor.
function compressImage(file, maxDim = 800, targetBytes = 700_000) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      const img = new Image()
      img.onload = () => {
        let w = img.width, h = img.height
        if (w > h && w > maxDim) { h = Math.round(h * maxDim / w); w = maxDim }
        else if (h > maxDim) { w = Math.round(w * maxDim / h); h = maxDim }
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        let q = 0.65, url = canvas.toDataURL('image/jpeg', q)
        while (url.length > targetBytes && q > 0.2) { q -= 0.1; url = canvas.toDataURL('image/jpeg', q) }
        resolve(url)
      }
      img.onerror = reject; img.src = e.target.result
    }
    reader.onerror = reject; reader.readAsDataURL(file)
  })
}

async function uploadReportPhoto(dataUrl, propertyId) {
  const blob = await (await fetch(dataUrl)).blob()
  const filename = `${propertyId}/report-extra/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`
  const { error } = await supabase.storage.from('entry-photos').upload(filename, blob, { contentType: 'image/jpeg', upsert: false })
  if (error) throw error
  const { data } = supabase.storage.from('entry-photos').getPublicUrl(filename)
  return data.publicUrl
}

const carouselTileFrame = { border: `1px solid ${c.border}`, borderRadius: 8, overflow: 'hidden', background: c.surfaceAlt, position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }
const photoOverlayBtnStyle = { width: 22, height: 22, borderRadius: '50%', background: 'rgba(23,36,49,0.72)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }

// Zoom / pan editor for a single photo — non-destructive (the original
// upload is untouched; this just saves a { zoom, x, y } transform applied
// wherever the photo renders, via lib/reportSchema's photoTransformStyle).
// Drag directly on the preview to re-center; the zoom slider scales it.
function PhotoAdjustModal({ item, onSave, onClose }) {
  const [zoom, setZoom] = useState(item.adjustment?.zoom ?? 1)
  const [pos, setPos] = useState({ x: item.adjustment?.x ?? 0, y: item.adjustment?.y ?? 0 })
  const frameRef = useRef(null)
  const dragging = useRef(false)
  const start = useRef({ cx: 0, cy: 0, px: 0, py: 0 })

  function down(e) {
    dragging.current = true
    start.current = { cx: e.clientX, cy: e.clientY, px: pos.x, py: pos.y }
  }
  function move(e) {
    if (!dragging.current || !frameRef.current) return
    const rect = frameRef.current.getBoundingClientRect()
    const dx = ((e.clientX - start.current.cx) / rect.width) * 100
    const dy = ((e.clientY - start.current.cy) / rect.height) * 100
    const limit = 45
    setPos({
      x: Math.max(-limit, Math.min(limit, start.current.px + dx)),
      y: Math.max(-limit, Math.min(limit, start.current.py + dy)),
    })
  }
  function up() { dragging.current = false }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,20,28,0.6)', zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: c.surface, borderRadius: 12, width: '100%', maxWidth: 420, boxShadow: '0 12px 48px rgba(0,0,0,0.3)', colorScheme: 'light' }}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: c.navy }}>Adjust Photo</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.muted, display: 'flex' }}><X size={18} /></button>
        </div>
        <div style={{ padding: 18 }}>
          <div
            ref={frameRef}
            onMouseDown={down}
            onMouseMove={move}
            onMouseUp={up}
            onMouseLeave={up}
            style={{ width: '100%', height: 260, overflow: 'hidden', borderRadius: 8, border: `1px solid ${c.border}`, cursor: dragging.current ? 'grabbing' : 'grab', background: c.surfaceAlt, userSelect: 'none' }}
          >
            <img
              src={item.url}
              alt=""
              draggable={false}
              style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${zoom}) translate(${pos.x}%, ${pos.y}%)`, transformOrigin: 'center center', pointerEvents: 'none' }}
            />
          </div>
          <div style={{ fontSize: 11, color: c.muted, textAlign: 'center', margin: '8px 0 14px' }}>Drag the photo to re-center it</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <span style={{ fontSize: 11, color: c.muted, fontFamily: 'monospace' }}>Zoom</span>
            <input type="range" min="1" max="3" step="0.05" value={zoom} onChange={e => setZoom(parseFloat(e.target.value))} style={{ flex: 1 }} />
            <span style={{ fontSize: 11, color: c.muted, fontFamily: 'monospace', width: 34, textAlign: 'right' }}>{zoom.toFixed(2)}x</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="outline" onClick={() => { setZoom(1); setPos({ x: 0, y: 0 }) }} className="flex-1 text-[12px] uppercase tracking-wide h-auto py-2 font-mono normal-case">
              Reset
            </Button>
            <Button onClick={() => onSave({ zoom, x: pos.x, y: pos.y })} className="flex-1 text-[12px] font-bold uppercase tracking-wide h-auto py-2">
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

const addTileStyle = { ...carouselTileFrame, alignItems: 'center', justifyContent: 'center', border: `1px dashed ${c.border}`, background: c.surface }

// The full photo editor for a zone: a carousel (same one the read-only
// report uses) with remove / status / drag-to-reorder / zoom-adjust
// controls layered onto each tile, a combined "add finding + photo" tile at
// the end of the scrollable strip, and — when there are any — a small strip
// of previously-removed photos with a one-click restore, so "remove" always
// stays reversible rather than being a destructive delete.
//
// Reordering uses a small drag handle (bottom of each tile, shown on
// hover) as the sole drag trigger rather than the whole tile — dragging
// the whole tile fought with clicking the remove/zoom buttons or selecting
// caption text.
function EditableZonePhotos({ zone, zi, entries, reportData, uploading, onCaptionChange, onExclude, onRestore, onReorder, onExtraCaptionChange, onRemoveExtra, onStatusChange, onExtraStatusChange, onAdjust, onAddFindingWithPhoto }) {
  const items = zonePhotoItems(zone, entries, reportData)
  const hidden = excludedZonePhotos(zone, entries, reportData)
  const [dragIndex, setDragIndex] = useState(null)
  const [dragOverTarget, setDragOverTarget] = useState(null) // { index, side } currently being dragged over — shows the "drop here" edge highlight
  const [adjusting, setAdjusting] = useState(null) // the item currently open in PhotoAdjustModal

  // The dragged item's whole target position is "before" or "after"
  // whichever tile it's currently over — translated to a standard
  // insertion index (N items have N+1 possible positions) using the same
  // splice-based reorder as before.
  //
  // `sourceIndex` is passed in explicitly by the caller (the tile's own
  // render-time `i`) rather than read from `dragIndex` state here — this
  // function is invoked from DragHandle's pointerup listener, which was
  // registered once at pointerdown and closes over whatever render was
  // current *then*. `dragIndex` state hadn't committed yet at that point,
  // so reading it here would always see the pre-drag value (null) and
  // silently no-op every drop. `sourceIndex` doesn't have that problem —
  // it's already correct the instant the handle is pressed.
  function dropOnTarget(sourceIndex, target) {
    if (sourceIndex == null || !target) { setDragIndex(null); setDragOverTarget(null); return }
    const insertAt = target.side === 'before' ? target.index : target.index + 1
    const finalIndex = sourceIndex < insertAt ? insertAt - 1 : insertAt
    if (finalIndex !== sourceIndex) {
      const ids = items.map(it => it.id)
      const [moved] = ids.splice(sourceIndex, 1)
      ids.splice(finalIndex, 0, moved)
      onReorder(zi, ids)
    }
    setDragIndex(null)
    setDragOverTarget(null)
  }

  // Reads a data-drop-target of the form "photo:<zi>:<index>", but only
  // when it belongs to *this* zone's carousel — ignores tiles from other
  // zones' photo strips or from findings/zone panels the pointer might
  // have crossed over mid-drag.
  function readTarget(hit) {
    if (!hit) return null
    const [kind, hitZi, index] = hit.id.split(':')
    if (kind !== 'photo' || Number(hitZi) !== zi) return null
    return { index: Number(index), side: hit.side }
  }

  const displayItems = [...items, { id: '__add__', isAddTile: true }]

  return (
    <div style={{ marginTop: 4, marginBottom: 8 }}>
      <PhotoCarousel
        items={displayItems}
        countOverride={items.length}
        tileWidth={190}
        renderItem={(item, i) => {
          if (item.isAddTile) {
            return (
              <label title="Add finding" style={{ ...addTileStyle, cursor: uploading ? 'default' : 'pointer' }}>
                <div style={{ width: 42, height: 42, borderRadius: '50%', background: c.navy, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Plus size={20} />
                </div>
                <input
                  type="file"
                  accept="image/*"
                  disabled={uploading}
                  style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files[0]; e.target.value = ''; if (f) onAddFindingWithPhoto(zi, f) }}
                />
              </label>
            )
          }
          const isDragSource = dragIndex === i
          const isOverTarget = dragIndex != null && dragIndex !== i && dragOverTarget?.index === i
          return (
            <div
              className="group"
              data-drop-target={`photo:${zi}:${i}`}
              data-drop-axis="x"
              style={{ ...carouselTileFrame, opacity: isDragSource ? 0.4 : 1, ...(isOverTarget ? dropIndicatorStyle(dragOverTarget.side, 'x') : {}) }}
            >
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', top: 6, left: 6, right: 6, display: 'flex', justifyContent: 'space-between', zIndex: 1 }}>
                  <button onClick={() => setAdjusting(item)} title="Zoom / re-center this photo" style={photoOverlayBtnStyle}>
                    <ZoomIn size={12} />
                  </button>
                  <button onClick={() => item.kind === 'entry' ? onExclude(item.entryId) : onRemoveExtra(zi, item.extraId)} title="Remove from report" style={photoOverlayBtnStyle}>
                    <X size={13} />
                  </button>
                </div>
                <div style={{ width: '100%', height: 130, overflow: 'hidden' }}>
                  <img src={item.url} alt={item.caption} draggable={false} style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover', ...photoTransformStyle(item.adjustment) }} />
                </div>
              </div>
              <div style={{ padding: '7px 9px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <textarea
                  value={item.caption}
                  onChange={e => item.kind === 'entry' ? onCaptionChange(item.entryId, e.target.value) : onExtraCaptionChange(zi, item.extraId, e.target.value)}
                  rows={2}
                  className={focusRing}
                  style={{ ...blend, resize: 'vertical', fontSize: 11, color: c.text, lineHeight: 1.4, fontStyle: 'italic', padding: '1px 2px', margin: '-1px -2px', flex: 1 }}
                />
                <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {/* Moved off the image (where it used to sit) into this
                      normal-flow footer row — sitting on top of the image
                      inside a horizontally-scrolling, scroll-snap track
                      made the drag gesture unreliable to grab. */}
                  <DragHandle
                    onDragStart={() => setDragIndex(i)}
                    onDragMove={(x, y) => { const t = readTarget(dropTargetAt(x, y)); if (t) setDragOverTarget(t) }}
                    onDragEnd={(x, y) => dropOnTarget(i, readTarget(dropTargetAt(x, y)))}
                    style={{ width: 20, height: 20 }}
                  />
                  <StatusPill
                    status={item.status || 'Not Applicable'}
                    editable
                    onChange={v => item.kind === 'entry' ? onStatusChange(item.entryId, v) : onExtraStatusChange(zi, item.extraId, v)}
                  />
                </div>
              </div>
            </div>
          )
        }}
      />

      {hidden.length > 0 && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${c.border}` }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: c.muted, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
            Hidden from report ({hidden.length})
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {hidden.map(h => (
              <div key={h.id} style={{ position: 'relative', width: 60, height: 60, borderRadius: 6, overflow: 'hidden', border: `1px solid ${c.border}`, opacity: 0.6 }}>
                <img src={h.url} alt={h.caption} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button
                  onClick={() => onRestore(h.entryId)}
                  title="Restore to report"
                  style={{ position: 'absolute', inset: 0, background: 'rgba(23,36,49,0.55)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <RotateCcw size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {adjusting && (
        <PhotoAdjustModal
          item={adjusting}
          onClose={() => setAdjusting(null)}
          onSave={adj => { onAdjust(adjusting.id, adj); setAdjusting(null) }}
        />
      )}
    </div>
  )
}

// The small pencil/history/done control cluster on every section's header —
// present on every section, in both read and edit states, so switching
// modes and checking history both stay reachable from the same spot.
function SectionTools({ sectionKey, editingSection, savingSection, onEdit, onDone, onHistory }) {
  const isEditing = editingSection === sectionKey
  const isSaving = savingSection === sectionKey
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, flexShrink: 0 }}>
      <button onClick={e => { e.stopPropagation(); onHistory(sectionKey) }} title="View change history" style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', display: 'flex', padding: 4 }}>
        <History size={15} />
      </button>
      {isEditing ? (
        <button
          onClick={e => { e.stopPropagation(); onDone(sectionKey) }}
          disabled={isSaving}
          style={{ background: 'rgba(255,255,255,0.16)', border: 'none', color: '#fff', cursor: isSaving ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 5, fontSize: 11.5, fontWeight: 700 }}
        >
          <Check size={13} /> {isSaving ? 'Saving…' : 'Done'}
        </button>
      ) : (
        <button onClick={e => { e.stopPropagation(); onEdit(sectionKey) }} title="Edit this section" style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', display: 'flex', padding: 4 }}>
          <Pencil size={15} />
        </button>
      )}
    </div>
  )
}

function formatDiffValue(v) {
  if (v == null || v === '') return '(empty)'
  if (Array.isArray(v)) return v.filter(Boolean).join('; ') || '(empty)'
  if (typeof v === 'object') {
    if (Array.isArray(v.findings)) return v.findings.map(f => `${f.category}: ${f.status}`).join('; ') || '(no findings)'
    return JSON.stringify(v)
  }
  return String(v)
}

// Renders a single field's change as one flowing paragraph with only the
// changed words struck through (removed) or highlighted (added), instead
// of two full separate before/after blocks — word-level, not paragraph-
// level, so a one-word edit reads as a one-word edit.
function WordDiffLine({ before, after }) {
  const tokens = wordDiff(formatDiffValue(before), formatDiffValue(after))
  return (
    <div style={{ fontSize: 12.5, color: c.text, lineHeight: 1.65, wordBreak: 'break-word' }}>
      {tokens.map((t, i) => {
        if (t.type === 'removed') return <span key={i} style={{ color: c.warn, textDecoration: 'line-through', opacity: 0.7 }}>{t.text}</span>
        if (t.type === 'added') return <span key={i} style={{ color: c.ok, background: 'rgba(58,125,68,.14)', borderRadius: 2 }}>{t.text}</span>
        return <span key={i}>{t.text}</span>
      })}
    </div>
  )
}

// Version history for one section — every AI draft / edit / final snapshot
// that touched this section, newest first, diffed field-by-field against
// whatever came right before it so you can see exactly what changed and
// when, not just the current state.
function SectionHistoryPopup({ sectionKey, versions, onClose }) {
  const relevant = versions
    .filter(v => v.section === sectionKey || v.source === 'ai_draft' || v.source === 'final')
    .slice()
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

  let prevSlice = null
  const rows = relevant.map((v, i) => {
    const slice = reportSectionSlice(v.report_data, sectionKey)
    const changes = i === 0 ? [] : diffSectionSlices(prevSlice, slice)
    prevSlice = slice
    return { version: v, changes, isBaseline: i === 0 }
  }).reverse()

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,20,28,0.55)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: c.surface, borderRadius: 12, width: '100%', maxWidth: 620, maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 12px 48px rgba(0,0,0,0.3)', colorScheme: 'light' }}>
        <div style={{ position: 'sticky', top: 0, background: c.navy, color: '#fff', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '12px 12px 0 0' }}>
          <div>
            <div style={{ fontSize: 11, opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Change History</div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{sectionLabel(sectionKey)}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex' }}><X size={18} /></button>
        </div>
        <div style={{ padding: '16px 20px' }}>
          {rows.length === 0 && <p style={{ fontSize: 13, color: c.muted }}>No history yet for this section.</p>}
          {rows.map((row, i) => (
            <div key={row.version.id} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: i < rows.length - 1 ? `1px solid ${c.border}` : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{
                  fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 10, textTransform: 'uppercase', letterSpacing: '0.04em',
                  background: row.version.source === 'ai_draft' ? c.surfaceAlt : row.version.source === 'final' ? '#EAF4EB' : '#FDF6E8',
                  color: row.version.source === 'ai_draft' ? c.muted : row.version.source === 'final' ? c.ok : '#8A6D3B',
                }}>
                  {row.version.source === 'ai_draft' ? 'AI Draft' : row.version.source === 'final' ? 'Final' : 'Edit'}
                </span>
                <span style={{ fontSize: 12, color: c.muted }}>{new Date(row.version.created_at).toLocaleString()}</span>
              </div>
              {row.isBaseline ? (
                <div style={{ fontSize: 12.5, color: c.muted, fontStyle: 'italic' }}>Initial state — nothing to compare against.</div>
              ) : row.changes.length === 0 ? (
                <div style={{ fontSize: 12.5, color: c.muted, fontStyle: 'italic' }}>No change to this section.</div>
              ) : (
                row.changes.map((ch, j) => (
                  <div key={j} style={{ marginBottom: 8, fontSize: 12.5 }}>
                    <div style={{ fontWeight: 700, color: c.navy, marginBottom: 2 }}>{ch.field}</div>
                    <WordDiffLine before={ch.before} after={ch.after} />
                  </div>
                ))
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// The review page IS the report editor now — no separate raw-markdown step,
// and by default it renders pixel-identical to the published report (same
// components as /report/[token], via components/ReportView.js). Each
// section has its own pencil icon to swap just that section into an
// editable form in place; a "Done" checkmark saves it — persisting the
// draft and recording a report_versions row — and switches back to the
// exact read-only look. A History icon on every section opens a popup with
// that section's change log (old vs. new), and a "Final Report" button
// checkpoints the whole report as the designated comparison point against
// the original AI draft, for the Report Quality portal's A/B export.

export default function PropertyReviewFlow() {
  const { id } = useParams()
  const router = useRouter()
  const { confirmDialog, alertDialog } = useConfirmDialog()
  const { user, loading, isHomeowner, profileReady } = useAuth()
  const [property, setProperty] = useState(null)
  const [entries, setEntries] = useState([])
  const [fetching, setFetching] = useState(true)

  const [draftData, setDraftData] = useState(null)
  const [legacyDraft, setLegacyDraft] = useState('')
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [shareInfo, setShareInfo] = useState(null) // { token, accessCode }
  const [notifyingCustomer, setNotifyingCustomer] = useState(false)
  const [sendPreview, setSendPreview] = useState(null) // { to, subject, html, reportUrl, accessCode }
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [editingCustomerEmail, setEditingCustomerEmail] = useState(false)
  const [customerEmailDraft, setCustomerEmailDraft] = useState('')
  const [savingCustomerEmail, setSavingCustomerEmail] = useState(false)
  const [addZoneKey, setAddZoneKey] = useState('')
  const [uploadingZone, setUploadingZone] = useState(null) // zone index currently uploading a new photo
  const [dragZoneIndex, setDragZoneIndex] = useState(null) // zone index currently being dragged for panel reorder
  const [dragOverZoneTarget, setDragOverZoneTarget] = useState(null) // { index, side } currently being dragged over — "drop here" edge highlight
  const [dragFinding, setDragFinding] = useState(null) // { zi, fi } of the finding currently being dragged
  const [dragOverFindingTarget, setDragOverFindingTarget] = useState(null) // { zi, index, side } currently being dragged over — "drop here" edge highlight

  // --- per-section edit/history/final-version state ---
  const [editingSection, setEditingSection] = useState(null) // null | 'exec' | 'overview' | 'action' | `zone:${name}`
  const [savingSection, setSavingSection] = useState(null)
  const [versions, setVersions] = useState([])
  const [historyFor, setHistoryFor] = useState(null)
  const [markingFinal, setMarkingFinal] = useState(false)
  const [finalMsg, setFinalMsg] = useState('')
  // Mitigation categories for fixing up an uncategorized/miscategorized
  // measurement without leaving the review page — see mitigation_price_rates,
  // migration 022, and the /estimate tab that prices against it.
  const [rateCategories, setRateCategories] = useState([])
  useEffect(() => {
    supabase.from('mitigation_price_rates').select('category').order('category')
      .then(({ data }) => setRateCategories((data || []).map(r => r.category)))
  }, [])

  const load = useCallback(async () => {
    setFetching(true)
    const [{ data: prop }, { data: ents, error: entriesError }] = await Promise.all([
      supabase.from('properties').select('*').eq('id', id).maybeSingle(),
      // select('*') deliberately, not an explicit column list — this table
      // predates the migrations folder so its exact columns aren't
      // guaranteed here, and an unknown-column select fails the whole
      // query silently (which is exactly what happened with `ai_caption`,
      // a field that gets read defensively elsewhere but was never an
      // actual column).
      supabase.from('entries').select('*').eq('property_id', id),
    ])
    if (entriesError) console.error('Failed to load entries for review page:', entriesError)
    setProperty(prop)
    setEntries(ents ?? [])
    const parsed = parseReportData(prop?.report_draft_markdown)
    if (parsed) { setDraftData(parsed); setLegacyDraft('') }
    else { setDraftData(null); setLegacyDraft(prop?.report_draft_markdown?.trim() ? prop.report_draft_markdown : '') }
    setFetching(false)

    if (prop?.shared_report_token) {
      const { data: shared } = await supabase.from('shared_reports').select('token, access_code').eq('token', prop.shared_report_token).maybeSingle()
      if (shared) setShareInfo({ token: shared.token, accessCode: shared.access_code })
    }

    try {
      const res = await authFetch(`/api/report-version?propertyId=${id}`)
      const data = await res.json()
      if (res.ok) setVersions(data.versions || [])
    } catch (err) {
      console.error('Failed to load report version history:', err)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  async function generateDraft() {
    if ((draftData || legacyDraft) && !(await confirmDialog('This will overwrite the current draft with a freshly generated one. Continue?'))) return
    setGenerating(true)
    try {
      const res = await authFetch('/api/report-draft', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId: id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      setDraftData(data.draft)
      setLegacyDraft('')
      setProperty(p => ({ ...p, report_status: 'draft' }))
      // Re-fetch history so the freshly-recorded ai_draft version shows up
      // in the section popups right away.
      load()
    } catch (err) {
      await alertDialog('Could not generate draft: ' + err.message)
    } finally {
      setGenerating(false)
    }
  }

  async function saveDraft(silent) {
    if (!draftData) return
    setSaving(true)
    const { error } = await supabase.from('properties').update({ report_draft_markdown: JSON.stringify(draftData) }).eq('id', id)
    setSaving(false)
    if (error) { await alertDialog('Save failed: ' + error.message); return }
    if (!silent) { setSavedMsg('Saved'); setTimeout(() => setSavedMsg(''), 2000) }
  }

  // Called when a section's "Done" button is clicked — persists the full
  // draft (existing save mechanism) and records a report_versions row
  // scoped to that section, then flips back to read-only view.
  async function saveSection(sectionKey) {
    setSavingSection(sectionKey)
    await saveDraft(true)
    try {
      const res = await authFetch('/api/report-version', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId: id, reportData: draftData, source: 'edit', section: sectionKey }),
      })
      const data = await res.json()
      if (res.ok) setVersions(v => [...v, data.version])
      else console.error('Version save failed:', data.error)
    } catch (err) {
      console.error('Version save failed:', err)
    }
    setSavingSection(null)
    setEditingSection(null)
  }

  // Checkpoints the current full report as "final" — the designated B side
  // of an A/B training pair against the original ai_draft, for the Report
  // Quality portal.
  async function markFinal() {
    if (!draftData) return
    setMarkingFinal(true)
    await saveDraft(true)
    try {
      const res = await authFetch('/api/report-version', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId: id, reportData: draftData, source: 'final', section: null }),
      })
      const data = await res.json()
      if (res.ok) {
        setVersions(v => [...v, data.version])
        setFinalMsg('Saved as final ✓')
        setTimeout(() => setFinalMsg(''), 2500)
      } else {
        await alertDialog('Could not save final version: ' + data.error)
      }
    } catch (err) {
      await alertDialog('Could not save final version: ' + err.message)
    }
    setMarkingFinal(false)
  }

  function startEditCustomerEmail() {
    setCustomerEmailDraft(property?.customer_email ?? '')
    setEditingCustomerEmail(true)
  }

  async function saveCustomerEmail() {
    setSavingCustomerEmail(true)
    const trimmed = customerEmailDraft.trim()
    const { error } = await supabase.from('properties').update({ customer_email: trimmed || null }).eq('id', id)
    setSavingCustomerEmail(false)
    if (error) { await alertDialog('Could not update customer email: ' + error.message); return }
    setProperty(p => ({ ...p, customer_email: trimmed || null }))
    setEditingCustomerEmail(false)
  }

  async function publish() {
    if (!draftData) { await alertDialog('Generate a draft before publishing.'); return }
    setPublishing(true)
    try {
      await saveDraft(true)
      const res = await authFetch('/api/report-publish', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId: id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Publish failed')
      setProperty(p => ({ ...p, report_status: 'published' }))
      setShareInfo(prev => ({ token: data.token, accessCode: data.accessCode ?? prev?.accessCode ?? null }))
    } catch (err) {
      await alertDialog('Could not publish: ' + err.message)
    } finally {
      setPublishing(false)
    }
  }

  // "Send to Customer" always opens the review modal first — publishing
  // never emails anyone by itself. This fetches the exact email that would
  // go out (subject, body, recipient) without sending it, so the inspector
  // can check it before confirming.
  async function openSendReview() {
    setLoadingPreview(true)
    try {
      const res = await authFetch('/api/notify-customer-preview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId: id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not build preview')
      setSendPreview(data)
    } catch (err) {
      await alertDialog('Could not prepare send-to-customer preview: ' + err.message)
    } finally {
      setLoadingPreview(false)
    }
  }

  async function confirmSendToCustomer() {
    setNotifyingCustomer(true)
    try {
      const res = await authFetch('/api/notify-customer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId: id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Send failed')
      setProperty(p => ({ ...p, customer_notified_at: new Date().toISOString() }))
      setSendPreview(null)
    } catch (err) {
      await alertDialog('Could not send to customer: ' + err.message)
    } finally {
      setNotifyingCustomer(false)
    }
  }

  // --- draftData editing helpers ---
  function patch(fields) { setDraftData(prev => ({ ...prev, ...fields })) }
  function updateTopPriority(i, value) {
    const next = [...draftData.topPriorities]; next[i] = value; patch({ topPriorities: next })
  }
  function updateZone(zi, field, value) {
    const zones = draftData.zones.map((z, i) => i === zi ? { ...z, [field]: value } : z)
    patch({ zones })
  }
  function removeZone(zi) { patch({ zones: draftData.zones.filter((_, i) => i !== zi) }); setEditingSection(null) }
  function addZone() {
    if (!addZoneKey) return
    patch({ zones: [...draftData.zones, { zone: addZoneKey, findings: [emptyFinding()] }] })
    setAddZoneKey('')
  }
  function updateFinding(zi, fi, field, value) {
    const zones = draftData.zones.map((z, i) => {
      if (i !== zi) return z
      const findings = z.findings.map((f, j) => j === fi ? { ...f, [field]: value } : f)
      return { ...z, findings }
    })
    patch({ zones })
  }
  function addFinding(zi) {
    const zones = draftData.zones.map((z, i) => i === zi ? { ...z, findings: [...z.findings, emptyFinding()] } : z)
    patch({ zones })
  }
  function removeFinding(zi, fi) {
    const zones = draftData.zones.map((z, i) => i === zi ? { ...z, findings: z.findings.filter((_, j) => j !== fi) } : z)
    patch({ zones })
  }
  function updateActionItem(ai, field, value) {
    const actionPlan = draftData.actionPlan.map((a, i) => i === ai ? { ...a, [field]: value } : a)
    patch({ actionPlan })
  }
  function addActionItem() { patch({ actionPlan: [...draftData.actionPlan, emptyActionItem()] }) }
  function removeActionItem(ai) { patch({ actionPlan: draftData.actionPlan.filter((_, i) => i !== ai) }) }
  function updateVegetationItem(vi, field, value) {
    const vegetationConsiderations = draftData.vegetationConsiderations.map((v, i) => i === vi ? { ...v, [field]: value } : v)
    patch({ vegetationConsiderations })
  }
  // No "add" here — unlike action items, a vegetation entry is tied to an
  // actual photographed plant (see property_plants / Guided Entry), so
  // there's nothing meaningful to add without a photo. Remove only, for
  // dropping a bad/duplicate AI read on an existing photo.
  function removeVegetationItem(vi) { patch({ vegetationConsiderations: draftData.vegetationConsiderations.filter((_, i) => i !== vi) }) }
  function updateMeasurementItem(mi, field, value) {
    const mitigationMeasurements = draftData.mitigationMeasurements.map((m, i) => i === mi ? { ...m, [field]: value } : m)
    patch({ mitigationMeasurements })
  }
  // Same reasoning as removeVegetationItem — a measurement entry is tied to
  // an actual photographed dimension (see property_measurements / Guided
  // Entry), so remove only, for dropping a bad AI read on an existing photo.
  function removeMeasurementItem(mi) { patch({ mitigationMeasurements: draftData.mitigationMeasurements.filter((_, i) => i !== mi) }) }
  function updatePhotoCaption(entryId, value) {
    patch({ photoCaptions: { ...(draftData.photoCaptions || {}), [entryId]: value } })
  }
  // Removing a photo never deletes field data — it just adds the entry id
  // to an exclusion list the report rendering (ZonePhotoGrid/zonePhotoItems)
  // filters out, so it's always reversible via the "Hidden from report"
  // strip.
  function excludePhoto(entryId) {
    patch({ excludedEntryIds: [...new Set([...(draftData.excludedEntryIds || []), entryId])] })
  }
  function restorePhoto(entryId) {
    patch({ excludedEntryIds: (draftData.excludedEntryIds || []).filter(eid => eid !== entryId) })
  }
  function reorderZonePhotos(zi, orderedIds) {
    const zones = draftData.zones.map((z, i) => i === zi ? { ...z, photoOrder: orderedIds } : z)
    patch({ zones })
  }
  function updateExtraCaption(zi, extraId, value) {
    const zones = draftData.zones.map((z, i) => i === zi ? { ...z, extraPhotos: (z.extraPhotos || []).map(p => p.id === extraId ? { ...p, caption: value } : p) } : z)
    patch({ zones })
  }
  function removeExtraPhoto(zi, extraId) {
    const zones = draftData.zones.map((z, i) => i === zi ? {
      ...z,
      extraPhotos: (z.extraPhotos || []).filter(p => p.id !== extraId),
      photoOrder: (z.photoOrder || []).filter(pid => pid !== `extra:${extraId}`),
    } : z)
    patch({ zones })
  }
  async function addExtraPhoto(zi, file) {
    setUploadingZone(zi)
    try {
      const compressed = await compressImage(file)
      const url = await uploadReportPhoto(compressed, id)
      const newPhoto = { id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, url, caption: '' }
      const zones = draftData.zones.map((z, i) => i === zi ? { ...z, extraPhotos: [...(z.extraPhotos || []), newPhoto] } : z)
      patch({ zones })
    } catch (err) {
      await alertDialog('Photo upload failed: ' + err.message)
    }
    setUploadingZone(null)
  }
  // Reordering whole zone panels isn't gated behind a section's edit mode —
  // it's a structural move, not content editing — so it saves immediately
  // rather than waiting for a "Done" click. Builds the next state
  // explicitly (rather than relying on draftData from closure) so the
  // persisted write can't race a stale read of state.
  async function reorderZones(fromIndex, toIndex) {
    if (!draftData) return
    const zones = [...draftData.zones]
    const [moved] = zones.splice(fromIndex, 1)
    zones.splice(toIndex, 0, moved)
    const next = { ...draftData, zones }
    setDraftData(next)
    await supabase.from('properties').update({ report_draft_markdown: JSON.stringify(next) }).eq('id', id)
  }
  // Drag-reorder for findings within a zone — only shown in edit mode, so
  // (like other finding edits) it just updates local draft state and relies
  // on the section's normal "Done" save rather than persisting immediately.
  function reorderFindings(zi, fromIndex, toIndex) {
    const zones = draftData.zones.map((z, i) => {
      if (i !== zi) return z
      const findings = [...z.findings]
      const [moved] = findings.splice(fromIndex, 1)
      findings.splice(toIndex, 0, moved)
      return { ...z, findings }
    })
    patch({ zones })
  }
  // Combined "add finding" tile in the photo carousel — uploads the photo
  // as a new extra photo AND appends a blank finding in one go, so the
  // inspector lands on a ready-to-fill finding with its photo already
  // attached. Uses the functional setDraftData form (rather than building
  // off the `draftData` closure) since this runs after an `await`, and a
  // stale closure here would silently clobber whatever changed while the
  // upload was in flight.
  async function addFindingWithPhoto(zi, file) {
    setUploadingZone(zi)
    try {
      const compressed = await compressImage(file)
      const url = await uploadReportPhoto(compressed, id)
      const newPhoto = { id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, url, caption: '' }
      setDraftData(prev => ({
        ...prev,
        zones: prev.zones.map((z, i) => i === zi ? { ...z, extraPhotos: [...(z.extraPhotos || []), newPhoto], findings: [...z.findings, emptyFinding()] } : z),
      }))
    } catch (err) {
      await alertDialog('Photo upload failed: ' + err.message)
    }
    setUploadingZone(null)
  }
  // A photo's compliance status belongs to its field entry (source of
  // truth), not the report JSON — so editing it here writes straight to
  // the entries table, same as any other field-data edit, with local state
  // updated immediately so the pill reflects the change without a reload.
  async function updatePhotoStatus(entryId, status) {
    setEntries(es => es.map(e => e.id === entryId ? { ...e, status } : e))
    const { error } = await supabase.from('entries').update({ status }).eq('id', entryId)
    if (error) console.error('Failed to update photo status:', error)
  }
  function updateExtraStatus(zi, extraId, status) {
    const zones = draftData.zones.map((z, i) => i === zi ? { ...z, extraPhotos: (z.extraPhotos || []).map(p => p.id === extraId ? { ...p, status } : p) } : z)
    patch({ zones })
  }
  // Non-destructive zoom/pan — saved per photo id (entry:<id> or
  // extra:<id>) rather than touching the original uploaded image.
  function adjustPhoto(itemId, adjustment) {
    patch({ photoAdjustments: { ...(draftData.photoAdjustments || {}), [itemId]: adjustment } })
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
  const reportUrl = shareInfo ? (typeof window !== 'undefined' ? `${window.location.origin}/report/${shareInfo.token}` : shareInfo.token) : ''
  const usedZones = new Set((draftData?.zones || []).map(z => z.zone))
  const availableZones = ZONES.filter(z => !usedZones.has(z))

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
          <BackNav href={`/manage/${id}`} label="Back to Property" maxWidth="none" />
          <main style={{ maxWidth: CONTENT_WIDTH, padding: '20px 24px 64px' }}>
        {fetching && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading…</p>}

        {!fetching && (
          <div style={{ marginBottom: 20 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '0.02em', margin: 0, color: 'var(--text)' }}>
              {property?.address ?? 'Loading…'}
            </h1>
            <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)' }}>Review & Publish</span>
          </div>
        )}

        {!fetching && entries.length === 0 && (
          <div style={{ background: 'rgba(217,164,6,.1)', border: '1px solid var(--warn)', borderRadius: 6, padding: '14px 16px', fontSize: 13, color: 'var(--text)' }}>
            No entries logged for this property yet. Go back and log at least one finding before generating a report.
          </div>
        )}

        {!fetching && entries.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14, fontSize: 12.5, color: 'var(--text-muted)' }}>
              <span>Customer email:</span>
              {editingCustomerEmail ? (
                <>
                  <Input
                    type="email"
                    value={customerEmailDraft}
                    onChange={e => setCustomerEmailDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveCustomerEmail(); if (e.key === 'Escape') setEditingCustomerEmail(false) }}
                    placeholder="homeowner@example.com"
                    autoFocus
                    className="h-7 max-w-xs text-[13px]"
                  />
                  <button onClick={saveCustomerEmail} disabled={savingCustomerEmail} title="Save" style={{ ...iconBtnStyle, color: 'var(--ok)' }}>
                    <Check className="size-3.5" />
                  </button>
                  <button onClick={() => setEditingCustomerEmail(false)} title="Cancel" style={iconBtnStyle}>
                    <X className="size-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <strong style={{ color: property?.customer_email ? 'var(--text)' : 'var(--warn)', fontWeight: property?.customer_email ? 600 : 400 }}>
                    {property?.customer_email || 'Not set — reports can\'t be emailed until this is added'}
                  </strong>
                  <button onClick={startEditCustomerEmail} title="Edit customer email" style={iconBtnStyle}>
                    <Pencil className="size-3.5" />
                  </button>
                </>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              <Button onClick={generateDraft} disabled={generating} className="text-[12px] font-bold uppercase tracking-wide h-auto py-2.5 px-4">
                {generating ? 'Generating…' : (draftData || legacyDraft) ? 'Regenerate Draft' : 'Generate Draft Report'}
              </Button>
              {draftData && (
                <>
                  <Button variant="outline" onClick={() => saveDraft(false)} disabled={saving} className="text-[12px] uppercase tracking-wide h-auto py-2.5 px-4 font-mono normal-case">
                    {saving ? 'Saving…' : savedMsg || 'Save Draft'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={markFinal}
                    disabled={markingFinal}
                    title="Checkpoint this version for A/B comparison against the original AI draft"
                    className="text-[12px] uppercase tracking-wide h-auto py-2.5 px-4 font-mono normal-case"
                  >
                    <Flag className="size-3.5 mr-1.5" />
                    {markingFinal ? 'Saving…' : finalMsg || 'Final Report'}
                  </Button>
                  <Button onClick={publish} disabled={publishing} className="text-[12px] font-bold uppercase tracking-wide h-auto py-2.5 px-4 ml-auto bg-[var(--ok)] hover:bg-[var(--ok)]/90">
                    {publishing ? 'Publishing…' : property?.report_status === 'published' ? 'Republish' : 'Publish to Web Report'}
                  </Button>
                </>
              )}
            </div>

            {shareInfo && property?.report_status === 'published' && (
              <div style={{ background: 'rgba(58,125,68,.15)', border: '1px solid var(--ok)', borderRadius: 6, padding: '12px 16px', marginBottom: 16, fontSize: 12.5, color: 'var(--text)' }}>
                <div style={{ marginBottom: 8 }}>
                  <strong style={{ color: 'var(--ok)' }}>✓ Published.</strong> Link:{' '}
                  <a href={reportUrl} target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'monospace', color: 'var(--ok)', textDecoration: 'underline', wordBreak: 'break-all' }}>
                    {reportUrl}
                  </a>
                  <CopyButton text={reportUrl} />
                  {shareInfo.accessCode && (
                    <>
                      {' '}· Access code: <strong>{shareInfo.accessCode}</strong>
                      <CopyButton text={shareInfo.accessCode} />
                    </>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                    {property?.customer_notified_at
                      ? `Sent to customer ${new Date(property.customer_notified_at).toLocaleString()}`
                      : 'Not yet sent to the customer'}
                  </span>
                  <button
                    onClick={openSendReview}
                    disabled={loadingPreview}
                    style={{ fontSize: 11.5, fontFamily: 'monospace', color: 'var(--ok)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    {loadingPreview ? 'Preparing…' : property?.customer_notified_at ? 'Resend to Customer' : 'Send to Customer'}
                  </button>
                </div>
              </div>
            )}

            {sendPreview && (
              <Modal onClose={() => setSendPreview(null)} maxWidth={640} dark>
                <div style={{ background: c.navy, padding: '26px 32px', borderRadius: '14px 14px 0 0' }}>
                  <div style={{ color: c.tan, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Send to Customer</div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: 0 }}>Review before sending</h2>
                  <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.65)', margin: '6px 0 0' }}>
                    This is exactly what the customer will receive — nothing sends until you confirm below.
                  </p>
                </div>

                <div style={{ padding: '24px 32px 28px' }}>
                  <div style={{ border: `1px solid ${c.border}`, borderRadius: 10, overflow: 'hidden', marginBottom: 22 }}>
                    {[
                      { label: 'To', value: sendPreview.to },
                      { label: 'Subject', value: sendPreview.subject },
                      { label: 'Report link', value: sendPreview.reportUrl, href: sendPreview.reportUrl },
                      { label: 'Access code', value: sendPreview.accessCode },
                    ].map((row, i) => (
                      <div
                        key={row.label}
                        style={{ display: 'flex', gap: 14, padding: '10px 16px', background: i % 2 === 0 ? c.surface : c.surfaceAlt, borderTop: i === 0 ? 'none' : `1px solid ${c.border}` }}
                      >
                        <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: c.muted, width: 92, flexShrink: 0, paddingTop: 1 }}>{row.label}</span>
                        {row.href ? (
                          <a href={row.href} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: c.navy, textDecoration: 'underline', wordBreak: 'break-all' }}>{row.value}</a>
                        ) : (
                          <span style={{ fontSize: 13, fontWeight: 600, color: c.text, wordBreak: 'break-word' }}>{row.value}</span>
                        )}
                      </div>
                    ))}
                  </div>

                  <div style={{ fontSize: 11, fontWeight: 700, color: c.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Email preview</div>
                  <div
                    style={{ border: `1px solid ${c.border}`, borderRadius: 10, padding: 16, background: c.surfaceAlt, maxHeight: 420, overflowY: 'auto' }}
                    dangerouslySetInnerHTML={{ __html: sendPreview.html }}
                  />
                  {!sendPreview.reviewCallLink && (
                    <p style={{ fontSize: 11.5, color: c.muted, margin: '8px 2px 0', fontStyle: 'italic' }}>
                      No "Schedule a Review Call" button yet — set <code>CAL_COM_REVIEW_LINK</code> in Vercel once that Cal.com event exists to add one.
                    </p>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
                    <Button variant="outline" onClick={() => setSendPreview(null)} disabled={notifyingCustomer} className="text-[12px] uppercase tracking-wide h-auto py-2.5 px-4">
                      Cancel
                    </Button>
                    <Button onClick={confirmSendToCustomer} disabled={notifyingCustomer} className="text-[12px] font-bold uppercase tracking-wide h-auto py-2.5 px-4 bg-[var(--ok)] hover:bg-[var(--ok)]/90">
                      {notifyingCustomer ? 'Sending…' : 'Confirm & Send'}
                    </Button>
                  </div>
                </div>
              </Modal>
            )}

            {!draftData && !legacyDraft && !generating && (
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No draft yet. Generate one from the current entries, segment notes, and satellite observations.</p>
            )}

            {legacyDraft && !draftData && (
              <div style={{ background: 'rgba(217,164,6,.1)', border: '1px solid var(--warn)', borderRadius: 6, padding: '14px 16px', fontSize: 13, color: 'var(--text)', marginBottom: 16 }}>
                <p style={{ margin: '0 0 10px' }}>
                  This property has a report saved in the old free-text format, from before the editor below existed. It can't be edited here directly — click <strong>Regenerate Draft</strong> above to switch it to the new editable format (this will overwrite it).
                </p>
                <details>
                  <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)' }}>View old draft text</summary>
                  <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11.5, marginTop: 8, color: 'var(--text-muted)' }}>{legacyDraft}</pre>
                </details>
              </div>
            )}

            {draftData && (
              <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 10, padding: '20px 16px 4px', colorScheme: 'light' }}>
                <RiskBadge level={draftData.overallRiskRating} editable={editingSection === 'exec'} onChange={v => patch({ overallRiskRating: v })} />

                <CollapsibleCard
                  title="Executive Summary"
                  isH2
                  defaultOpen
                  headerContent={<SectionTools sectionKey="exec" editingSection={editingSection} savingSection={savingSection} onEdit={setEditingSection} onDone={saveSection} onHistory={setHistoryFor} />}
                >
                  {editingSection === 'exec' ? (
                    <>
                      <textarea
                        value={draftData.summaryNarrative}
                        onChange={e => patch({ summaryNarrative: e.target.value })}
                        placeholder="2-4 sentences: biggest risks, notable strengths, overall assessment"
                        rows={3}
                        className={focusRing}
                        style={{ ...blend, resize: 'vertical', fontSize: 15, color: c.text, lineHeight: 1.75, marginBottom: 16 }}
                      />
                      <div style={{ fontSize: 12, fontWeight: 700, color: c.navy, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Top Priorities</div>
                      <div style={{ marginBottom: 16 }}>
                        {draftData.topPriorities.map((p, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 15, color: c.text, fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
                            <input
                              value={p}
                              onChange={e => updateTopPriority(i, e.target.value)}
                              placeholder={`Priority ${i + 1}`}
                              className={focusRing}
                              style={{ ...blend, fontSize: 15, color: c.text, lineHeight: 1.7 }}
                            />
                          </div>
                        ))}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: c.navy, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>WPH Designation Snapshot</div>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'baseline' }}>
                        <strong style={{ color: c.navy, fontSize: 15, flexShrink: 0 }}>Base (Essential):</strong>
                        <textarea value={draftData.wphBase} onChange={e => patch({ wphBase: e.target.value })} rows={1} className={focusRing} style={{ ...blend, flex: 1, resize: 'vertical', fontSize: 15, color: c.text, lineHeight: 1.7 }} />
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                        <strong style={{ color: c.navy, fontSize: 15, flexShrink: 0 }}>Plus (Enhanced):</strong>
                        <textarea value={draftData.wphPlus} onChange={e => patch({ wphPlus: e.target.value })} rows={1} className={focusRing} style={{ ...blend, flex: 1, resize: 'vertical', fontSize: 15, color: c.text, lineHeight: 1.7 }} />
                      </div>
                    </>
                  ) : (
                    <>
                      {draftData.summaryNarrative && <p style={{ margin: '0 0 16px', color: c.text, lineHeight: 1.75, fontSize: 15 }}>{draftData.summaryNarrative}</p>}
                      {draftData.topPriorities?.filter(Boolean).length > 0 && (
                        <>
                          <div style={{ fontSize: 12, fontWeight: 700, color: c.navy, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Top Priorities</div>
                          <ol style={{ margin: '0 0 16px 20px', padding: 0 }}>
                            {draftData.topPriorities.filter(Boolean).map((p, i) => <li key={i} style={{ marginBottom: 8, color: c.text, lineHeight: 1.7, fontSize: 15 }}>{p}</li>)}
                          </ol>
                        </>
                      )}
                      {(draftData.wphBase || draftData.wphPlus) && (
                        <>
                          <div style={{ fontSize: 12, fontWeight: 700, color: c.navy, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>WPH Designation Snapshot</div>
                          <ul style={{ margin: 0, padding: '0 0 0 20px' }}>
                            {draftData.wphBase && <li style={{ marginBottom: 6, color: c.text, lineHeight: 1.7, fontSize: 15 }}><strong style={{ color: c.navy }}>Base (Essential):</strong> {draftData.wphBase}</li>}
                            {draftData.wphPlus && <li style={{ color: c.text, lineHeight: 1.7, fontSize: 15 }}><strong style={{ color: c.navy }}>Plus (Enhanced):</strong> {draftData.wphPlus}</li>}
                          </ul>
                        </>
                      )}
                    </>
                  )}
                </CollapsibleCard>

                <CollapsibleCard
                  title="Site & Environmental Overview"
                  isH2
                  defaultOpen
                  headerContent={<SectionTools sectionKey="overview" editingSection={editingSection} savingSection={savingSection} onEdit={setEditingSection} onDone={saveSection} onHistory={setHistoryFor} />}
                >
                  {editingSection === 'overview' ? (
                    <textarea
                      value={draftData.siteOverview}
                      onChange={e => patch({ siteOverview: e.target.value })}
                      placeholder="3-5 sentences: location context, FHSZ status, surrounding fuel load, primary ignition pathways"
                      rows={4}
                      className={focusRing}
                      style={{ ...blend, resize: 'vertical', fontSize: 15, color: c.text, lineHeight: 1.75 }}
                    />
                  ) : (
                    <p style={{ margin: 0, color: c.text, lineHeight: 1.75, fontSize: 15 }}>{draftData.siteOverview}</p>
                  )}
                </CollapsibleCard>

                {/* Each zone panel is itself the drop target (rather than a
                    thin gap between panels) — whole-item hit-testing is far
                    more forgiving of imprecise dragging than a narrow strip
                    between boxes. Which half (top/bottom) the cursor is
                    over decides before/after placement, shown via an edge
                    highlight on the panel being hovered. */}
                {draftData.zones.map((zone, zi) => {
                  const zKey = zoneSectionKey(zone.zone)
                  const isEditingZone = editingSection === zKey

                  // "zone:<index>" — ignores anything that isn't a zone hit
                  // (e.g. a finding or photo tile the pointer passed over).
                  function readZoneTarget(hit) {
                    if (!hit) return null
                    const [kind, index] = hit.id.split(':')
                    return kind === 'zone' ? { index: Number(index), side: hit.side } : null
                  }
                  // `sourceIndex` passed in directly (this zone's own `zi`)
                  // rather than read from `dragZoneIndex` state — see the
                  // long comment on photos' dropOnTarget for why: state
                  // read inside this function would be stale (captured
                  // before the pointerdown-triggered setDragZoneIndex
                  // committed).
                  function dropOnZoneTarget(sourceIndex, target) {
                    if (sourceIndex == null || !target) { setDragZoneIndex(null); setDragOverZoneTarget(null); return }
                    const insertAt = target.side === 'before' ? target.index : target.index + 1
                    const finalIndex = sourceIndex < insertAt ? insertAt - 1 : insertAt
                    if (finalIndex !== sourceIndex) reorderZones(sourceIndex, finalIndex)
                    setDragZoneIndex(null)
                    setDragOverZoneTarget(null)
                  }

                  const isZoneOverTarget = dragZoneIndex != null && dragZoneIndex !== zi && dragOverZoneTarget?.index === zi

                  const zonePanel = (
                    <div
                      key={`zone-${zi}`}
                      className="group"
                      data-drop-target={`zone:${zi}`}
                      data-drop-axis="y"
                      style={{ opacity: dragZoneIndex === zi ? 0.4 : 1, ...(isZoneOverTarget ? dropIndicatorStyle(dragOverZoneTarget.side, 'y') : {}) }}
                    >
                      <CollapsibleCard
                        isH2
                        defaultOpen
                        title={zone.zone}
                        headerContent={
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, width: '100%' }}>
                            {/* Panel reorder — moves the whole zone section, not
                                gated by edit mode since it's a structural move
                                rather than content editing; saves immediately. */}
                            <DragHandle
                              dark
                              onDragStart={() => setDragZoneIndex(zi)}
                              onDragMove={(x, y) => { const t = readZoneTarget(dropTargetAt(x, y)); if (t) setDragOverZoneTarget(t) }}
                              onDragEnd={(x, y) => dropOnZoneTarget(zi, readZoneTarget(dropTargetAt(x, y)))}
                            />
                            <div style={{ flex: 1 }} />
                            <SectionTools sectionKey={zKey} editingSection={editingSection} savingSection={savingSection} onEdit={setEditingSection} onDone={saveSection} onHistory={setHistoryFor} />
                          </div>
                        }
                      >
                        {isEditingZone ? (
                          <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: c.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Zone:</span>
                              <select
                                value={zone.zone}
                                onChange={e => updateZone(zi, 'zone', e.target.value)}
                                style={{ background: c.surfaceAlt, color: c.navy, border: `1px solid ${c.border}`, borderRadius: 6, padding: '6px 10px', fontWeight: 700, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}
                              >
                                {!ZONES.includes(zone.zone) && <option value={zone.zone}>{zone.zone}</option>}
                                {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
                              </select>
                              <button onClick={() => removeZone(zi)} title="Remove this zone" style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: `1px solid ${c.warn}`, color: c.warn, cursor: 'pointer', fontSize: 11.5, fontWeight: 600, padding: '5px 10px', borderRadius: 5 }}>
                                <Trash2 size={13} /> Remove Zone
                              </button>
                            </div>
                            {/* Same whole-item drop-target pattern for
                                findings within this zone.
                                "finding:<zi>:<index>" — scoped to this zone
                                so a drag can't accidentally land in another
                                zone's list. */}
                            {(() => {
                              function readFindingTarget(hit) {
                                if (!hit) return null
                                const [kind, hitZi, index] = hit.id.split(':')
                                if (kind !== 'finding' || Number(hitZi) !== zi) return null
                                return { index: Number(index), side: hit.side }
                              }
                              // `sourceFi` passed in directly (this row's own
                              // `fi`) rather than read from `dragFinding`
                              // state — see the comment on photos'
                              // dropOnTarget for why: state read here would
                              // be stale.
                              function dropOnFindingTarget(sourceFi, target) {
                                if (sourceFi == null || !target) { setDragFinding(null); setDragOverFindingTarget(null); return }
                                const insertAt = target.side === 'before' ? target.index : target.index + 1
                                const finalIndex = sourceFi < insertAt ? insertAt - 1 : insertAt
                                if (finalIndex !== sourceFi) reorderFindings(zi, sourceFi, finalIndex)
                                setDragFinding(null)
                                setDragOverFindingTarget(null)
                              }
                              return zone.findings.map((f, fi) => {
                                const isFindingOverTarget = dragFinding?.zi === zi && dragFinding.fi !== fi && dragOverFindingTarget?.zi === zi && dragOverFindingTarget?.index === fi
                                return (
                                  <div
                                    key={`finding-${zi}-${fi}`}
                                    className="group"
                                    data-drop-target={`finding:${zi}:${fi}`}
                                    data-drop-axis="y"
                                    style={{ display: 'flex', alignItems: 'flex-start', gap: 4, opacity: dragFinding?.zi === zi && dragFinding.fi === fi ? 0.4 : 1, ...(isFindingOverTarget ? dropIndicatorStyle(dragOverFindingTarget.side, 'y') : {}) }}
                                  >
                                    <DragHandle
                                      onDragStart={() => setDragFinding({ zi, fi })}
                                      onDragMove={(x, y) => { const t = readFindingTarget(dropTargetAt(x, y)); if (t) setDragOverFindingTarget({ zi, ...t }) }}
                                      onDragEnd={(x, y) => dropOnFindingTarget(fi, readFindingTarget(dropTargetAt(x, y)))}
                                      style={{ marginTop: 16 }}
                                    />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <EditableFinding
                                        f={f}
                                        onChange={(field, val) => updateFinding(zi, fi, field, val)}
                                        onRemove={() => removeFinding(zi, fi)}
                                      />
                                    </div>
                                  </div>
                                )
                              })
                            })()}

                            <EditableZonePhotos
                              zone={zone}
                              zi={zi}
                              entries={entries}
                              reportData={draftData}
                              uploading={uploadingZone === zi}
                              onCaptionChange={updatePhotoCaption}
                              onExclude={excludePhoto}
                              onRestore={restorePhoto}
                              onReorder={reorderZonePhotos}
                              onExtraCaptionChange={updateExtraCaption}
                              onRemoveExtra={removeExtraPhoto}
                              onStatusChange={updatePhotoStatus}
                              onExtraStatusChange={updateExtraStatus}
                              onAdjust={adjustPhoto}
                              onAddFindingWithPhoto={addFindingWithPhoto}
                            />
                          </>
                        ) : (
                          <>
                            {zone.findings.map((f, fi) => <FindingView key={fi} f={f} />)}
                            <ZonePhotoGrid zone={zone} entries={entries} reportData={draftData} />
                          </>
                        )}
                      </CollapsibleCard>
                    </div>
                  )

                  return zonePanel
                })}

                {availableZones.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
                    <select
                      value={addZoneKey}
                      onChange={e => setAddZoneKey(e.target.value)}
                      style={{ flex: 1, background: c.surface, border: `1px solid ${c.border}`, borderRadius: 6, color: c.text, fontSize: 13, padding: '8px 10px', fontFamily: 'inherit' }}
                    >
                      <option value="">Add a zone…</option>
                      {availableZones.map(z => <option key={z} value={z}>{z}</option>)}
                    </select>
                    <Button variant="outline" onClick={addZone} disabled={!addZoneKey} className="text-[12px] uppercase tracking-wide h-auto py-2 px-3 font-mono normal-case shrink-0">
                      Add Zone
                    </Button>
                  </div>
                )}

                {draftData.vegetationConsiderations?.length > 0 && (
                  <CollapsibleCard
                    title="Vegetation Considerations"
                    isH2
                    defaultOpen
                    headerContent={<SectionTools sectionKey="vegetation" editingSection={editingSection} savingSection={savingSection} onEdit={setEditingSection} onDone={saveSection} onHistory={setHistoryFor} />}
                  >
                    {editingSection === 'vegetation' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {draftData.vegetationIntro !== undefined && (
                          <div>
                            <label style={{ display: 'block', fontSize: 11, color: c.muted, marginBottom: 4 }}>Intro</label>
                            <textarea
                              value={draftData.vegetationIntro || ''}
                              onChange={e => patch({ vegetationIntro: e.target.value })}
                              rows={2}
                              className={focusRing}
                              style={{ ...blend, background: c.surfaceAlt, borderRadius: 6, padding: '8px 10px', fontSize: 13.5, color: c.text, resize: 'vertical' }}
                            />
                          </div>
                        )}
                        {draftData.vegetationConsiderations.map((v, vi) => (
                          <div key={vi} style={{ border: `1px solid ${c.border}`, borderRadius: 8, padding: 12, display: 'flex', gap: 12 }}>
                            {v.photoUrl && <img src={v.photoUrl} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />}
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                              <div style={{ fontSize: 10.5, color: c.muted }}>{v.zone}</div>
                              <input
                                value={v.plantId}
                                onChange={e => updateVegetationItem(vi, 'plantId', e.target.value)}
                                placeholder="Plant ID"
                                className={focusRing}
                                style={{ ...blend, background: c.surfaceAlt, borderRadius: 4, padding: '6px 8px', fontSize: 14, fontWeight: 700, color: c.navy }}
                              />
                              <textarea
                                value={v.assessment}
                                onChange={e => updateVegetationItem(vi, 'assessment', e.target.value)}
                                placeholder="Assessment — native status, fire risk"
                                rows={2}
                                className={focusRing}
                                style={{ ...blend, background: c.surfaceAlt, borderRadius: 4, padding: '6px 8px', fontSize: 13, color: c.text, resize: 'vertical' }}
                              />
                              <textarea
                                value={v.spacingGuidance}
                                onChange={e => updateVegetationItem(vi, 'spacingGuidance', e.target.value)}
                                placeholder="Spacing guidance"
                                rows={2}
                                className={focusRing}
                                style={{ ...blend, background: c.surfaceAlt, borderRadius: 4, padding: '6px 8px', fontSize: 13, color: c.text, resize: 'vertical' }}
                              />
                            </div>
                            <button onClick={() => removeVegetationItem(vi)} title="Remove" style={{ background: 'none', border: 'none', color: c.warn, cursor: 'pointer', display: 'flex', alignSelf: 'flex-start' }}>
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <VegetationConsiderationsSection intro={draftData.vegetationIntro} items={draftData.vegetationConsiderations} />
                    )}
                  </CollapsibleCard>
                )}

                {draftData.mitigationMeasurements?.length > 0 && (
                  <CollapsibleCard
                    title="Mitigation Measurements"
                    isH2
                    defaultOpen
                    headerContent={<SectionTools sectionKey="measurements" editingSection={editingSection} savingSection={savingSection} onEdit={setEditingSection} onDone={saveSection} onHistory={setHistoryFor} />}
                  >
                    {editingSection === 'measurements' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {draftData.mitigationMeasurements.map((m, mi) => (
                          <div key={mi} style={{ border: `1px solid ${c.border}`, borderRadius: 8, padding: 12, display: 'flex', gap: 12 }}>
                            {m.photoUrl && <img src={m.photoUrl} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />}
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                              <div style={{ fontSize: 10.5, color: c.muted }}>{m.zone}</div>
                              <input
                                value={m.label}
                                onChange={e => updateMeasurementItem(mi, 'label', e.target.value)}
                                placeholder="What's being measured"
                                className={focusRing}
                                style={{ ...blend, background: c.surfaceAlt, borderRadius: 4, padding: '6px 8px', fontSize: 14, fontWeight: 700, color: c.navy }}
                              />
                              <select
                                value={m.category || ''}
                                onChange={e => updateMeasurementItem(mi, 'category', e.target.value)}
                                className={focusRing}
                                style={{ ...blend, background: c.surfaceAlt, borderRadius: 4, padding: '6px 8px', fontSize: 12.5, color: m.category ? c.text : c.warn }}
                              >
                                <option value="">Uncategorized — won't be priced on the Estimate tab</option>
                                {rateCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                              </select>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <input
                                  type="number"
                                  value={m.estimatedValue ?? ''}
                                  onChange={e => updateMeasurementItem(mi, 'estimatedValue', e.target.value === '' ? null : Number(e.target.value))}
                                  placeholder="Value"
                                  className={focusRing}
                                  style={{ ...blend, background: c.surfaceAlt, borderRadius: 4, padding: '6px 8px', fontSize: 13, color: c.text, width: 90 }}
                                />
                                <input
                                  value={m.unit}
                                  onChange={e => updateMeasurementItem(mi, 'unit', e.target.value)}
                                  placeholder="Unit"
                                  className={focusRing}
                                  style={{ ...blend, background: c.surfaceAlt, borderRadius: 4, padding: '6px 8px', fontSize: 13, color: c.text, width: 80 }}
                                />
                                <select
                                  value={m.confidence}
                                  onChange={e => updateMeasurementItem(mi, 'confidence', e.target.value)}
                                  className={focusRing}
                                  style={{ ...blend, background: c.surfaceAlt, borderRadius: 4, padding: '6px 8px', fontSize: 13, color: c.text }}
                                >
                                  {['High', 'Medium', 'Low', 'Unable to estimate'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                              </div>
                              <textarea
                                value={m.notes}
                                onChange={e => updateMeasurementItem(mi, 'notes', e.target.value)}
                                placeholder="Notes — reasoning, confidence caveats"
                                rows={2}
                                className={focusRing}
                                style={{ ...blend, background: c.surfaceAlt, borderRadius: 4, padding: '6px 8px', fontSize: 13, color: c.text, resize: 'vertical' }}
                              />
                            </div>
                            <button onClick={() => removeMeasurementItem(mi)} title="Remove" style={{ background: 'none', border: 'none', color: c.warn, cursor: 'pointer', display: 'flex', alignSelf: 'flex-start' }}>
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <MitigationMeasurementsSection items={draftData.mitigationMeasurements} />
                    )}
                  </CollapsibleCard>
                )}

                <CollapsibleCard
                  title="Prioritized Action Plan"
                  isH2
                  defaultOpen
                  headerContent={<SectionTools sectionKey="action" editingSection={editingSection} savingSection={savingSection} onEdit={setEditingSection} onDone={saveSection} onHistory={setHistoryFor} />}
                >
                  {editingSection === 'action' ? (
                    <>
                      <div style={{ overflowX: 'auto', marginBottom: 12 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                          <thead>
                            <tr>
                              {['#', 'Action', 'Zone', 'Priority', ''].map(h => (
                                <th key={h} style={{ background: c.navy, color: '#fff', padding: '10px 14px', textAlign: 'left', fontWeight: 700, fontSize: 12, letterSpacing: '0.04em' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {draftData.actionPlan.map((a, ai) => (
                              <tr key={ai} style={{ background: ai % 2 === 0 ? c.surface : c.surfaceAlt }}>
                                <td style={{ padding: '10px 14px', borderBottom: `1px solid ${c.border}`, color: c.muted }}>{ai + 1}</td>
                                <td style={{ padding: '10px 14px', borderBottom: `1px solid ${c.border}` }}>
                                  <input value={a.action} onChange={e => updateActionItem(ai, 'action', e.target.value)} placeholder="Action" className={focusRing} style={{ ...blend, fontSize: 14, color: c.text }} />
                                </td>
                                <td style={{ padding: '10px 14px', borderBottom: `1px solid ${c.border}` }}>
                                  <input value={a.zone} onChange={e => updateActionItem(ai, 'zone', e.target.value)} placeholder="Zone" className={focusRing} style={{ ...blend, fontSize: 14, color: c.text }} />
                                </td>
                                <td style={{ padding: '10px 14px', borderBottom: `1px solid ${c.border}` }}>
                                  <select
                                    value={a.priority}
                                    onChange={e => updateActionItem(ai, 'priority', e.target.value)}
                                    style={{ background: 'transparent', border: 'none', outline: 'none', color: priorityColor(a.priority), fontWeight: 700, fontSize: 12.5, fontFamily: 'inherit', cursor: 'pointer' }}
                                  >
                                    {ACTION_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                                  </select>
                                </td>
                                <td style={{ padding: '10px 14px', borderBottom: `1px solid ${c.border}` }}>
                                  <button onClick={() => removeActionItem(ai)} title="Remove" style={{ background: 'none', border: 'none', color: c.warn, cursor: 'pointer', display: 'flex' }}>
                                    <X size={14} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <button onClick={addActionItem} style={addFindingBtnStyle}>
                        <Plus size={13} /> Add Action
                      </button>
                    </>
                  ) : (
                    <ActionPlanTable items={draftData.actionPlan} />
                  )}
                </CollapsibleCard>
              </div>
            )}
          </div>
        )}
          </main>
        </div>
      </div>

      {historyFor && (
        <SectionHistoryPopup sectionKey={historyFor} versions={versions} onClose={() => setHistoryFor(null)} />
      )}
    </div>
  )
}
