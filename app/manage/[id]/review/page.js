'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { authFetch } from '@/lib/authFetch'
import { ZONES } from '@/lib/criteria'
import { ACTION_PRIORITIES, parseReportData, emptyFinding, emptyActionItem, getPhotoCaption } from '@/lib/reportSchema'
import { reportColors, StatusPill, RiskBadge, CollapsibleCard, priorityColor } from '@/components/ReportView'
import ThemeToggle from '@/components/ThemeToggle'
import BrandLogo from '@/components/BrandLogo'
import BackNav from '@/components/BackNav'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Pencil, Check, X, Plus, Trash2, Copy } from 'lucide-react'

const c = reportColors
const iconBtnStyle = { background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }
const focusRing = 'focus:outline-none focus:ring-1 focus:ring-[#C1502E] focus:ring-offset-1 rounded-sm'
// Editable text that reads as plain report copy until you click into it —
// same font/size/color as the read-only version, no visible border/box
// until focused, so the editing surface genuinely looks like the report
// rather than a form sitting next to it.
const blend = { border: 'none', background: 'transparent', outline: 'none', width: '100%', fontFamily: 'inherit', padding: '2px 4px', margin: '-2px -4px', boxSizing: 'border-box' }

// One finding, styled exactly like the read-only FindingCard on the
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

      <button
        onClick={() => setExpanded(x => !x)}
        style={{ background: 'none', border: 'none', padding: 0, margin: '0 0 8px', color: c.slate, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
      >
        {expanded ? '▾ Hide details' : '▸ Learn more about this finding'} <span style={{ opacity: 0.6, fontWeight: 400 }}>(what the customer sees when they click it)</span>
      </button>

      {expanded && (
        <div style={{ marginBottom: 10 }}>
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

      <div style={{ background: c.surfaceAlt, borderRadius: 6, padding: '9px 13px' }}>
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
    </div>
  )
}

const addFindingBtnStyle = { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontFamily: 'monospace', color: c.slate, background: 'none', border: `1px solid ${c.border}`, borderRadius: 4, padding: '6px 10px', cursor: 'pointer' }

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      alert('Could not copy automatically — copy it manually: ' + text)
    }
  }
  return (
    <button onClick={copy} title={copied ? 'Copied!' : 'Copy'} style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: copied ? 'var(--ok)' : 'var(--text-muted)', display: 'inline-flex', verticalAlign: 'middle', marginLeft: 5 }}>
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  )
}

function zoneKey(s) { return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '') }

// Same photo grid the published report shows per zone — matched here too
// so the inspector can see which photos back up a finding while editing it,
// not just after publishing. Caption is editable — it's the AI-generated,
// action-oriented guidance text ("Remove shrubs within 5 ft...") rather
// than the raw field note, stored in draftData.photoCaptions keyed by
// entry id.
function ZonePhotos({ zone, entries, reportData, onCaptionChange }) {
  const photos = (entries || []).filter(e => e.photo_url && zoneKey(e.zone) === zoneKey(zone))
  if (!photos.length) return null
  return (
    <div style={{ marginTop: 4, marginBottom: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
      {photos.map((e, i) => (
        <div key={i} style={{ border: `1px solid ${c.border}`, borderRadius: 8, overflow: 'hidden', background: c.surfaceAlt }}>
          <img src={e.photo_url} alt={getPhotoCaption(reportData, e)} style={{ width: '100%', display: 'block', maxHeight: 150, objectFit: 'cover' }} />
          <div style={{ padding: '7px 9px' }}>
            <textarea
              value={getPhotoCaption(reportData, e)}
              onChange={ev => onCaptionChange(e.id, ev.target.value)}
              rows={2}
              className={focusRing}
              style={{ ...blend, resize: 'vertical', fontSize: 11, color: c.text, lineHeight: 1.4, fontStyle: 'italic', padding: '1px 2px', margin: '-1px -2px' }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

// The review page IS the report editor now — no separate raw-markdown step,
// and it's visually the actual report (same colors/components as
// /report/[token], via components/ReportView.js) with every field editable
// in place, not a plain form sitting next to a preview.

export default function PropertyReviewFlow() {
  const { id } = useParams()
  const router = useRouter()
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
  const [editingCustomerEmail, setEditingCustomerEmail] = useState(false)
  const [customerEmailDraft, setCustomerEmailDraft] = useState('')
  const [savingCustomerEmail, setSavingCustomerEmail] = useState(false)
  const [addZoneKey, setAddZoneKey] = useState('')

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
  }, [id])

  useEffect(() => { load() }, [load])

  async function generateDraft() {
    if ((draftData || legacyDraft) && !confirm('This will overwrite the current draft with a freshly generated one. Continue?')) return
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
    } catch (err) {
      alert('Could not generate draft: ' + err.message)
    } finally {
      setGenerating(false)
    }
  }

  async function saveDraft(silent) {
    if (!draftData) return
    setSaving(true)
    const { error } = await supabase.from('properties').update({ report_draft_markdown: JSON.stringify(draftData) }).eq('id', id)
    setSaving(false)
    if (error) { alert('Save failed: ' + error.message); return }
    if (!silent) { setSavedMsg('Saved'); setTimeout(() => setSavedMsg(''), 2000) }
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
    if (error) { alert('Could not update customer email: ' + error.message); return }
    setProperty(p => ({ ...p, customer_email: trimmed || null }))
    setEditingCustomerEmail(false)
  }

  async function publish() {
    if (!draftData) { alert('Generate a draft before publishing.'); return }
    setPublishing(true)
    try {
      await saveDraft(true)
      const res = await authFetch('/api/report-publish', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId: id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Publish failed')
      setProperty(p => ({ ...p, report_status: 'published', ...(data.customerNotify?.sent ? { customer_notified_at: new Date().toISOString() } : {}) }))
      setShareInfo(prev => ({ token: data.token, accessCode: data.accessCode ?? prev?.accessCode ?? null }))
    } catch (err) {
      alert('Could not publish: ' + err.message)
    } finally {
      setPublishing(false)
    }
  }

  async function notifyCustomer() {
    setNotifyingCustomer(true)
    try {
      const res = await authFetch('/api/notify-customer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId: id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Send failed')
      setProperty(p => ({ ...p, customer_notified_at: new Date().toISOString() }))
    } catch (err) {
      alert('Could not send to customer: ' + err.message)
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
  function removeZone(zi) { patch({ zones: draftData.zones.filter((_, i) => i !== zi) }) }
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
  function updatePhotoCaption(entryId, value) {
    patch({ photoCaptions: { ...(draftData.photoCaptions || {}), [entryId]: value } })
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
    <div style={{ minHeight: '100vh', paddingBottom: 48 }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--header-bg)', borderBottom: '1px solid var(--line)' }}>
        <div style={{ maxWidth: CONTENT_WIDTH, margin: '0 auto', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <BrandLogo />
          <ThemeToggle />
        </div>
      </header>

      <BackNav href={`/manage/${id}`} label="Back to Property" maxWidth={CONTENT_WIDTH} />

      <main style={{ maxWidth: CONTENT_WIDTH, margin: '0 auto', padding: '20px 16px 64px' }}>
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

            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              <Button onClick={generateDraft} disabled={generating} className="text-[12px] font-bold uppercase tracking-wide h-auto py-2.5 px-4">
                {generating ? 'Generating…' : (draftData || legacyDraft) ? 'Regenerate Draft' : 'Generate Draft Report'}
              </Button>
              {draftData && (
                <>
                  <Button variant="outline" onClick={() => saveDraft(false)} disabled={saving} className="text-[12px] uppercase tracking-wide h-auto py-2.5 px-4 font-mono normal-case">
                    {saving ? 'Saving…' : savedMsg || 'Save Draft'}
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
                    onClick={notifyCustomer}
                    disabled={notifyingCustomer}
                    style={{ fontSize: 11.5, fontFamily: 'monospace', color: 'var(--ok)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    {notifyingCustomer ? 'Sending…' : property?.customer_notified_at ? 'Resend to Customer' : 'Send to Customer'}
                  </button>
                </div>
              </div>
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
                <RiskBadge level={draftData.overallRiskRating} editable onChange={v => patch({ overallRiskRating: v })} />

                <CollapsibleCard title="Executive Summary" isH2 defaultOpen>
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
                </CollapsibleCard>

                <CollapsibleCard title="Site & Environmental Overview" isH2 defaultOpen>
                  <textarea
                    value={draftData.siteOverview}
                    onChange={e => patch({ siteOverview: e.target.value })}
                    placeholder="3-5 sentences: location context, FHSZ status, surrounding fuel load, primary ignition pathways"
                    rows={4}
                    className={focusRing}
                    style={{ ...blend, resize: 'vertical', fontSize: 15, color: c.text, lineHeight: 1.75 }}
                  />
                </CollapsibleCard>

                {draftData.zones.map((zone, zi) => (
                  <CollapsibleCard
                    key={zi}
                    isH2
                    defaultOpen
                    headerContent={
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <select
                          value={zone.zone}
                          onChange={e => updateZone(zi, 'zone', e.target.value)}
                          style={{ background: 'transparent', color: '#fff', border: 'none', outline: 'none', fontWeight: 700, fontSize: 16, fontFamily: 'inherit', cursor: 'pointer', flex: 1, minWidth: 0 }}
                        >
                          {!ZONES.includes(zone.zone) && <option value={zone.zone}>{zone.zone}</option>}
                          {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
                        </select>
                        <button onClick={() => removeZone(zi)} title="Remove this zone" style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.75)', cursor: 'pointer', display: 'flex', flexShrink: 0 }}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    }
                  >
                    {zone.findings.map((f, fi) => (
                      <EditableFinding
                        key={fi}
                        f={f}
                        onChange={(field, val) => updateFinding(zi, fi, field, val)}
                        onRemove={() => removeFinding(zi, fi)}
                      />
                    ))}
                    <button onClick={() => addFinding(zi)} style={addFindingBtnStyle}>
                      <Plus size={13} /> Add Finding
                    </button>
                    <ZonePhotos zone={zone.zone} entries={entries} reportData={draftData} onCaptionChange={updatePhotoCaption} />
                  </CollapsibleCard>
                ))}

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

                <CollapsibleCard title="Prioritized Action Plan" isH2 defaultOpen>
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
                </CollapsibleCard>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
