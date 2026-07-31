'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { authFetch } from '@/lib/authFetch'
import { ZONES, STATUSES } from '@/lib/criteria'
import { RISK_LEVELS, ACTION_PRIORITIES, parseReportData, blankReportData, emptyFinding, emptyActionItem } from '@/lib/reportSchema'
import ThemeToggle from '@/components/ThemeToggle'
import BrandLogo from '@/components/BrandLogo'
import BackNav from '@/components/BackNav'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Pencil, Check, X, Plus, Trash2 } from 'lucide-react'

// Report status options an entry (and therefore a finding) can carry.
// "Pending review" isn't in STATUSES (that's only what the inspector can
// pick when logging an entry) but the AI uses it verbatim for entries that
// were never given a status, so it needs to be selectable here too.
const FINDING_STATUSES = [...STATUSES.map(s => s.value), 'Pending review']

const cardStyle = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: 16, marginBottom: 16 }
const sectionTitleStyle = { fontSize: 12, fontFamily: 'monospace', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent)', margin: '0 0 14px' }
const labelStyle = { display: 'block', fontSize: 10.5, fontFamily: 'monospace', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 5 }
const selectStyle = { width: '100%', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 4, color: 'var(--text)', fontSize: 13, padding: '8px 10px', fontFamily: 'inherit' }
const iconBtnStyle = { background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }

function Field({ label, children }) {
  return <div style={{ marginBottom: 12 }}><span style={labelStyle}>{label}</span>{children}</div>
}

// The review page IS the report editor now — no separate raw-markdown step.
// Every field here maps 1:1 onto what /report/[token] renders for the
// customer, so what the inspector edits is exactly what gets published.

export default function PropertyReviewFlow() {
  const { id } = useParams()
  const router = useRouter()
  const { user, loading, isHomeowner, profileReady } = useAuth()
  const [property, setProperty] = useState(null)
  const [entryCount, setEntryCount] = useState(0)
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
    const [{ data: prop }, { count }] = await Promise.all([
      supabase.from('properties').select('*').eq('id', id).maybeSingle(),
      supabase.from('entries').select('id', { count: 'exact', head: true }).eq('property_id', id),
    ])
    setProperty(prop)
    setEntryCount(count ?? 0)
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

        {!fetching && entryCount === 0 && (
          <div style={{ background: 'rgba(217,164,6,.1)', border: '1px solid var(--warn)', borderRadius: 6, padding: '14px 16px', fontSize: 13, color: 'var(--text)' }}>
            No entries logged for this property yet. Go back and log at least one finding before generating a report.
          </div>
        )}

        {!fetching && entryCount > 0 && (
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
                  <strong style={{ color: 'var(--ok)' }}>✓ Published.</strong> Link: <code style={{ fontFamily: 'monospace' }}>{typeof window !== 'undefined' ? `${window.location.origin}/report/${shareInfo.token}` : shareInfo.token}</code>
                  {shareInfo.accessCode && <> · Access code: <strong>{shareInfo.accessCode}</strong></>}
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
              <div>
                {/* Executive Summary */}
                <div style={cardStyle}>
                  <p style={sectionTitleStyle}>Executive Summary</p>
                  <Field label="Overall Risk Rating">
                    <select style={selectStyle} value={draftData.overallRiskRating} onChange={e => patch({ overallRiskRating: e.target.value })}>
                      {RISK_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </Field>
                  <Field label="Summary Narrative">
                    <Textarea value={draftData.summaryNarrative} onChange={e => patch({ summaryNarrative: e.target.value })} className="min-h-20" />
                  </Field>
                  <Field label="Top Priorities">
                    {draftData.topPriorities.map((p, i) => (
                      <Input key={i} value={p} onChange={e => updateTopPriority(i, e.target.value)} placeholder={`Priority ${i + 1}`} className="mb-2" />
                    ))}
                  </Field>
                  <Field label="WPH Base (Essential) Snapshot">
                    <Textarea value={draftData.wphBase} onChange={e => patch({ wphBase: e.target.value })} className="min-h-16" />
                  </Field>
                  <Field label="WPH Plus (Enhanced) Snapshot">
                    <Textarea value={draftData.wphPlus} onChange={e => patch({ wphPlus: e.target.value })} className="min-h-16" />
                  </Field>
                </div>

                {/* Site Overview */}
                <div style={cardStyle}>
                  <p style={sectionTitleStyle}>Site & Environmental Overview</p>
                  <Textarea value={draftData.siteOverview} onChange={e => patch({ siteOverview: e.target.value })} className="min-h-20" />
                </div>

                {/* Findings by Zone */}
                <div style={cardStyle}>
                  <p style={sectionTitleStyle}>Findings by Zone</p>
                  {draftData.zones.map((zone, zi) => (
                    <div key={zi} style={{ border: '1px solid var(--line)', borderRadius: 6, padding: 12, marginBottom: 12, background: 'var(--bg)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <select style={{ ...selectStyle, flex: 1 }} value={zone.zone} onChange={e => updateZone(zi, 'zone', e.target.value)}>
                          {!ZONES.includes(zone.zone) && <option value={zone.zone}>{zone.zone}</option>}
                          {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
                        </select>
                        <button onClick={() => removeZone(zi)} title="Remove this zone" style={{ ...iconBtnStyle, color: 'var(--warn)' }}>
                          <Trash2 className="size-4" />
                        </button>
                      </div>

                      {zone.findings.map((f, fi) => (
                        <div key={fi} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 6, padding: 12, marginBottom: 8 }}>
                          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                            <Input value={f.category} onChange={e => updateFinding(zi, fi, 'category', e.target.value)} placeholder="Category / item" className="flex-1 text-[13px] h-8" />
                            <select style={{ ...selectStyle, width: 170 }} value={f.status} onChange={e => updateFinding(zi, fi, 'status', e.target.value)}>
                              {FINDING_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <button onClick={() => removeFinding(zi, fi)} title="Remove finding" style={{ ...iconBtnStyle, color: 'var(--warn)' }}>
                              <X className="size-4" />
                            </button>
                          </div>
                          <Field label="Finding">
                            <Textarea value={f.finding} onChange={e => updateFinding(zi, fi, 'finding', e.target.value)} className="min-h-14 text-[13px]" />
                          </Field>
                          <Field label="Recommendation (shown right under the finding)">
                            <Textarea value={f.recommendation} onChange={e => updateFinding(zi, fi, 'recommendation', e.target.value)} placeholder="Leave blank if fully compliant" className="min-h-14 text-[13px]" />
                          </Field>
                          <Field label="Rationale (shown as a ⓘ tooltip, not inline)">
                            <Textarea value={f.rationale} onChange={e => updateFinding(zi, fi, 'rationale', e.target.value)} placeholder="Why this status was assigned" className="min-h-14 text-[13px]" />
                          </Field>
                        </div>
                      ))}

                      <button onClick={() => addFinding(zi)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontFamily: 'monospace', color: 'var(--accent)', background: 'none', border: `1px solid var(--accent)`, borderRadius: 4, padding: '6px 10px', cursor: 'pointer' }}>
                        <Plus className="size-3.5" /> Add Finding
                      </button>
                    </div>
                  ))}

                  {availableZones.length > 0 && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <select style={selectStyle} value={addZoneKey} onChange={e => setAddZoneKey(e.target.value)}>
                        <option value="">Add a zone…</option>
                        {availableZones.map(z => <option key={z} value={z}>{z}</option>)}
                      </select>
                      <Button variant="outline" onClick={addZone} disabled={!addZoneKey} className="text-[12px] uppercase tracking-wide h-auto py-2 px-3 font-mono normal-case shrink-0">
                        Add Zone
                      </Button>
                    </div>
                  )}
                </div>

                {/* Action Plan */}
                <div style={cardStyle}>
                  <p style={sectionTitleStyle}>Prioritized Action Plan</p>
                  {draftData.actionPlan.map((a, ai) => (
                    <div key={ai} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                      <Input value={a.action} onChange={e => updateActionItem(ai, 'action', e.target.value)} placeholder="Action" className="flex-1 text-[13px] h-8" />
                      <Input value={a.zone} onChange={e => updateActionItem(ai, 'zone', e.target.value)} placeholder="Zone" className="w-40 text-[13px] h-8" />
                      <select style={{ ...selectStyle, width: 110 }} value={a.priority} onChange={e => updateActionItem(ai, 'priority', e.target.value)}>
                        {ACTION_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                      <button onClick={() => removeActionItem(ai)} title="Remove" style={{ ...iconBtnStyle, color: 'var(--warn)' }}>
                        <X className="size-4" />
                      </button>
                    </div>
                  ))}
                  <button onClick={addActionItem} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontFamily: 'monospace', color: 'var(--accent)', background: 'none', border: `1px solid var(--accent)`, borderRadius: 4, padding: '6px 10px', cursor: 'pointer' }}>
                    <Plus className="size-3.5" /> Add Action
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
