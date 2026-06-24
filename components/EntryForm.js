'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ZONES, CATEGORIES, STATUSES } from '@/lib/criteria'
import InfoModal   from './InfoModal'
import PhotoUpload from './PhotoUpload'

const STATUS_STYLES = {
  'Compliant':          'border-green-700  text-green-400  bg-green-950/40',
  'Non-Compliant':      'border-red-700    text-red-400    bg-red-950/40',
  'Needs Verification': 'border-blue-700   text-blue-400   bg-blue-950/40',
  'Not Applicable':     'border-stone-600  text-stone-300  bg-stone-800/40',
}

function Field({ label, children }) {
  return (
    <div className="mb-4">
      <label className="block text-[10px] font-mono text-stone-500 tracking-widest uppercase mb-1.5">
        {label}
      </label>
      {children}
    </div>
  )
}

const inputCls = 'w-full bg-stone-900 border border-stone-700 rounded px-3 py-2.5 text-sm text-stone-100 placeholder-stone-600 focus:outline-none focus:border-orange-600'

export default function EntryForm({ propertyId, onSaved }) {
  const [zone,       setZone]       = useState(ZONES[0])
  const [category,   setCategory]   = useState(CATEGORIES[0])
  const [status,     setStatus]     = useState(null)
  const [distance,   setDistance]   = useState('')
  const [note,       setNote]       = useState('')
  const [detail,     setDetail]     = useState('')
  const [photoUrl,   setPhotoUrl]   = useState(null)
  const [showDetail, setShowDetail] = useState(false)
  const [infoOpen,   setInfoOpen]   = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [photoKey,   setPhotoKey]   = useState(0) // bump to reset PhotoUpload

  async function save() {
    if (!note.trim())  { alert('Add a finding before saving.'); return }
    if (!status)       { alert('Select a status.'); return }
    setSaving(true)
    const { error } = await supabase.from('entries').insert({
      property_id: propertyId,
      zone, category, status,
      distance: distance.trim() || null,
      note:     note.trim(),
      detail:   detail.trim() || null,
      photo_url: photoUrl || null,
    })
    setSaving(false)
    if (error) { alert('Save failed: ' + error.message); return }

    // Reset form
    setStatus(null)
    setDistance('')
    setNote('')
    setDetail('')
    setPhotoUrl(null)
    setPhotoKey(k => k + 1)
    setShowDetail(false)
    onSaved()
  }

  return (
    <>
      <InfoModal
        category={infoOpen ? category : null}
        onClose={() => setInfoOpen(false)}
      />

      <div className="bg-stone-900 border border-stone-800 rounded-lg p-4 mb-6">

        {/* Zone + Category — stack on mobile, side-by-side on sm+ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <Field label="Zone">
            <select className={inputCls} value={zone} onChange={e => setZone(e.target.value)}>
              {ZONES.map(z => <option key={z}>{z}</option>)}
            </select>
          </Field>
          <Field label="Criteria / Category">
            <select className={inputCls} value={category} onChange={e => setCategory(e.target.value)}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
            <button
              onClick={() => setInfoOpen(true)}
              className="mt-1 text-[11px] font-mono text-orange-500 tracking-wide"
            >
              ⓘ Read about this category
            </button>
          </Field>
        </div>

        {/* Status */}
        <Field label="Status">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {STATUSES.map(s => (
              <button
                key={s.value}
                onClick={() => setStatus(s.value)}
                className={`py-2 text-[11px] font-mono uppercase tracking-wide border rounded transition-colors
                  ${status === s.value ? STATUS_STYLES[s.value] : 'border-stone-700 text-stone-500'}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </Field>

        {/* Distance */}
        <Field label="Distance / Measurement">
          <input
            className={inputCls}
            placeholder="e.g. 8 ft from wall"
            value={distance}
            onChange={e => setDistance(e.target.value)}
          />
        </Field>

        {/* Finding */}
        <Field label="Finding">
          <input
            className={inputCls}
            placeholder="Short description of what you observed"
            value={note}
            onChange={e => setNote(e.target.value)}
          />
        </Field>

        {/* Details (optional) */}
        <div className="mb-4">
          <button
            onClick={() => setShowDetail(d => !d)}
            className="text-[11px] font-mono text-orange-500 tracking-wide mb-2"
          >
            {showDetail ? '– Hide details' : '+ Add longer details'}
          </button>
          {showDetail && (
            <textarea
              className={`${inputCls} min-h-[80px] resize-y`}
              placeholder="Optional — additional context, conditions, recommendations…"
              value={detail}
              onChange={e => setDetail(e.target.value)}
            />
          )}
        </div>

        {/* Photo */}
        <Field label="Photo">
          <PhotoUpload
            key={photoKey}
            propertyId={propertyId}
            onPhotoUrl={setPhotoUrl}
          />
        </Field>

        <button
          onClick={save}
          disabled={saving}
          className="w-full bg-orange-700 text-stone-950 font-bold text-sm py-3 rounded uppercase tracking-wide disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Entry'}
        </button>
      </div>
    </>
  )
}
