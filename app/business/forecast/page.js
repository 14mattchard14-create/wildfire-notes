'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Trash2, Copy, Save } from 'lucide-react'

// Financial forecasting calculator — the in-app replacement for
// growth-poam.xlsx. Every scenario is a row in financial_scenarios
// (migration 025): a name plus two jsonb blobs, `assumptions` (prices,
// hours per job, capacity thresholds, margins, overhead line items,
// marketing spend) and `monthly` (12 months of audits/self/hardening
// counts). computeForecast() below is the entire model — pure arithmetic,
// no spreadsheet, no recalculation step, updates as you type.
//
// Capacity is tracked per person, per month, right in the monthly grid —
// each month has an editable Person 1 Hrs/Wk and Person 2 Hrs/Wk (both can
// start part-time and either one can ramp to full-time whenever a scenario
// wants, at whatever volume — there's no fixed "join month" or "solo vs
// partner" assumption baked into the model, just two numbers you can type
// differently into any month).

const DEFAULT_ASSUMPTIONS = {
  auditPrice: 500,
  selfPrice: 200,
  hardeningPrice: 450,
  hoursPerAudit: 4,
  hoursPerSelf: 1,
  hoursPerHardening: 4,
  auditMargin: 0.90,
  hardeningMargin: 0.65,
  weeksPerMonth: 4.33,
  marketingSpend: 200,
  overheadItems: [
    { label: 'GL + E&O Insurance', value: 145 },
    { label: 'Tech Stack', value: 58 },
    { label: 'Google Workspace', value: 20 },
  ],
}

function emptyMonthly() {
  return Array.from({ length: 12 }, () => ({ audits: 0, self: 0, hardening: 0, person1Hours: 12, person2Hours: 0 }))
}

const STARTER_SCENARIOS = [
  {
    name: 'Partner Goes Full-Time',
    notes: "Both people part-time (evenings/weekends) through month 5. At month 6, once volume justifies it, Person 2 quits their job and goes full-time while Person 1 stays part-time.",
    assumptions: { ...DEFAULT_ASSUMPTIONS, marketingSpend: 200 },
    monthly: [
      { audits: 1, self: 1, hardening: 0, person1Hours: 12, person2Hours: 12 },
      { audits: 2, self: 1, hardening: 0, person1Hours: 12, person2Hours: 12 },
      { audits: 2, self: 2, hardening: 1, person1Hours: 12, person2Hours: 12 },
      { audits: 3, self: 2, hardening: 1, person1Hours: 12, person2Hours: 12 },
      { audits: 3, self: 2, hardening: 1, person1Hours: 12, person2Hours: 12 },
      { audits: 6, self: 3, hardening: 2, person1Hours: 12, person2Hours: 40 },
      { audits: 8, self: 4, hardening: 3, person1Hours: 12, person2Hours: 40 },
      { audits: 9, self: 4, hardening: 4, person1Hours: 12, person2Hours: 40 },
      { audits: 10, self: 5, hardening: 4, person1Hours: 12, person2Hours: 40 },
      { audits: 11, self: 5, hardening: 5, person1Hours: 12, person2Hours: 40 },
      { audits: 12, self: 6, hardening: 5, person1Hours: 12, person2Hours: 40 },
      { audits: 13, self: 6, hardening: 6, person1Hours: 12, person2Hours: 40 },
    ],
  },
  {
    name: 'Part-Time Evenings',
    notes: 'Permanent, Person 1 only, flat capacity all year — evenings/weekends only, no assumption it ever grows into something bigger.',
    assumptions: { ...DEFAULT_ASSUMPTIONS, marketingSpend: 50 },
    monthly: [
      { audits: 1, self: 1, hardening: 0, person1Hours: 12, person2Hours: 0 },
      { audits: 1, self: 1, hardening: 0, person1Hours: 12, person2Hours: 0 },
      { audits: 2, self: 1, hardening: 1, person1Hours: 12, person2Hours: 0 },
      { audits: 2, self: 1, hardening: 1, person1Hours: 12, person2Hours: 0 },
      { audits: 2, self: 2, hardening: 1, person1Hours: 12, person2Hours: 0 },
      { audits: 2, self: 2, hardening: 1, person1Hours: 12, person2Hours: 0 },
      { audits: 3, self: 2, hardening: 1, person1Hours: 12, person2Hours: 0 },
      { audits: 3, self: 2, hardening: 1, person1Hours: 12, person2Hours: 0 },
      { audits: 4, self: 2, hardening: 1, person1Hours: 12, person2Hours: 0 },
      { audits: 4, self: 2, hardening: 1, person1Hours: 12, person2Hours: 0 },
      { audits: 4, self: 2, hardening: 1, person1Hours: 12, person2Hours: 0 },
      { audits: 4, self: 3, hardening: 1, person1Hours: 12, person2Hours: 0 },
    ],
  },
  {
    name: 'Homeowner Inspections Only',
    notes: 'Same part-time, Person 1 only constraint, but drops the hardening add-on entirely — audits and guided self-inspections only. Also sidesteps nearly every open item in legal-risk-notes.md since there is no contractor-licensing exemption being relied on.',
    assumptions: { ...DEFAULT_ASSUMPTIONS, marketingSpend: 100 },
    monthly: [
      { audits: 1, self: 1, hardening: 0, person1Hours: 12, person2Hours: 0 },
      { audits: 2, self: 1, hardening: 0, person1Hours: 12, person2Hours: 0 },
      { audits: 2, self: 2, hardening: 0, person1Hours: 12, person2Hours: 0 },
      { audits: 3, self: 2, hardening: 0, person1Hours: 12, person2Hours: 0 },
      { audits: 3, self: 2, hardening: 0, person1Hours: 12, person2Hours: 0 },
      { audits: 3, self: 3, hardening: 0, person1Hours: 12, person2Hours: 0 },
      { audits: 4, self: 3, hardening: 0, person1Hours: 12, person2Hours: 0 },
      { audits: 4, self: 3, hardening: 0, person1Hours: 12, person2Hours: 0 },
      { audits: 4, self: 3, hardening: 0, person1Hours: 12, person2Hours: 0 },
      { audits: 5, self: 3, hardening: 0, person1Hours: 12, person2Hours: 0 },
      { audits: 5, self: 3, hardening: 0, person1Hours: 12, person2Hours: 0 },
      { audits: 5, self: 4, hardening: 0, person1Hours: 12, person2Hours: 0 },
    ],
  },
]

function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0 }

function computeForecast(assumptions, monthly) {
  const a = assumptions || {}
  const overheadTotal = (a.overheadItems || []).reduce((s, i) => s + num(i.value), 0)
  const weeksPerMonth = num(a.weeksPerMonth) || 4.33
  const rows = (monthly && monthly.length ? monthly : emptyMonthly()).map((m, i) => {
    const month = i + 1
    const audits = num(m.audits), self = num(m.self), hardening = num(m.hardening)
    const revenue = audits * num(a.auditPrice) + self * num(a.selfPrice) + hardening * num(a.hardeningPrice)
    const hours = audits * num(a.hoursPerAudit) + self * num(a.hoursPerSelf) + hardening * num(a.hoursPerHardening)
    const hoursPerWeek = weeksPerMonth ? hours / weeksPerMonth : 0
    let person1Hours, person2Hours
    if (m.person1Hours != null || m.person2Hours != null) {
      person1Hours = num(m.person1Hours)
      person2Hours = num(m.person2Hours)
    } else {
      // Fall back for scenarios saved before capacity moved into the
      // monthly grid, so old saved data doesn't silently read as zero.
      const partnerJoined = month >= (num(a.partnerJoinMonth) || 999)
      person1Hours = a.soloHoursPerPersonPerWeek != null ? num(a.soloHoursPerPersonPerWeek) : num(a.soloHoursPerWeek)
      person2Hours = partnerJoined ? (a.partnerHoursPerPersonPerWeek != null ? num(a.partnerHoursPerPersonPerWeek) : (num(a.twoPersonHoursPerWeek) / 2 || 0)) : 0
    }
    const threshold = person1Hours + person2Hours
    return { month, audits, self, hardening, revenue, hours, hoursPerWeek, threshold, person1Hours, person2Hours, status: hoursPerWeek > threshold ? 'Over' : 'OK' }
  })
  const totals = rows.reduce((acc, r) => ({
    audits: acc.audits + r.audits, self: acc.self + r.self, hardening: acc.hardening + r.hardening, revenue: acc.revenue + r.revenue,
  }), { audits: 0, self: 0, hardening: 0, revenue: 0 })
  const auditSelfRevenue = rows.reduce((s, r) => s + r.audits * num(a.auditPrice) + r.self * num(a.selfPrice), 0)
  const hardeningRevenue = rows.reduce((s, r) => s + r.hardening * num(a.hardeningPrice), 0)
  const netProfit = auditSelfRevenue * num(a.auditMargin) + hardeningRevenue * num(a.hardeningMargin) - 12 * overheadTotal - 12 * num(a.marketingSpend)
  const peakHoursPerWeek = rows.reduce((m, r) => Math.max(m, r.hoursPerWeek), 0)
  return { rows, totals, netProfit, peakHoursPerWeek, overheadTotal, anyOver: rows.some(r => r.status === 'Over') }
}

// Goal Seek — the reverse of computeForecast(): given a target annual net
// profit, solve for the Year-1 volume needed to hit it, distribute that
// volume across 12 months on a linear ramp, then hand the resulting
// monthly array to computeForecast() (with the capacity you say you have)
// so the normal Peak Hrs/Wk + Capacity readout tells you whether it's
// actually workable — same engine, run backward first.
//
// selfRatio and hardeningConversion turn a single "audits" lever into a
// full monthly mix: selfRatio is self-inspections per audit, hardeningConversion
// is the fraction of audits that also become a hardening job — defaulted from
// business-plan.md §7 Key Assumptions ("~40% of on-site audit clients convert
// to hardening add-ons"). This only checks whether the hours fit your stated
// capacity — it says nothing about whether that many jobs are actually gettable
// in your market. Competitor volume/pricing benchmarks would be the next input
// to layer in here once you've got that research.
function computeGoalSeek({ assumptions, targetNetProfit, selfRatio, hardeningConversion, marketingSpend, rampMonth, person1Hours, person2Hours }) {
  const a = assumptions || {}
  const overheadTotal = (a.overheadItems || []).reduce((s, i) => s + num(i.value), 0)
  const annualFixed = 12 * overheadTotal + 12 * num(marketingSpend)
  const auditM = num(a.auditMargin), hardM = num(a.hardeningMargin)
  const sRatio = num(selfRatio), hConv = num(hardeningConversion)
  // Profit contributed per audit "bundle" (1 audit + sRatio self-inspections
  // + hConv of a hardening job, all at the given margins).
  const perAuditProfit = num(a.auditPrice) * auditM + sRatio * num(a.selfPrice) * auditM + hConv * num(a.hardeningPrice) * hardM
  const auditsAnnual = perAuditProfit > 0 ? Math.max(0, (num(targetNetProfit) + annualFixed) / perAuditProfit) : 0
  const selfAnnual = auditsAnnual * sRatio
  const hardeningAnnual = auditsAnnual * hConv

  const ramp = Math.max(1, num(rampMonth) || 1)
  const weights = Array.from({ length: 12 }, (_, i) => Math.min(1, (i + 1) / ramp))
  const weightSum = weights.reduce((s, w) => s + w, 0) || 1

  const monthly = weights.map(w => ({
    audits: Math.round((auditsAnnual * w) / weightSum),
    self: Math.round((selfAnnual * w) / weightSum),
    hardening: Math.round((hardeningAnnual * w) / weightSum),
    person1Hours: num(person1Hours),
    person2Hours: num(person2Hours),
  }))

  return { auditsAnnual, selfAnnual, hardeningAnnual, monthly, forecast: computeForecast(a, monthly) }
}

function money(n) { return `$${Math.round(n).toLocaleString('en-US')}` }

const label = { display: 'block', fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }
const input = { width: '100%', fontSize: 12.5, padding: '6px 8px', border: '1px solid var(--line)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', boxSizing: 'border-box' }
const card = { border: '1px solid var(--line)', borderRadius: 8, padding: 14, background: 'var(--surface)' }

function Field({ text, value, onChange, step = 'any', prefix }) {
  return (
    <div>
      <span style={label}>{text}</span>
      <div style={{ position: 'relative' }}>
        {prefix && <span style={{ position: 'absolute', left: 8, top: 7, fontSize: 12.5, color: 'var(--text-muted)' }}>{prefix}</span>}
        <input
          type="number" step={step} value={value}
          onChange={e => onChange(e.target.value)}
          style={{ ...input, paddingLeft: prefix ? 18 : 8 }}
        />
      </div>
    </div>
  )
}

function AssumptionsPanel({ assumptions, onChange }) {
  const set = (key) => (val) => onChange({ ...assumptions, [key]: val })
  const setOverhead = (idx, field) => (val) => {
    const items = assumptions.overheadItems.map((it, i) => i === idx ? { ...it, [field]: val } : it)
    onChange({ ...assumptions, overheadItems: items })
  }
  const addOverhead = () => onChange({ ...assumptions, overheadItems: [...assumptions.overheadItems, { label: 'New line item', value: 0 }] })
  const removeOverhead = (idx) => onChange({ ...assumptions, overheadItems: assumptions.overheadItems.filter((_, i) => i !== idx) })

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={card}>
        <h3 style={{ fontSize: 12.5, fontWeight: 700, margin: '0 0 10px', color: 'var(--text)' }}>Pricing</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          <Field text="On-Site Audit ($)" prefix="$" value={assumptions.auditPrice} onChange={set('auditPrice')} />
          <Field text="Guided Self-Inspection ($)" prefix="$" value={assumptions.selfPrice} onChange={set('selfPrice')} />
          <Field text="Avg Hardening Ticket ($)" prefix="$" value={assumptions.hardeningPrice} onChange={set('hardeningPrice')} />
        </div>
      </div>

      <div style={card}>
        <h3 style={{ fontSize: 12.5, fontWeight: 700, margin: '0 0 10px', color: 'var(--text)' }}>Hours per job</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          <Field text="Hrs / Audit (travel+visit+report)" value={assumptions.hoursPerAudit} onChange={set('hoursPerAudit')} />
          <Field text="Hrs / Self-Inspection" value={assumptions.hoursPerSelf} onChange={set('hoursPerSelf')} />
          <Field text="Hrs / Hardening Job" value={assumptions.hoursPerHardening} onChange={set('hoursPerHardening')} />
        </div>
      </div>

      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <h3 style={{ fontSize: 12.5, fontWeight: 700, margin: 0, color: 'var(--text)' }}>Margins &amp; marketing</h3>
          <span
            title={'Audit/Self Margin ~90%: business-plan.md §4.2/§7 — ~$35 variable COGS per $500 audit.\nHardening Margin ~65%: business-plan.md §7 — hardening materials/labor run ~35% of hardening revenue.'}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 14, height: 14, borderRadius: '50%',
              border: '1px solid var(--text-muted)', color: 'var(--text-muted)', fontSize: 9.5, fontWeight: 700, cursor: 'help', lineHeight: 1,
            }}
          >
            i
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          <Field text="Audit/Self Margin (0-1)" value={assumptions.auditMargin} onChange={set('auditMargin')} />
          <Field text="Hardening Margin (0-1)" value={assumptions.hardeningMargin} onChange={set('hardeningMargin')} />
          <Field text="Monthly Marketing Spend ($)" prefix="$" value={assumptions.marketingSpend} onChange={set('marketingSpend')} />
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '8px 0 0', lineHeight: 1.5 }}>
          Defaults pulled from <code style={{ fontSize: 10.5 }}>business/business-plan.md</code> §4.2 &amp; §7 (Key Assumptions) — edit freely per scenario, these are starting points, not fixed.
        </p>
      </div>

      <div style={card}>
        <h3 style={{ fontSize: 12.5, fontWeight: 700, margin: '0 0 10px', color: 'var(--text)' }}>Fixed monthly overhead</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {assumptions.overheadItems.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input style={{ ...input, flex: 1 }} value={item.label} onChange={e => setOverhead(idx, 'label')(e.target.value)} />
              <div style={{ position: 'relative', width: 110 }}>
                <span style={{ position: 'absolute', left: 8, top: 7, fontSize: 12.5, color: 'var(--text-muted)' }}>$</span>
                <input type="number" style={{ ...input, paddingLeft: 18 }} value={item.value} onChange={e => setOverhead(idx, 'value')(e.target.value)} />
              </div>
              <button onClick={() => removeOverhead(idx)} title="Remove" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warn)', padding: 4 }}>
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
          <button onClick={addOverhead} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--accent)', background: 'none', border: '1px solid var(--accent)', borderRadius: 4, padding: '5px 9px', cursor: 'pointer', marginTop: 2 }}>
            <Plus className="size-3" /> Line item
          </button>
          <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Total: <strong style={{ color: 'var(--text)' }}>{money(assumptions.overheadItems.reduce((s, i) => s + num(i.value), 0))}/mo</strong>
          </p>
        </div>
      </div>
    </div>
  )
}

function MonthlyGrid({ monthly, forecast, onChange }) {
  const setCell = (idx, field) => (val) => {
    const next = monthly.map((m, i) => i === idx ? { ...m, [field]: val } : m)
    onChange(next)
  }
  const cellStyle = { padding: '5px 7px', fontSize: 12, color: 'var(--text)' }
  const numInput = { ...input, width: 56, padding: '4px 6px', fontSize: 12 }

  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--line)', borderRadius: 8 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
        <thead>
          <tr style={{ background: 'var(--surface-2)', textAlign: 'left' }}>
            {['Month', 'Audits', 'Self', 'Hardening', 'Person 1 Hrs/Wk', 'Person 2 Hrs/Wk', 'Revenue', 'Hrs Needed/Wk', 'Capacity'].map(h => (
              <th key={h} style={{ padding: '7px 7px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {forecast.rows.map((r, idx) => (
            <tr key={r.month} style={{ borderTop: '1px solid var(--line)' }}>
              <td style={cellStyle}>{r.month}</td>
              <td style={cellStyle}><input type="number" style={numInput} value={monthly[idx].audits} onChange={e => setCell(idx, 'audits')(e.target.value)} /></td>
              <td style={cellStyle}><input type="number" style={numInput} value={monthly[idx].self} onChange={e => setCell(idx, 'self')(e.target.value)} /></td>
              <td style={cellStyle}><input type="number" style={numInput} value={monthly[idx].hardening} onChange={e => setCell(idx, 'hardening')(e.target.value)} /></td>
              <td style={cellStyle}><input type="number" style={numInput} value={monthly[idx].person1Hours ?? ''} onChange={e => setCell(idx, 'person1Hours')(e.target.value)} /></td>
              <td style={cellStyle}><input type="number" style={numInput} value={monthly[idx].person2Hours ?? ''} onChange={e => setCell(idx, 'person2Hours')(e.target.value)} /></td>
              <td style={cellStyle}>{money(r.revenue)}</td>
              <td style={cellStyle}>{r.hoursPerWeek.toFixed(1)}</td>
              <td style={{ ...cellStyle, color: r.status === 'Over' ? 'var(--warn)' : 'var(--ok)', fontWeight: 600 }}>{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function StatCard({ text, value, accent, warn }) {
  return (
    <div style={{ ...card, flex: 1, minWidth: 140 }}>
      <span style={label}>{text}</span>
      <div style={{ fontSize: 19, fontWeight: 700, color: warn ? 'var(--warn)' : accent ? 'var(--accent)' : 'var(--text)' }}>{value}</div>
    </div>
  )
}

function ScenarioEditor({ scenario, onChange, onSave, onDuplicate, onDelete, saving, dirty }) {
  const forecast = useMemo(() => computeForecast(scenario.assumptions, scenario.monthly), [scenario.assumptions, scenario.monthly])

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 260px' }}>
          <span style={label}>Scenario name</span>
          <input style={{ ...input, fontSize: 14, fontWeight: 700 }} value={scenario.name} onChange={e => onChange({ ...scenario, name: e.target.value })} />
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 18 }}>
          <button onClick={onSave} disabled={saving || !dirty} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#fff', background: dirty ? 'var(--accent)' : 'var(--text-muted)', border: 'none', borderRadius: 4, padding: '8px 12px', cursor: dirty ? 'pointer' : 'default', opacity: saving ? 0.6 : 1 }}>
            <Save className="size-3.5" /> {saving ? 'Saving…' : dirty ? 'Save' : 'Saved'}
          </button>
          <button onClick={onDuplicate} title="Duplicate" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--text)', background: 'none', border: '1px solid var(--line)', borderRadius: 4, padding: '8px 12px', cursor: 'pointer' }}>
            <Copy className="size-3.5" /> Duplicate
          </button>
          <button onClick={onDelete} title="Delete" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--warn)', background: 'none', border: '1px solid var(--line)', borderRadius: 4, padding: '8px 12px', cursor: 'pointer' }}>
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      <div>
        <span style={label}>Description</span>
        <textarea
          style={{ ...input, minHeight: 44, resize: 'vertical', fontSize: 12.5, lineHeight: 1.5 }}
          value={scenario.notes || ''}
          onChange={e => onChange({ ...scenario, notes: e.target.value })}
          placeholder="What is this scenario assuming, and why?"
        />
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <StatCard text="Year-1 Revenue" value={money(forecast.totals.revenue)} />
        <StatCard text="Est. Net Profit" value={money(forecast.netProfit)} accent />
        <StatCard text="Peak Hrs/Week" value={forecast.peakHoursPerWeek.toFixed(1)} warn={forecast.anyOver} />
        <StatCard text="Capacity" value={forecast.anyOver ? 'Over in some months' : 'OK all year'} warn={forecast.anyOver} />
      </div>

      <AssumptionsPanel assumptions={scenario.assumptions} onChange={a => onChange({ ...scenario, assumptions: a })} />

      <div>
        <h3 style={{ fontSize: 12.5, fontWeight: 700, margin: '0 0 8px', color: 'var(--text)' }}>Monthly volumes</h3>
        <MonthlyGrid monthly={scenario.monthly} forecast={forecast} onChange={m => onChange({ ...scenario, monthly: m })} />
      </div>
    </div>
  )
}

function ScenarioTabs({ scenarios, selectedId, onSelect, onNew }) {
  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', borderBottom: '1px solid var(--line)', overflowX: 'auto' }}>
      {scenarios.map(s => {
        const active = s.id === selectedId
        return (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            style={{
              padding: '9px 14px', fontSize: 12.5, fontWeight: active ? 700 : 500, fontFamily: 'inherit', whiteSpace: 'nowrap',
              background: 'none', border: 'none', borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
              color: active ? 'var(--accent)' : 'var(--text)', cursor: 'pointer', marginBottom: -1,
            }}
          >
            {s.name}
          </button>
        )
      })}
      <button
        onClick={onNew}
        title="New Scenario"
        style={{
          display: 'flex', alignItems: 'center', gap: 4, padding: '9px 12px', fontSize: 12, color: 'var(--accent)',
          background: 'none', border: 'none', cursor: 'pointer', marginBottom: -1, flexShrink: 0,
        }}
      >
        <Plus className="size-3.5" /> New
      </button>
    </div>
  )
}

function ComparisonTable({ scenarios, selectedId, onSelect }) {
  if (scenarios.length < 2) return null
  const cellStyle = { padding: '8px 10px', fontSize: 12.5, color: 'var(--text)' }
  return (
    <div style={{ marginTop: 28 }}>
      <h2 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 10px', color: 'var(--text)' }}>Compare all saved scenarios</h2>
      <div style={{ overflowX: 'auto', border: '1px solid var(--line)', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)', textAlign: 'left' }}>
              {['Scenario', 'Year-1 Revenue', 'Est. Net Profit', 'Peak Hrs/Wk', 'Capacity'].map(h => (
                <th key={h} style={{ padding: '8px 10px', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {scenarios.map(s => {
              const f = computeForecast(s.assumptions, s.monthly)
              const active = s.id === selectedId
              return (
                <tr
                  key={s.id}
                  onClick={() => onSelect(s.id)}
                  style={{ borderTop: '1px solid var(--line)', cursor: 'pointer', background: active ? 'var(--surface-2)' : 'transparent' }}
                >
                  <td style={{ ...cellStyle, fontWeight: active ? 700 : 500 }}>{s.name}</td>
                  <td style={cellStyle}>{money(f.totals.revenue)}</td>
                  <td style={{ ...cellStyle, fontWeight: 700, color: 'var(--accent)' }}>{money(f.netProfit)}</td>
                  <td style={cellStyle}>{f.peakHoursPerWeek.toFixed(1)}</td>
                  <td style={{ ...cellStyle, color: f.anyOver ? 'var(--warn)' : 'var(--ok)', fontWeight: 600 }}>{f.anyOver ? 'Over in some months' : 'OK'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function GoalSeekPanel({ scenarios, onSave }) {
  const [open, setOpen] = useState(false)
  const [targetNetProfit, setTargetNetProfit] = useState(60000)
  const [selfRatio, setSelfRatio] = useState(0.5)
  const [hardeningConversion, setHardeningConversion] = useState(0.40)
  const [marketingSpend, setMarketingSpend] = useState(200)
  const [rampMonth, setRampMonth] = useState(6)
  const [person1Hours, setPerson1Hours] = useState(12)
  const [person2Hours, setPerson2Hours] = useState(0)
  const [baseId, setBaseId] = useState('default')
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  const baseAssumptions = baseId === 'default' ? DEFAULT_ASSUMPTIONS : (scenarios.find(s => s.id === baseId)?.assumptions || DEFAULT_ASSUMPTIONS)

  const result = useMemo(() => computeGoalSeek({
    assumptions: baseAssumptions, targetNetProfit, selfRatio, hardeningConversion, marketingSpend, rampMonth, person1Hours, person2Hours,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [baseAssumptions, targetNetProfit, selfRatio, hardeningConversion, marketingSpend, rampMonth, person1Hours, person2Hours])

  async function handleSave() {
    setSaving(true)
    await onSave(name.trim() || `Goal: ${money(num(targetNetProfit))} net profit`, baseAssumptions, result.monthly)
    setSaving(false)
    setName('')
  }

  return (
    <div style={{ ...card, marginBottom: 18 }}>
      <button onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', gap: 10 }}>
        <h2 style={{ fontSize: 13.5, fontWeight: 700, margin: 0, color: 'var(--text)' }}>Work backward from a target</h2>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{open ? 'Hide' : 'Set a target net profit and see what it takes →'}</span>
      </button>

      {open && (
        <div style={{ marginTop: 14, display: 'grid', gap: 14 }}>
          <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
            Solves for the audit/self-inspection/hardening volume needed to hit the target, ramps it across 12 months, then
            runs it through the same engine as any scenario to check whether the resulting weekly hours fit the capacity you
            enter below. This only checks whether the hours fit your stated capacity — it says nothing about whether that many
            jobs are actually gettable in your market. Competitor pricing/volume benchmarks would be the next input to layer in
            here once that research exists.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            <Field text="Target Year-1 Net Profit ($)" prefix="$" value={targetNetProfit} onChange={setTargetNetProfit} />
            <Field text="Self-Inspections per Audit" value={selfRatio} onChange={setSelfRatio} />
            <Field text="Hardening Conversion (0-1)" value={hardeningConversion} onChange={setHardeningConversion} />
            <Field text="Ramp-Up Month" value={rampMonth} onChange={setRampMonth} />
            <Field text="Monthly Marketing Spend ($)" prefix="$" value={marketingSpend} onChange={setMarketingSpend} />
          </div>

          <div>
            <span style={label}>Base pricing / margins / overhead on</span>
            <select value={baseId} onChange={e => setBaseId(e.target.value)} style={input}>
              <option value="default">Defaults ($500 / $200 / $450, 90% / 65% margins)</option>
              {scenarios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            <Field text="Available Person 1 Hrs/Wk" value={person1Hours} onChange={setPerson1Hours} />
            <Field text="Available Person 2 Hrs/Wk" value={person2Hours} onChange={setPerson2Hours} />
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <StatCard text="Audits Needed (Yr 1)" value={Math.round(result.auditsAnnual)} />
            <StatCard text="Self-Inspections Needed" value={Math.round(result.selfAnnual)} />
            <StatCard text="Hardening Jobs Needed" value={Math.round(result.hardeningAnnual)} />
            <StatCard text="Peak Hrs/Week Needed" value={result.forecast.peakHoursPerWeek.toFixed(1)} warn={result.forecast.anyOver} />
            <StatCard text="Feasibility (capacity only)" value={result.forecast.anyOver ? 'Over capacity' : 'Fits capacity'} warn={result.forecast.anyOver} />
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              style={{ ...input, flex: '1 1 240px' }}
              placeholder={`Goal: ${money(num(targetNetProfit))} net profit`}
              value={name}
              onChange={e => setName(e.target.value)}
            />
            <button onClick={handleSave} disabled={saving} style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#fff', background: 'var(--accent)', border: 'none', borderRadius: 4, padding: '9px 14px', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving…' : 'Save as new scenario'}
            </button>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
            Run this as many times as you want with different targets — each save creates its own scenario tab, so you can compare them side by side below.
          </p>
        </div>
      )}
    </div>
  )
}

export default function ForecastPage() {
  const [scenarios, setScenarios] = useState([])
  const [fetching, setFetching] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const [seeding, setSeeding] = useState(false)

  const load = useCallback(async (preselect) => {
    setFetching(true)
    const { data } = await supabase.from('financial_scenarios').select('*').order('updated_at', { ascending: false })
    const rows = data || []
    setScenarios(rows)
    const nextId = preselect || (rows.find(r => r.id === selectedId) ? selectedId : rows[0]?.id) || null
    setSelectedId(nextId)
    setDraft(rows.find(r => r.id === nextId) ? { ...rows.find(r => r.id === nextId) } : null)
    setFetching(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { load() }, [load])

  function selectScenario(id) {
    if (dirty) {
      const ok = confirm('You have unsaved changes to the current scenario. Switch anyway and lose them?')
      if (!ok) return
    }
    setSelectedId(id)
    setDraft({ ...scenarios.find(s => s.id === id) })
  }

  async function seedStarters() {
    setSeeding(true)
    const { data, error } = await supabase.from('financial_scenarios').insert(STARTER_SCENARIOS).select()
    setSeeding(false)
    if (error) { alert('Could not create starter scenarios: ' + error.message); return }
    await load(data?.[0]?.id)
  }

  async function createBlank() {
    const { data, error } = await supabase.from('financial_scenarios').insert({
      name: 'New Scenario', notes: '', assumptions: DEFAULT_ASSUMPTIONS, monthly: emptyMonthly(),
    }).select().single()
    if (error) { alert('Could not create scenario: ' + error.message); return }
    await load(data.id)
  }

  async function saveDraft() {
    if (!draft) return
    setSaving(true)
    const { error } = await supabase.from('financial_scenarios').update({
      name: draft.name, notes: draft.notes, assumptions: draft.assumptions, monthly: draft.monthly,
      updated_at: new Date().toISOString(),
    }).eq('id', draft.id)
    setSaving(false)
    if (error) { alert('Save failed: ' + error.message); return }
    await load(draft.id)
  }

  async function duplicateDraft() {
    if (!draft) return
    const { data, error } = await supabase.from('financial_scenarios').insert({
      name: `${draft.name} (copy)`, notes: draft.notes, assumptions: draft.assumptions, monthly: draft.monthly,
    }).select().single()
    if (error) { alert('Could not duplicate: ' + error.message); return }
    await load(data.id)
  }

  async function deleteDraft() {
    if (!draft) return
    if (!confirm(`Delete "${draft.name}"? This can't be undone.`)) return
    const { error } = await supabase.from('financial_scenarios').delete().eq('id', draft.id)
    if (error) { alert('Delete failed: ' + error.message); return }
    await load()
  }

  async function saveGoalScenario(name, assumptions, monthly) {
    const { data, error } = await supabase.from('financial_scenarios').insert({
      name, notes: 'Generated by Goal Seek from a target net profit — edit freely like any other scenario.', assumptions, monthly,
    }).select().single()
    if (error) { alert('Could not save scenario: ' + error.message); return }
    await load(data.id)
  }

  const saved = scenarios.find(s => s.id === selectedId)
  const dirty = !!draft && !!saved && JSON.stringify({ name: draft.name, notes: draft.notes, assumptions: draft.assumptions, monthly: draft.monthly })
    !== JSON.stringify({ name: saved.name, notes: saved.notes, assumptions: saved.assumptions, monthly: saved.monthly })

  return (
    <div style={{ maxWidth: 1200 }}>
      <p style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.6, margin: '0 0 18px', maxWidth: 760 }}>
        Named, editable "what-if" scenarios for pricing, capacity, marketing spend, and volume — everything recalculates
        as you type, no spreadsheet, no recalculation step. Duplicate a scenario to branch off it, or start blank.
      </p>

      <GoalSeekPanel scenarios={scenarios} onSave={saveGoalScenario} />

      {fetching ? (
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading…</p>
      ) : scenarios.length === 0 ? (
        <div style={{ ...card, maxWidth: 520 }}>
          <p style={{ fontSize: 13, color: 'var(--text)', margin: '0 0 12px' }}>No scenarios yet.</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={seedStarters} disabled={seeding} style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#fff', background: 'var(--accent)', border: 'none', borderRadius: 4, padding: '9px 14px', cursor: 'pointer' }}>
              {seeding ? 'Creating…' : 'Load the three starter scenarios'}
            </button>
            <button onClick={createBlank} style={{ fontSize: 12, color: 'var(--text)', background: 'none', border: '1px solid var(--line)', borderRadius: 4, padding: '9px 14px', cursor: 'pointer' }}>
              Start blank instead
            </button>
          </div>
          <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '10px 0 0', lineHeight: 1.5 }}>
            The starters are Partner Goes Full-Time, Part-Time Evenings, and Homeowner Inspections Only — the same three modeled in the original growth-poam.xlsx, pre-filled so you're not starting from zero.
          </p>
        </div>
      ) : (
        <>
          <ScenarioTabs scenarios={scenarios} selectedId={selectedId} onSelect={selectScenario} onNew={createBlank} />

          <div style={{ marginTop: 16 }}>
            {draft && (
              <ScenarioEditor
                scenario={draft}
                onChange={setDraft}
                onSave={saveDraft}
                onDuplicate={duplicateDraft}
                onDelete={deleteDraft}
                saving={saving}
                dirty={dirty}
              />
            )}
          </div>

          <ComparisonTable scenarios={scenarios} selectedId={selectedId} onSelect={selectScenario} />
        </>
      )}
    </div>
  )
}
