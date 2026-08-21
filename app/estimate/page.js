'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { parseReportData } from '@/lib/reportSchema'
import { Pencil, Trash2, Plus, ChevronDown, ChevronRight, X, Check } from 'lucide-react'
import { useConfirmDialog } from '@/components/ConfirmDialogProvider'

// The "table with draft values, used to estimate price" the user asked
// for: mitigation_price_rates (migrations 022 + 023) holds a cost-per-unit
// range per mitigation category, broken into Materials and Labor (Total is
// a generated column — always their sum, never stored out of sync) —
// seeded with placeholder numbers meant to be tuned here, not sourced
// pricing. Property estimates below are computed entirely client-side from
// that table plus each property's already-saved report draft
// (reportData.mitigationMeasurements, see report-draft/route.js and
// property_measurements/GuidedEntry.js for how those dimensions get
// captured and AI-estimated in the first place).

const UNITS = ['ft', 'sq ft']

function formatMoney(n) {
  return `$${Math.round(n).toLocaleString('en-US')}`
}

function emptyRateDraft() { return { category: '', unit: 'ft', material_rate_low: '', material_rate_high: '', labor_rate_low: '', labor_rate_high: '', notes: '' } }

function totalOf(low, high) { return { low: Number(low) || 0, high: Number(high) || 0 } }

function RateRow({ rate, onSave, onDelete }) {
  const { alertDialog } = useConfirmDialog()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(rate)
  const [saving, setSaving] = useState(false)

  function startEdit() { setDraft(rate); setEditing(true) }

  async function save() {
    if (!draft.category.trim()) { await alertDialog('Category is required.'); return }
    const vals = [draft.material_rate_low, draft.material_rate_high, draft.labor_rate_low, draft.labor_rate_high].map(Number)
    if (vals.some(v => !Number.isFinite(v))) { await alertDialog('Material/Labor rates must be numbers.'); return }
    setSaving(true)
    await onSave(rate.id, {
      category: draft.category.trim(), unit: draft.unit,
      material_rate_low: vals[0], material_rate_high: vals[1],
      labor_rate_low: vals[2], labor_rate_high: vals[3],
      notes: draft.notes || null,
    })
    setSaving(false)
    setEditing(false)
  }

  const cellStyle = { padding: '8px 10px', fontSize: 12.5, color: 'var(--text)', verticalAlign: 'top' }
  const inputStyle = { fontSize: 12.5, padding: '5px 7px', border: '1px solid var(--line)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text)', width: '100%', fontFamily: 'inherit', boxSizing: 'border-box' }

  if (editing) {
    const total = totalOf(Number(draft.material_rate_low) + Number(draft.labor_rate_low), Number(draft.material_rate_high) + Number(draft.labor_rate_high))
    return (
      <tr style={{ background: 'var(--surface-2)' }}>
        <td style={cellStyle}><input style={inputStyle} value={draft.category} onChange={e => setDraft(d => ({ ...d, category: e.target.value }))} /></td>
        <td style={cellStyle}>
          <select style={inputStyle} value={draft.unit} onChange={e => setDraft(d => ({ ...d, unit: e.target.value }))}>
            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </td>
        <td style={cellStyle}><input type="number" step="0.01" style={{ ...inputStyle, width: 70 }} value={draft.material_rate_low} onChange={e => setDraft(d => ({ ...d, material_rate_low: e.target.value }))} /></td>
        <td style={cellStyle}><input type="number" step="0.01" style={{ ...inputStyle, width: 70 }} value={draft.material_rate_high} onChange={e => setDraft(d => ({ ...d, material_rate_high: e.target.value }))} /></td>
        <td style={cellStyle}><input type="number" step="0.01" style={{ ...inputStyle, width: 70 }} value={draft.labor_rate_low} onChange={e => setDraft(d => ({ ...d, labor_rate_low: e.target.value }))} /></td>
        <td style={cellStyle}><input type="number" step="0.01" style={{ ...inputStyle, width: 70 }} value={draft.labor_rate_high} onChange={e => setDraft(d => ({ ...d, labor_rate_high: e.target.value }))} /></td>
        <td style={{ ...cellStyle, color: 'var(--text-muted)', fontStyle: 'italic', whiteSpace: 'nowrap' }}>${total.low.toFixed(2)}–${total.high.toFixed(2)}</td>
        <td style={cellStyle}><input style={inputStyle} value={draft.notes || ''} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} /></td>
        <td style={{ ...cellStyle, whiteSpace: 'nowrap' }}>
          <button onClick={save} disabled={saving} title="Save" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ok)', padding: 4 }}><Check className="size-3.5" /></button>
          <button onClick={() => setEditing(false)} title="Cancel" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X className="size-3.5" /></button>
        </td>
      </tr>
    )
  }

  return (
    <tr>
      <td style={{ ...cellStyle, fontWeight: 600 }}>{rate.category}</td>
      <td style={cellStyle}>{rate.unit}</td>
      <td style={cellStyle}>${Number(rate.material_rate_low).toFixed(2)}</td>
      <td style={cellStyle}>${Number(rate.material_rate_high).toFixed(2)}</td>
      <td style={cellStyle}>${Number(rate.labor_rate_low).toFixed(2)}</td>
      <td style={cellStyle}>${Number(rate.labor_rate_high).toFixed(2)}</td>
      <td style={{ ...cellStyle, fontWeight: 700 }}>${Number(rate.total_rate_low).toFixed(2)}–${Number(rate.total_rate_high).toFixed(2)}</td>
      <td style={{ ...cellStyle, color: 'var(--text-muted)' }}>{rate.notes}</td>
      <td style={{ ...cellStyle, whiteSpace: 'nowrap' }}>
        <button onClick={startEdit} title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><Pencil className="size-3.5" /></button>
        <button onClick={() => onDelete(rate.id)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warn)', padding: 4 }}><Trash2 className="size-3.5" /></button>
      </td>
    </tr>
  )
}

function RatesTable({ rates, onAdd, onSave, onDelete }) {
  const { alertDialog } = useConfirmDialog()
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState(emptyRateDraft())
  const [saving, setSaving] = useState(false)

  async function submitAdd() {
    if (!draft.category.trim()) { await alertDialog('Category is required.'); return }
    const vals = [draft.material_rate_low, draft.material_rate_high, draft.labor_rate_low, draft.labor_rate_high].map(Number)
    if (vals.some(v => !Number.isFinite(v))) { await alertDialog('Material/Labor rates must be numbers.'); return }
    setSaving(true)
    await onAdd({
      category: draft.category.trim(), unit: draft.unit,
      material_rate_low: vals[0], material_rate_high: vals[1],
      labor_rate_low: vals[2], labor_rate_high: vals[3],
      notes: draft.notes || null,
    })
    setSaving(false)
    setDraft(emptyRateDraft())
    setAdding(false)
  }

  const inputStyle = { fontSize: 12.5, padding: '6px 8px', border: '1px solid var(--line)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit' }

  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: '0 0 6px' }}>Mitigation Cost Rates</h2>
      <p style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.6, margin: '0 0 14px', maxWidth: 640 }}>
        Draft placeholder rates — not sourced pricing. Materials and Labor are entered separately; Total is always their sum, computed automatically. Edit these to match your actual costs; every property estimate below recalculates from whatever's saved here.
      </p>
      <div style={{ overflowX: 'auto', border: '1px solid var(--line)', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)', textAlign: 'left' }}>
              {['Category', 'Unit', 'Material Low', 'Material High', 'Labor Low', 'Labor High', 'Total', 'Notes', ''].map(h => (
                <th key={h} style={{ padding: '8px 10px', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rates.map(r => <RateRow key={r.id} rate={r} onSave={onSave} onDelete={onDelete} />)}
            {rates.length === 0 && (
              <tr><td colSpan={9} style={{ padding: 14, fontSize: 12.5, color: 'var(--text-muted)' }}>No rate categories yet — add one below.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {adding ? (
        <div style={{ marginTop: 10, border: '1px solid var(--line)', borderRadius: 8, padding: 12, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start', maxWidth: 820 }}>
          <input style={{ ...inputStyle, flex: '1 1 220px' }} placeholder="Category, e.g. Noncombustible Fence Replacement" value={draft.category} onChange={e => setDraft(d => ({ ...d, category: e.target.value }))} />
          <select style={inputStyle} value={draft.unit} onChange={e => setDraft(d => ({ ...d, unit: e.target.value }))}>
            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
          <input type="number" step="0.01" style={{ ...inputStyle, width: 90 }} placeholder="Material low" value={draft.material_rate_low} onChange={e => setDraft(d => ({ ...d, material_rate_low: e.target.value }))} />
          <input type="number" step="0.01" style={{ ...inputStyle, width: 90 }} placeholder="Material high" value={draft.material_rate_high} onChange={e => setDraft(d => ({ ...d, material_rate_high: e.target.value }))} />
          <input type="number" step="0.01" style={{ ...inputStyle, width: 90 }} placeholder="Labor low" value={draft.labor_rate_low} onChange={e => setDraft(d => ({ ...d, labor_rate_low: e.target.value }))} />
          <input type="number" step="0.01" style={{ ...inputStyle, width: 90 }} placeholder="Labor high" value={draft.labor_rate_high} onChange={e => setDraft(d => ({ ...d, labor_rate_high: e.target.value }))} />
          <input style={{ ...inputStyle, flex: '1 1 200px' }} placeholder="Notes (optional)" value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} />
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={submitAdd} disabled={saving} style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#fff', background: 'var(--accent)', border: 'none', borderRadius: 4, padding: '7px 12px', cursor: 'pointer' }}>{saving ? 'Saving…' : 'Add'}</button>
            <button onClick={() => { setAdding(false); setDraft(emptyRateDraft()) }} style={{ fontSize: 11.5, color: 'var(--text-muted)', background: 'none', border: '1px solid var(--line)', borderRadius: 4, padding: '7px 12px', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--accent)', background: 'none', border: '1px solid var(--accent)', borderRadius: 6, padding: '8px 12px', cursor: 'pointer' }}>
          <Plus className="size-3.5" /> New Category
        </button>
      )}
    </div>
  )
}

// Matches each of a property's captured measurements to a rate by category
// (exact lookup, no fuzzy text matching) and multiplies by the AI's
// estimated dimension, keeping Materials and Labor as separate running
// totals alongside the combined Total. Anything with no category, no
// matching rate, or no computed dimension yet is flagged as unpriced
// rather than silently dropped, so the breakdown always accounts for every
// photo taken.
function computeEstimate(measurements, rates) {
  let materialLow = 0, materialHigh = 0, laborLow = 0, laborHigh = 0
  const lines = (measurements || []).map(m => {
    const rate = rates.find(r => r.category === m.category)
    const priced = !!rate && m.estimatedValue != null
    const lineMaterialLow = priced ? m.estimatedValue * rate.material_rate_low : null
    const lineMaterialHigh = priced ? m.estimatedValue * rate.material_rate_high : null
    const lineLaborLow = priced ? m.estimatedValue * rate.labor_rate_low : null
    const lineLaborHigh = priced ? m.estimatedValue * rate.labor_rate_high : null
    const subtotalLow = priced ? lineMaterialLow + lineLaborLow : null
    const subtotalHigh = priced ? lineMaterialHigh + lineLaborHigh : null
    if (priced) {
      materialLow += lineMaterialLow; materialHigh += lineMaterialHigh
      laborLow += lineLaborLow; laborHigh += lineLaborHigh
    }
    return { ...m, rate, priced, lineMaterialLow, lineMaterialHigh, lineLaborLow, lineLaborHigh, subtotalLow, subtotalHigh }
  })
  return {
    lines, materialLow, materialHigh, laborLow, laborHigh,
    totalLow: materialLow + laborLow, totalHigh: materialHigh + laborHigh,
    unpriced: lines.filter(l => !l.priced).length,
  }
}

function PropertyEstimateRow({ property, rates }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const reportData = parseReportData(property.report_draft_markdown)
  const { lines, materialLow, materialHigh, laborLow, laborHigh, totalLow, totalHigh, unpriced } = computeEstimate(reportData?.mitigationMeasurements, rates)

  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 8, marginBottom: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--surface)' }}>
        <button onClick={() => setOpen(o => !o)} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', minWidth: 0 }}>
          {open ? <ChevronDown className="size-3.5 shrink-0" style={{ color: 'var(--text-muted)' }} /> : <ChevronRight className="size-3.5 shrink-0" style={{ color: 'var(--text-muted)' }} />}
          <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{property.address}</span>
        </button>
        {unpriced > 0 && <span style={{ fontSize: 10.5, fontFamily: 'monospace', color: 'var(--warn)' }}>{unpriced} unpriced</span>}
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', whiteSpace: 'nowrap' }}>
          {lines.length === 0 ? '—' : `${formatMoney(totalLow)}–${formatMoney(totalHigh)}`}
        </span>
        <button
          onClick={() => router.push(`/manage/${property.id}/review`)}
          style={{ fontSize: 10.5, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: 20, padding: '3px 9px', background: 'transparent', cursor: 'pointer', flexShrink: 0 }}
        >
          Open Review
        </button>
      </div>
      {open && (
        <div style={{ padding: '10px 16px 14px', borderTop: '1px solid var(--line)', background: 'var(--surface-2)' }}>
          {lines.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>No measurements captured for this property yet.</p>}
          {lines.length > 0 && (
            <div style={{ display: 'flex', gap: 16, marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid var(--line)', fontSize: 11.5, color: 'var(--text-muted)' }}>
              <span>Materials: <strong style={{ color: 'var(--text)' }}>{formatMoney(materialLow)}–{formatMoney(materialHigh)}</strong></span>
              <span>Labor: <strong style={{ color: 'var(--text)' }}>{formatMoney(laborLow)}–{formatMoney(laborHigh)}</strong></span>
              <span>Total: <strong style={{ color: 'var(--accent)' }}>{formatMoney(totalLow)}–{formatMoney(totalHigh)}</strong></span>
            </div>
          )}
          {lines.map((l, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '7px 0', borderBottom: i < lines.length - 1 ? '1px solid var(--line)' : 'none' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 600 }}>{l.label || '(untitled)'}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                  {l.category || 'Uncategorized'}{l.estimatedValue != null ? ` · ~${l.estimatedValue} ${l.unit}` : ' · no estimate yet'}{l.confidence ? ` · ${l.confidence} confidence` : ''}
                </div>
                {l.priced && (
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 1 }}>
                    Materials {formatMoney(l.lineMaterialLow)}–{formatMoney(l.lineMaterialHigh)} · Labor {formatMoney(l.lineLaborLow)}–{formatMoney(l.lineLaborHigh)}
                  </div>
                )}
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: l.priced ? 'var(--text)' : 'var(--warn)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {l.priced ? `${formatMoney(l.subtotalLow)}–${formatMoney(l.subtotalHigh)}` : (l.category && !l.rate ? 'no rate set' : !l.category ? 'not categorized' : 'no estimate')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function EstimatePage() {
  const { confirmDialog, alertDialog } = useConfirmDialog()
  const [rates, setRates] = useState([])
  const [properties, setProperties] = useState([])
  const [fetching, setFetching] = useState(true)

  const load = useCallback(async () => {
    setFetching(true)
    const [{ data: rateRows }, { data: propRows }] = await Promise.all([
      supabase.from('mitigation_price_rates').select('*').order('category'),
      supabase.from('properties').select('id, address, report_draft_markdown').order('created_at', { ascending: false }),
    ])
    setRates(rateRows || [])
    setProperties(propRows || [])
    setFetching(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function addRate(payload) {
    const { error } = await supabase.from('mitigation_price_rates').insert(payload)
    if (error) { await alertDialog('Save failed: ' + error.message); return }
    load()
  }
  async function saveRate(id, payload) {
    const { error } = await supabase.from('mitigation_price_rates').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) { await alertDialog('Save failed: ' + error.message); return }
    load()
  }
  async function deleteRate(id) {
    if (!(await confirmDialog('Delete this rate category? Any measurements categorized under it will show as unpriced until re-categorized or the rate is re-added.'))) return
    const { error } = await supabase.from('mitigation_price_rates').delete().eq('id', id)
    if (error) { await alertDialog('Delete failed: ' + error.message); return }
    load()
  }

  // Only properties with at least one captured measurement are worth
  // showing here — everything else would just be a row of dashes.
  const withMeasurements = properties.filter(p => {
    const rd = parseReportData(p.report_draft_markdown)
    return rd?.mitigationMeasurements?.length > 0
  })

  return (
    <div style={{ maxWidth: 900 }}>
      {fetching ? (
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading…</p>
      ) : (
        <>
          <RatesTable rates={rates} onAdd={addRate} onSave={saveRate} onDelete={deleteRate} />

          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: '0 0 6px' }}>Property Estimates</h2>
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.6, margin: '0 0 14px', maxWidth: 640 }}>
            Computed from each property's captured measurements (Guided Entry → Measurements) matched to the rate table above by category. Dimensions are AI visual estimates, not survey-grade — treat totals as a scoping range, not a quote.
          </p>
          {withMeasurements.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No properties have any measurements captured yet.</p>
          )}
          {withMeasurements.map(p => <PropertyEstimateRow key={p.id} property={p} rates={rates} />)}
        </>
      )}
    </div>
  )
}
