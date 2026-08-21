'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { authFetch } from '@/lib/authFetch'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Check, Trash2, Plus, Send, RotateCcw, Pencil, X, ChevronDown, ChevronRight, Phone, MessageSquare, StickyNote, Mail, BellOff, Bell, CalendarPlus } from 'lucide-react'
import { googleCalendarLink } from '@/lib/googleCalendar'
import { useConfirmDialog } from '@/components/ConfirmDialogProvider'

// CRM tab — a customer table, grouped by customer (not by property): a
// customer with more than one property shows as one row with all their
// addresses linked, instead of scattering across unrelated rows. Contact
// info is editable inline and applies to every property tied to that
// customer. Expand a row to see the full contact history (emails, plus
// manually logged calls/texts/notes — logging is just a record, nothing is
// actually dialed/texted from here), schedule a follow-up, or send an email
// from a saved template. Sending is manual only for now; no rules or
// scheduled auto-sends yet — that's a later phase pending a security review
// of running unattended sends with the service-role key.

const REPORT_BADGE = {
  published: { label: 'Published', color: 'var(--ok)' },
  draft:     { label: 'Draft',     color: 'var(--info)' },
}

// Manual overrides shown in the Property Details section of an expanded CRM
// row — these mirror the same check constraints as the /manage pipeline
// (003_homeowner_status.sql, 004_report_pipeline.sql) so a value picked
// here is always one /manage itself would also accept. '__none__' maps to
// null (the "hasn't started" state for both fields).
const HOMEOWNER_STATUS_OPTIONS = [
  { value: '__none__', label: 'Not started' },
  { value: 'invited', label: 'Invited' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'done', label: 'Done' },
]

const REPORT_STATUS_OPTIONS = [
  { value: '__none__', label: 'Not started' },
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
]

const CHANNEL_META = {
  email: { label: 'Email', icon: Mail },
  call:  { label: 'Call',  icon: Phone },
  text:  { label: 'Text',  icon: MessageSquare },
  note:  { label: 'Note',  icon: StickyNote },
}

const iconBtn = { background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }

// Lightweight modal using the app's CSS-variable theme (light/dark aware),
// unlike the fixed-palette Modal in components/ReportView.js which is
// built for the report's own always-light color scheme.
function EditModal({ onClose, children }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, maxWidth: 480, width: '100%', maxHeight: '85vh', overflowY: 'auto', padding: 18, position: 'relative' }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          style={{ position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
        >
          <X className="size-4" />
        </button>
        {children}
      </div>
    </div>
  )
}

function isOverdue(f) {
  if (!f || f.status !== 'pending' || !f.due_date) return false
  return new Date(f.due_date) < new Date(new Date().toDateString())
}

function fillTemplate(text, { address, name }) {
  return (text || '').replace(/\{\{address\}\}/g, address || 'your property').replace(/\{\{name\}\}/g, name || 'there')
}

// Local (not UTC) "now", formatted for a <input type="datetime-local">
// value — used to default the Log Contact form's timestamp to right now
// while still letting the inspector back-date it (e.g. logging a call from
// earlier today after the fact).
function nowLocalInput() {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function EditableField({ value, placeholder, onSave, type = 'text' }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value || '')
  const [saving, setSaving] = useState(false)

  function start(e) { e.stopPropagation(); setDraft(value || ''); setEditing(true) }
  function cancel(e) { e.stopPropagation(); setEditing(false) }
  async function save(e) {
    e.stopPropagation()
    setSaving(true)
    await onSave(draft.trim())
    setSaving(false)
    setEditing(false)
  }

  if (editing) {
    return (
      <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <input
          autoFocus
          type={type}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(e); if (e.key === 'Escape') cancel(e) }}
          style={{ fontSize: 12, padding: '3px 6px', border: '1px solid var(--line)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', width: 140 }}
        />
        <button onClick={save} disabled={saving} style={iconBtn} title="Save"><Check className="size-3" /></button>
        <button onClick={cancel} style={iconBtn} title="Cancel"><X className="size-3" /></button>
      </div>
    )
  }
  return (
    <button onClick={start} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', maxWidth: '100%' }}>
      <span style={{ fontSize: 12, color: value ? 'var(--text)' : 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value || placeholder}</span>
      <Pencil className="size-2.5" style={{ opacity: 0.4, flexShrink: 0 }} />
    </button>
  )
}

// Like EditableField, but keeps the existing "click the address to open
// /manage/[id]" behavior intact — address is the one field customers
// navigate by, so editing has to be an explicit secondary action (a pencil
// icon) rather than replacing the click target entirely.
function AddressField({ property, onSave, textStyle }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(property.address || '')
  const [saving, setSaving] = useState(false)

  function start(e) { e.stopPropagation(); setDraft(property.address || ''); setEditing(true) }
  function cancel(e) { e.stopPropagation(); setEditing(false) }
  async function save(e) {
    e.stopPropagation()
    if (!draft.trim()) return
    setSaving(true)
    await onSave(property.id, draft.trim())
    setSaving(false)
    setEditing(false)
  }

  if (editing) {
    return (
      <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <input
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(e); if (e.key === 'Escape') cancel(e) }}
          style={{ fontSize: 12, padding: '3px 6px', border: '1px solid var(--line)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', width: 200 }}
        />
        <button onClick={save} disabled={saving} style={iconBtn} title="Save"><Check className="size-3" /></button>
        <button onClick={cancel} style={iconBtn} title="Cancel"><X className="size-3" /></button>
      </div>
    )
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minWidth: 0, maxWidth: '100%' }}>
      <button
        onClick={e => { e.stopPropagation(); router.push(`/manage/${property.id}`) }}
        style={{ ...textStyle, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
      >
        {property.address}
      </button>
      <button onClick={start} title="Edit address" style={{ ...iconBtn, flexShrink: 0 }}><Pencil className="size-2.5" style={{ opacity: 0.4 }} /></button>
    </span>
  )
}

// Per-property manual overrides — homeowner/report status, lead source, and
// lead notes all live on the properties row (not the customer), so unlike
// name/email/phone these are edited one property at a time. Rendered once
// per property inside an expanded CRM row.
function PropertyDetailsCard({ property, showAddress, onSave }) {
  const [notes, setNotes] = useState(property.lead_notes || '')
  const [savingNotes, setSavingNotes] = useState(false)

  async function saveNotes() {
    if (notes === (property.lead_notes || '')) return
    setSavingNotes(true)
    await onSave(property.id, 'lead_notes', notes)
    setSavingNotes(false)
  }

  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 6, padding: 10, marginBottom: 8, background: 'var(--bg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        {showAddress && (
          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>
            <AddressField property={property} onSave={(id, v) => onSave(id, 'address', v)} textStyle={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }} />
          </div>
        )}
        {property.job_number && (
          <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-muted)', border: '1px solid var(--line)', borderRadius: 20, padding: '1px 8px' }}>{property.job_number}</span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 10.5, fontFamily: 'monospace', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Homeowner Status</span>
          <Select value={property.homeowner_status || '__none__'} onValueChange={v => onSave(property.id, 'homeowner_status', v === '__none__' ? null : v)}>
            <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {HOMEOWNER_STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 10.5, fontFamily: 'monospace', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Report Status</span>
          <Select value={property.report_status || '__none__'} onValueChange={v => onSave(property.id, 'report_status', v === '__none__' ? null : v)}>
            <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {REPORT_STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 10.5, fontFamily: 'monospace', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Lead Source</span>
          <EditableField value={property.lead_source} placeholder="+ add source" onSave={v => onSave(property.id, 'lead_source', v)} />
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ fontSize: 10.5, fontFamily: 'monospace', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Lead Notes</span>
        <Textarea value={notes} onChange={e => setNotes(e.target.value)} onBlur={saveNotes} placeholder="No lead notes" rows={2} />
        {savingNotes && <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>Saving…</span>}
      </div>
    </div>
  )
}

function HistoryRow({ f, addressLabel, location, onSend, onMarkDone, onReopen, onDelete, sending, hasEmail }) {
  const overdue = isOverdue(f)
  const label = f.status === 'done' ? 'Done' : f.status === 'skipped' ? 'Skipped' : overdue ? 'Overdue' : 'Pending'
  const color = f.status === 'done' ? 'var(--ok)' : f.status === 'skipped' ? 'var(--text-muted)' : overdue ? 'var(--warn)' : 'var(--accent)'
  const ChannelIcon = (CHANNEL_META[f.channel] || CHANNEL_META.email).icon
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 6, marginBottom: 6, background: 'var(--bg)', opacity: f.status === 'pending' ? 1 : 0.65 }}>
      <ChannelIcon className="size-3.5" style={{ flexShrink: 0, marginTop: 2, color: 'var(--text-muted)' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: f.note ? 3 : 0 }}>
          <span style={{ fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.05em', color, border: `1px solid ${color}`, borderRadius: 20, padding: '1px 7px' }}>{label}</span>
          {addressLabel && <span style={{ fontSize: 10.5, fontFamily: 'monospace', color: 'var(--accent)' }}>{addressLabel}</span>}
          {f.status === 'pending' && <span style={{ fontSize: 10.5, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{f.due_date ? new Date(f.due_date).toLocaleDateString() : 'No due date'}</span>}
          {(f.sent_at || f.completed_at) && (
            <span style={{ fontSize: 10.5, fontFamily: 'monospace', color: 'var(--ok)' }}>
              {f.channel === 'email' ? 'Emailed' : 'Logged'} {new Date(f.sent_at || f.completed_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
            </span>
          )}
        </div>
        {f.note && <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{f.note}</p>}
      </div>
      <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
        {f.status === 'pending' && (
          <>
            {f.due_date && (
              <a
                href={googleCalendarLink({ title: `Follow-up: ${location || 'customer'}`, date: f.due_date, details: f.note || '' })}
                target="_blank" rel="noopener noreferrer"
                title="Add to Google Calendar"
                style={{ ...iconBtn, textDecoration: 'none' }}
              >
                <CalendarPlus className="size-3.5" />
              </a>
            )}
            <button onClick={() => onSend(f)} disabled={!hasEmail || sending === f.id} title={hasEmail ? 'Send follow-up email now' : 'No customer email on file'} style={{ ...iconBtn, color: hasEmail ? 'var(--accent)' : 'var(--text-muted)', cursor: hasEmail ? 'pointer' : 'not-allowed', opacity: sending === f.id ? 0.5 : 1 }}>
              <Send className="size-3.5" />
            </button>
            <button onClick={() => onMarkDone(f)} title="Mark done" style={{ ...iconBtn, color: 'var(--ok)' }}><Check className="size-3.5" /></button>
          </>
        )}
        {f.status !== 'pending' && (
          <button onClick={() => onReopen(f)} title="Reopen" style={iconBtn}><RotateCcw className="size-3.5" /></button>
        )}
        <button onClick={() => onDelete(f)} title="Delete" style={iconBtn}><Trash2 className="size-3.5" /></button>
      </div>
    </div>
  )
}

function PropertyPicker({ properties, value, onChange }) {
  if (properties.length <= 1) return null
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[220px] mb-2">
        <SelectValue placeholder="Which property?" />
      </SelectTrigger>
      <SelectContent>
        {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.address}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}

function LogContactForm({ properties, defaultPropertyId, onLog }) {
  const [propertyId, setPropertyId] = useState(defaultPropertyId)
  const [channel, setChannel] = useState('call')
  const [note, setNote] = useState('')
  const [contactedAt, setContactedAt] = useState(nowLocalInput)
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!note.trim()) return
    setSaving(true)
    const iso = contactedAt ? new Date(contactedAt).toISOString() : new Date().toISOString()
    await onLog(propertyId || defaultPropertyId, channel, note, iso)
    setNote('')
    setContactedAt(nowLocalInput())
    setSaving(false)
  }

  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 6, padding: 10, marginBottom: 10, background: 'var(--bg)' }}>
      <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Log a call or text</div>
      <PropertyPicker properties={properties} value={propertyId} onChange={setPropertyId} />
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        {['call', 'text', 'note'].map(c => {
          const Icon = CHANNEL_META[c].icon
          return (
            <button
              key={c}
              onClick={() => setChannel(c)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontFamily: 'monospace', textTransform: 'uppercase',
                padding: '4px 9px', borderRadius: 20, cursor: 'pointer',
                border: `1px solid ${channel === c ? 'var(--accent)' : 'var(--line)'}`,
                color: channel === c ? 'var(--accent)' : 'var(--text-muted)', background: 'transparent',
              }}
            >
              <Icon className="size-3" /> {CHANNEL_META[c].label}
            </button>
          )
        })}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 6 }}>
        <span style={{ fontSize: 10.5, fontFamily: 'monospace', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>When</span>
        <input
          type="datetime-local"
          value={contactedAt}
          onChange={e => setContactedAt(e.target.value)}
          style={{ fontSize: 13, padding: '6px 10px', border: '1px solid var(--line)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', width: 220 }}
        />
      </div>
      <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="What happened? (e.g. left a voicemail about scheduling the follow-up report)" rows={2} className="mb-2" />
      <Button onClick={submit} disabled={saving || !note.trim()} className="flex gap-1.5 text-[11.5px] font-bold uppercase tracking-wide h-auto py-2 px-3">
        <Plus className="size-3.5" /> {saving ? 'Logging…' : 'Log Contact'}
      </Button>
    </div>
  )
}

function SendEmailForm({ properties, defaultPropertyId, templates, contact, onSend, sending }) {
  const [propertyId, setPropertyId] = useState(defaultPropertyId)
  const [templateId, setTemplateId] = useState('')
  const [message, setMessage] = useState('')

  function pickTemplate(id) {
    setTemplateId(id)
    if (id === '__none__') { setMessage(''); return }
    const t = templates.find(t => t.id === id)
    if (t) {
      const property = properties.find(p => p.id === (propertyId || defaultPropertyId)) || properties[0]
      setMessage(fillTemplate(t.body, { address: property?.address, name: contact.customer_name }))
    }
  }

  const hasEmail = !!contact.customer_email
  const blocked = contact.unsubscribed

  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 6, padding: 10, marginBottom: 10, background: 'var(--bg)' }}>
      <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Send an email</div>
      {blocked && <p style={{ fontSize: 12, color: 'var(--warn)', margin: '0 0 8px' }}>This customer has unsubscribed — sending is disabled.</p>}
      {!hasEmail && <p style={{ fontSize: 12, color: 'var(--warn)', margin: '0 0 8px' }}>No customer email on file.</p>}
      <PropertyPicker properties={properties} value={propertyId} onChange={setPropertyId} />
      <Select value={templateId || '__none__'} onValueChange={pickTemplate}>
        <SelectTrigger className="w-[260px] mb-2">
          <SelectValue placeholder="Template (optional)" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">Custom message — no template</SelectItem>
          {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <Textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Message body…" rows={4} className="mb-2" />
      <Button
        onClick={() => onSend(propertyId || defaultPropertyId, templateId === '__none__' ? '' : templateId, message)}
        disabled={sending || !hasEmail || blocked}
        className="flex gap-1.5 text-[11.5px] font-bold uppercase tracking-wide h-auto py-2 px-3"
      >
        <Send className="size-3.5" /> {sending ? 'Sending…' : 'Send Email'}
      </Button>
    </div>
  )
}

function CustomerGroupRow({ group, expanded, onToggle, templates, onSaveField, onSaveProperty, onToggleUnsubscribed, onAddFollowup, onLogContact, onSendEmail, onSend, onMarkDone, onReopen, onDelete, sending, discounts, onAddPayment, onSetPaymentStatus, onDeletePayment }) {
  const [dueDate, setDueDate] = useState('')
  const [note, setNote] = useState('')
  const [dueDatePropertyId, setDueDatePropertyId] = useState(group.properties[0].id)
  const [saving, setSaving] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const nf = group.nextFollowup
  const overdue = isOverdue(nf)
  const multi = group.properties.length > 1

  async function schedule() {
    setSaving(true)
    await onAddFollowup(dueDatePropertyId, dueDate || null, note)
    setDueDate('')
    setNote('')
    setSaving(false)
  }

  const statuses = new Set(group.properties.map(p => p.report_status || 'none'))
  const singleStatus = statuses.size === 1 ? [...statuses][0] : null
  const reportBadge = singleStatus ? (REPORT_BADGE[singleStatus] || { label: 'Not started', color: 'var(--text-muted)' }) : { label: 'Multiple', color: 'var(--text-muted)' }

  const sources = new Set(group.properties.map(p => p.lead_source).filter(Boolean))
  const leadSourceLabel = sources.size === 1 ? [...sources][0] : sources.size > 1 ? 'Multiple sources' : null

  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 6, marginBottom: 8, background: 'var(--surface)' }}>
      <div
        onClick={onToggle}
        style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 0.9fr 0.9fr 0.9fr 22px 22px', gap: 10, alignItems: 'center', padding: '10px 12px', cursor: 'pointer' }}
      >
        <div style={{ minWidth: 0 }}>
          {multi ? (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {group.customer_name || `${group.properties.length} properties`}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {group.properties.map(p => (
                  <AddressField key={p.id} property={p} onSave={(id, v) => onSaveProperty(id, 'address', v)} textStyle={{ fontSize: 11, color: 'var(--accent)' }} />
                ))}
              </div>
            </>
          ) : (
            <>
              <AddressField property={group.properties[0]} onSave={(id, v) => onSaveProperty(id, 'address', v)} textStyle={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }} />
              {group.customer_name && <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{group.customer_name}</span>}
            </>
          )}
        </div>

        <div style={{ minWidth: 0 }}>
          <EditableField value={group.customer_email} placeholder="+ add email" onSave={v => onSaveField(group, 'customer_email', v)} type="email" />
        </div>

        <div style={{ minWidth: 0 }}>
          <EditableField value={group.customer_phone} placeholder="+ add phone" onSave={v => onSaveField(group, 'customer_phone', v)} type="tel" />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.05em', color: reportBadge.color, border: `1px solid ${reportBadge.color}`, borderRadius: 20, padding: '2px 8px' }}>
            {reportBadge.label}
          </span>
          {leadSourceLabel && (
            <span title="Lead source" style={{ fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', border: '1px solid var(--line)', borderRadius: 20, padding: '2px 8px' }}>
              {leadSourceLabel}
            </span>
          )}
          {group.unsubscribed && (
            <span title="Unsubscribed from follow-up emails" style={{ fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--warn)', border: '1px solid var(--warn)', borderRadius: 20, padding: '2px 6px', display: 'flex', alignItems: 'center', gap: 3 }}>
              <BellOff className="size-2.5" /> Opted out
            </span>
          )}
        </div>

        <div style={{ fontSize: 12, color: overdue ? 'var(--warn)' : 'var(--text)', fontWeight: overdue ? 700 : 400 }}>
          {nf ? `${overdue ? 'Overdue ' : ''}${nf.due_date ? new Date(nf.due_date).toLocaleDateString() : 'Unscheduled'}` : <span style={{ color: 'var(--text-muted)' }}>None scheduled</span>}
        </div>

        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {group.lastContact ? new Date(group.lastContact).toLocaleDateString() : '—'}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={e => { e.stopPropagation(); setEditOpen(true) }}
            title="Edit details"
            style={{ ...iconBtn, padding: 3 }}
          >
            <Pencil className="size-3.5" />
          </button>
        </div>

        <div style={{ color: 'var(--text-muted)', display: 'flex', justifyContent: 'center' }}>
          {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </div>
      </div>

      {editOpen && (
        <EditModal onClose={() => setEditOpen(false)}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>
            {group.customer_name || (multi ? `${group.properties.length} properties` : group.properties[0].address)}
          </h3>
          <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '0 0 14px' }}>Edit contact info, lead source, and status.</p>

          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 10.5, fontFamily: 'monospace', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Name</span>
              <EditableField value={group.customer_name} placeholder="+ add name" onSave={v => onSaveField(group, 'customer_name', v)} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 10.5, fontFamily: 'monospace', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Email</span>
              <EditableField value={group.customer_email} placeholder="+ add email" onSave={v => onSaveField(group, 'customer_email', v)} type="email" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 10.5, fontFamily: 'monospace', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Phone</span>
              <EditableField value={group.customer_phone} placeholder="+ add phone" onSave={v => onSaveField(group, 'customer_phone', v)} type="tel" />
            </div>
          </div>

          {group.properties.map(p => (
            <PropertyDetailsCard key={p.id} property={p} showAddress={multi} onSave={onSaveProperty} />
          ))}
        </EditModal>
      )}

      {expanded && (
        <div onClick={e => e.stopPropagation()} style={{ borderTop: '1px solid var(--line)', padding: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Name</span>
              <EditableField value={group.customer_name} placeholder="+ add name" onSave={v => onSaveField(group, 'customer_name', v)} />
            </div>
            <button
              onClick={() => onToggleUnsubscribed(group)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.04em', color: group.unsubscribed ? 'var(--ok)' : 'var(--warn)', background: 'none', border: `1px solid ${group.unsubscribed ? 'var(--ok)' : 'var(--warn)'}`, borderRadius: 20, padding: '4px 10px', cursor: 'pointer' }}
            >
              {group.unsubscribed ? <><Bell className="size-3" /> Resubscribe</> : <><BellOff className="size-3" /> Mark unsubscribed</>}
            </button>
          </div>

          <div style={{ marginBottom: 10 }}>
            {group.properties.map(p => (
              <PropertyDetailsCard key={p.id} property={p} showAddress={multi} onSave={onSaveProperty} />
            ))}
          </div>

          {group.followups.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              {group.followups.map(f => (
                <HistoryRow
                  key={f.id}
                  f={f}
                  addressLabel={multi ? group.properties.find(p => p.id === f.property_id)?.address : null}
                  location={group.properties.find(p => p.id === f.property_id)?.address || group.properties[0].address}
                  sending={sending}
                  hasEmail={!!group.customer_email}
                  onSend={onSend}
                  onMarkDone={onMarkDone}
                  onReopen={onReopen}
                  onDelete={onDelete}
                />
              ))}
            </div>
          )}

          <SendEmailForm
            properties={group.properties}
            defaultPropertyId={group.properties[0].id}
            templates={templates}
            contact={group}
            sending={sending === 'email'}
            onSend={(propertyId, templateId, message) => onSendEmail(propertyId, templateId, message)}
          />

          <LogContactForm
            properties={group.properties}
            defaultPropertyId={group.properties[0].id}
            onLog={onLogContact}
          />

          <PaymentsSection
            properties={group.properties}
            defaultPropertyId={group.properties[0].id}
            payments={group.payments}
            discounts={discounts}
            onAdd={onAddPayment}
            onSetStatus={onSetPaymentStatus}
            onDelete={onDeletePayment}
          />

          <div style={{ border: '1px solid var(--line)', borderRadius: 6, padding: 10, background: 'var(--bg)' }}>
            <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Schedule a follow-up</div>
            <PropertyPicker properties={group.properties} value={dueDatePropertyId} onChange={setDueDatePropertyId} />
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                style={{ fontSize: 13, padding: '6px 10px', border: '1px solid var(--line)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit' }}
              />
            </div>
            <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="What's this follow-up about?" rows={2} className="mb-2" />
            <Button onClick={schedule} disabled={saving} className="flex gap-1.5 text-[11.5px] font-bold uppercase tracking-wide h-auto py-2 px-3">
              <Plus className="size-3.5" /> {saving ? 'Saving…' : 'Schedule Follow-up'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function TemplatesPanel({ templates, onAdd, onUpdate, onDelete }) {
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)

  function startAdd() { setAdding(true); setEditingId(null); setName(''); setSubject(''); setBody('') }
  function startEdit(t) { setEditingId(t.id); setAdding(false); setName(t.name); setSubject(t.subject); setBody(t.body) }
  function cancel() { setAdding(false); setEditingId(null) }

  async function save() {
    if (!name.trim() || !subject.trim() || !body.trim()) return
    setSaving(true)
    if (editingId) await onUpdate(editingId, { name, subject, body })
    else await onAdd({ name, subject, body })
    setSaving(false)
    cancel()
  }

  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 6, marginBottom: 16, background: 'var(--surface)', maxWidth: 720 }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer' }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>Message Templates ({templates.length})</span>
        {open ? <ChevronDown className="size-4" style={{ color: 'var(--text-muted)' }} /> : <ChevronRight className="size-4" style={{ color: 'var(--text-muted)' }} />}
      </button>
      {open && (
        <div style={{ borderTop: '1px solid var(--line)', padding: 14 }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 0, marginBottom: 10, lineHeight: 1.6 }}>
            Use <code>{'{{address}}'}</code> and <code>{'{{name}}'}</code> in the subject/body — they're filled in automatically when a template is picked in the Send flow.
          </p>
          {templates.map(t => (
            <div key={t.id} style={{ border: '1px solid var(--line)', borderRadius: 6, padding: 10, marginBottom: 8, background: 'var(--bg)' }}>
              {editingId === t.id ? (
                <div>
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="Template name" style={{ fontSize: 12.5, padding: '5px 8px', border: '1px solid var(--line)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text)', width: '100%', marginBottom: 6, fontFamily: 'inherit' }} />
                  <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject" style={{ fontSize: 12.5, padding: '5px 8px', border: '1px solid var(--line)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text)', width: '100%', marginBottom: 6, fontFamily: 'inherit' }} />
                  <Textarea value={body} onChange={e => setBody(e.target.value)} rows={4} className="mb-2" />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Button onClick={save} disabled={saving} className="text-[11px] font-bold uppercase h-auto py-1.5 px-3">Save</Button>
                    <Button variant="outline" onClick={cancel} className="text-[11px] font-bold uppercase h-auto py-1.5 px-3">Cancel</Button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{t.name}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{t.subject}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button onClick={() => startEdit(t)} style={iconBtn} title="Edit"><Pencil className="size-3.5" /></button>
                    <button onClick={() => onDelete(t.id)} style={iconBtn} title="Delete"><Trash2 className="size-3.5" /></button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {adding ? (
            <div style={{ border: '1px solid var(--line)', borderRadius: 6, padding: 10, background: 'var(--bg)' }}>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Template name" style={{ fontSize: 12.5, padding: '5px 8px', border: '1px solid var(--line)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text)', width: '100%', marginBottom: 6, fontFamily: 'inherit' }} />
              <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject" style={{ fontSize: 12.5, padding: '5px 8px', border: '1px solid var(--line)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text)', width: '100%', marginBottom: 6, fontFamily: 'inherit' }} />
              <Textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Body — use {{address}} and {{name}}" rows={4} className="mb-2" />
              <div style={{ display: 'flex', gap: 6 }}>
                <Button onClick={save} disabled={saving} className="text-[11px] font-bold uppercase h-auto py-1.5 px-3">{saving ? 'Saving…' : 'Add Template'}</Button>
                <Button variant="outline" onClick={cancel} className="text-[11px] font-bold uppercase h-auto py-1.5 px-3">Cancel</Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" onClick={startAdd} className="flex gap-1.5 text-[11.5px] font-bold uppercase tracking-wide h-auto py-2 px-3">
              <Plus className="size-3.5" /> New Template
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

function formatCents(cents) {
  return `$${(cents / 100).toFixed(2)}`
}

function DiscountsPanel({ discounts, onAdd, onUpdate, onDelete }) {
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [code, setCode] = useState('')
  const [label, setLabel] = useState('')
  const [kind, setKind] = useState('flat')
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)

  function startAdd() { setAdding(true); setCode(''); setLabel(''); setKind('flat'); setAmount('') }

  async function save() {
    if (!code.trim() || !amount) return
    setSaving(true)
    await onAdd({ code, label, kind, amount })
    setSaving(false)
    setAdding(false)
  }

  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 6, marginBottom: 16, background: 'var(--surface)', maxWidth: 720 }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer' }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>Discount Codes ({discounts.length})</span>
        {open ? <ChevronDown className="size-4" style={{ color: 'var(--text-muted)' }} /> : <ChevronRight className="size-4" style={{ color: 'var(--text-muted)' }} />}
      </button>
      {open && (
        <div style={{ borderTop: '1px solid var(--line)', padding: 14 }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 0, marginBottom: 10, lineHeight: 1.6 }}>
            Self-managed, independent of any payment processor — type a code here when recording a payment on a customer's Payments section to apply it.
          </p>
          {discounts.map(d => (
            <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, border: '1px solid var(--line)', borderRadius: 6, padding: '8px 10px', marginBottom: 6, background: 'var(--bg)', opacity: d.active ? 1 : 0.5 }}>
              <div style={{ minWidth: 0 }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, fontFamily: 'monospace', color: 'var(--text)' }}>{d.code}</span>
                <span style={{ fontSize: 11.5, color: 'var(--text-muted)', marginLeft: 8 }}>
                  {d.kind === 'percent' ? `${d.amount}% off` : `$${Number(d.amount).toFixed(2)} off`}{d.label ? ` — ${d.label}` : ''}{!d.active ? ' (inactive)' : ''}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <button onClick={() => onUpdate(d.id, { active: !d.active })} title={d.active ? 'Deactivate' : 'Activate'} style={iconBtn}>
                  {d.active ? <BellOff className="size-3.5" /> : <Bell className="size-3.5" />}
                </button>
                <button onClick={() => onDelete(d.id)} title="Delete" style={iconBtn}><Trash2 className="size-3.5" /></button>
              </div>
            </div>
          ))}

          {adding ? (
            <div style={{ border: '1px solid var(--line)', borderRadius: 6, padding: 10, background: 'var(--bg)' }}>
              <input value={code} onChange={e => setCode(e.target.value)} placeholder="Code, e.g. SPRING10" style={{ fontSize: 12.5, padding: '5px 8px', border: '1px solid var(--line)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text)', width: '100%', marginBottom: 6, fontFamily: 'inherit' }} />
              <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Label (optional, e.g. Spring promo)" style={{ fontSize: 12.5, padding: '5px 8px', border: '1px solid var(--line)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text)', width: '100%', marginBottom: 6, fontFamily: 'inherit' }} />
              <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <Select value={kind} onValueChange={setKind}>
                  <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flat">Flat $ off</SelectItem>
                    <SelectItem value="percent">% off</SelectItem>
                  </SelectContent>
                </Select>
                <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder={kind === 'percent' ? 'e.g. 10' : 'e.g. 25.00'} style={{ fontSize: 12.5, padding: '5px 8px', border: '1px solid var(--line)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text)', width: 120, fontFamily: 'inherit' }} />
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <Button onClick={save} disabled={saving} className="text-[11px] font-bold uppercase h-auto py-1.5 px-3">{saving ? 'Saving…' : 'Add Code'}</Button>
                <Button variant="outline" onClick={() => setAdding(false)} className="text-[11px] font-bold uppercase h-auto py-1.5 px-3">Cancel</Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" onClick={startAdd} className="flex gap-1.5 text-[11.5px] font-bold uppercase tracking-wide h-auto py-2 px-3">
              <Plus className="size-3.5" /> New Discount Code
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

const PAYMENT_STATUS_META = {
  pending:  { label: 'Pending',  color: 'var(--accent)' },
  paid:     { label: 'Paid',     color: 'var(--ok)' },
  refunded: { label: 'Refunded', color: 'var(--text-muted)' },
  failed:   { label: 'Failed',   color: 'var(--warn)' },
}

function PaymentsSection({ properties, defaultPropertyId, payments, discounts, onAdd, onSetStatus, onDelete }) {
  const [propertyId, setPropertyId] = useState(defaultPropertyId)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('cash')
  const [discountCode, setDiscountCode] = useState('')
  const [status, setStatus] = useState('paid')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    const amountNum = Number(amount)
    if (!Number.isFinite(amountNum) || amountNum <= 0) return
    setSaving(true)
    const ok = await onAdd({
      propertyId: propertyId || defaultPropertyId, amountCents: Math.round(amountNum * 100),
      method, status, discountCode: discountCode || undefined, notes,
    })
    if (ok) { setAmount(''); setDiscountCode(''); setNotes('') }
    setSaving(false)
  }

  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 6, padding: 10, marginBottom: 10, background: 'var(--bg)' }}>
      <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Payments</div>

      {payments.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          {payments.map(p => {
            const meta = PAYMENT_STATUS_META[p.status] || PAYMENT_STATUS_META.pending
            return (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, border: '1px solid var(--line)', borderRadius: 6, padding: '8px 10px', marginBottom: 6, background: 'var(--surface)' }}>
                <div style={{ minWidth: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{formatCents(p.amount_cents)}</span>
                  <span style={{ fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.05em', color: meta.color, border: `1px solid ${meta.color}`, borderRadius: 20, padding: '1px 7px', marginLeft: 8 }}>{meta.label}</span>
                  {p.method && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8, textTransform: 'capitalize' }}>{p.method}</span>}
                  {p.discount_code && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>({p.discount_code}: -{formatCents(p.discount_amount_cents)})</span>}
                  {p.notes && <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3 }}>{p.notes}</div>}
                  <div style={{ fontSize: 10.5, fontFamily: 'monospace', color: 'var(--text-muted)', marginTop: 3 }}>{new Date(p.created_at).toLocaleDateString()}</div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {p.status !== 'paid' && <button onClick={() => onSetStatus(p.id, 'paid')} title="Mark paid" style={{ ...iconBtn, color: 'var(--ok)' }}><Check className="size-3.5" /></button>}
                  {p.status === 'paid' && <button onClick={() => onSetStatus(p.id, 'refunded')} title="Mark refunded" style={iconBtn}><RotateCcw className="size-3.5" /></button>}
                  <button onClick={() => onDelete(p.id)} title="Delete" style={iconBtn}><Trash2 className="size-3.5" /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <PropertyPicker properties={properties} value={propertyId} onChange={setPropertyId} />
      <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
        <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount $" style={{ fontSize: 13, padding: '6px 10px', border: '1px solid var(--line)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)', width: 110, fontFamily: 'inherit' }} />
        <Select value={method} onValueChange={setMethod}>
          <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="cash">Cash</SelectItem>
            <SelectItem value="check">Check</SelectItem>
            <SelectItem value="venmo">Venmo</SelectItem>
            <SelectItem value="stripe">Stripe</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
        <input list="crm-discount-codes" value={discountCode} onChange={e => setDiscountCode(e.target.value)} placeholder="Discount code (optional)" style={{ fontSize: 13, padding: '6px 10px', border: '1px solid var(--line)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)', width: 160, fontFamily: 'inherit' }} />
        <datalist id="crm-discount-codes">
          {discounts.filter(d => d.active).map(d => <option key={d.id} value={d.code} />)}
        </datalist>
      </div>
      <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)" rows={2} className="mb-2" />
      <Button onClick={submit} disabled={saving || !amount} className="flex gap-1.5 text-[11.5px] font-bold uppercase tracking-wide h-auto py-2 px-3">
        <Plus className="size-3.5" /> {saving ? 'Saving…' : 'Record Payment'}
      </Button>
    </div>
  )
}

function customerKey(p) {
  const email = (p.customer_email || '').trim().toLowerCase()
  if (email) return `email:${email}`
  const phone = (p.customer_phone || '').trim()
  if (phone) return `phone:${phone}`
  return `prop:${p.id}`
}

export default function CrmPage() {
  const { confirmDialog, alertDialog } = useConfirmDialog()
  const [properties, setProperties] = useState([])
  const [followups, setFollowups] = useState([])
  const [templates, setTemplates] = useState([])
  const [payments, setPayments] = useState([])
  const [discounts, setDiscounts] = useState([])
  const [fetching, setFetching] = useState(true)
  const [search, setSearch] = useState('')
  const [expandedKey, setExpandedKey] = useState(null)
  const [sending, setSending] = useState(null)
  const [loadError, setLoadError] = useState(null)

  function load() {
    setFetching(true)
    setLoadError(null)
    Promise.all([
      supabase.from('properties').select('id, address, job_number, customer_name, customer_email, customer_phone, customer_notified_at, unsubscribed, homeowner_status, report_status, lead_source, lead_notes').order('address'),
      authFetch('/api/crm/followups').then(res => res.json()),
      authFetch('/api/crm/templates').then(res => res.json()),
      authFetch('/api/crm/payments').then(res => res.json()),
      authFetch('/api/crm/discounts').then(res => res.json()),
    ]).then(([propsRes, followupsData, templatesData, paymentsData, discountsData]) => {
      if (propsRes.error) {
        // Most likely cause: a migration (013_customer_contact.sql,
        // 014_crm_phase2.sql, or 015_booking_payments.sql) hasn't been run
        // yet — a missing column fails this select outright, not just that
        // one field, and would otherwise silently render an empty table.
        setLoadError(propsRes.error.message)
        setProperties([])
      } else {
        setProperties(propsRes.data || [])
      }
      setFollowups(followupsData.followups || [])
      setTemplates(templatesData.templates || [])
      setPayments(paymentsData.payments || [])
      setDiscounts(discountsData.discounts || [])
    }).finally(() => setFetching(false))
  }

  useEffect(() => { load() }, [])

  async function saveField(group, field, value) {
    const ids = group.properties.map(p => p.id)
    setProperties(prev => prev.map(p => ids.includes(p.id) ? { ...p, [field]: value || null } : p))
    const { error } = await supabase.from('properties').update({ [field]: value || null }).in('id', ids)
    if (error) await alertDialog(`Could not update: ${error.message}`)
  }

  async function toggleUnsubscribed(group) {
    const next = !group.unsubscribed
    const ids = group.properties.map(p => p.id)
    setProperties(prev => prev.map(p => ids.includes(p.id) ? { ...p, unsubscribed: next } : p))
    const { error } = await supabase.from('properties').update({ unsubscribed: next, unsubscribed_at: next ? new Date().toISOString() : null }).in('id', ids)
    if (error) await alertDialog(`Could not update: ${error.message}`)
  }

  async function addFollowup(propertyId, dueDate, note) {
    try {
      const res = await authFetch('/api/crm/followups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId, dueDate, note }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to save')
      load()
    } catch (err) {
      await alertDialog(err.message)
    }
  }

  async function logContact(propertyId, channel, note, completedAt) {
    try {
      const res = await authFetch('/api/crm/followups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId, channel, note, status: 'done', completedAt }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to save')
      load()
    } catch (err) {
      await alertDialog(err.message)
    }
  }

  async function sendEmail(propertyId, templateId, message) {
    setSending('email')
    try {
      const res = await authFetch('/api/crm/send-followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId, templateId: templateId || undefined, message }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Send failed')
      load()
    } catch (err) {
      await alertDialog(err.message)
    } finally {
      setSending(null)
    }
  }

  async function sendPendingNow(f) {
    setSending(f.id)
    try {
      const res = await authFetch('/api/crm/send-followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId: f.property_id, followupId: f.id, message: f.note }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Send failed')
      load()
    } catch (err) {
      await alertDialog(err.message)
    } finally {
      setSending(null)
    }
  }

  async function setStatus(f, status) {
    setFollowups(prev => prev.map(x => x.id === f.id ? { ...x, status } : x))
    await authFetch(`/api/crm/followups/${f.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }).catch(() => {})
    load()
  }

  async function deleteFollowup(f) {
    if (!(await confirmDialog('Delete this entry?'))) return
    setFollowups(prev => prev.filter(x => x.id !== f.id))
    await authFetch(`/api/crm/followups/${f.id}`, { method: 'DELETE' }).catch(() => {})
  }

  async function addTemplate(t) {
    const res = await authFetch('/api/crm/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(t) })
    if (!res.ok) { await alertDialog((await res.json()).error || 'Failed to save template'); return }
    load()
  }
  async function updateTemplate(id, t) {
    const res = await authFetch(`/api/crm/templates/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(t) })
    if (!res.ok) { await alertDialog((await res.json()).error || 'Failed to save template'); return }
    load()
  }
  async function deleteTemplate(id) {
    if (!(await confirmDialog('Delete this template?'))) return
    await authFetch(`/api/crm/templates/${id}`, { method: 'DELETE' }).catch(() => {})
    load()
  }

  async function addPayment(payment) {
    const res = await authFetch('/api/crm/payments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payment) })
    if (!res.ok) { await alertDialog((await res.json()).error || 'Failed to save payment'); return false }
    load()
    return true
  }
  async function setPaymentStatus(id, status) {
    const res = await authFetch(`/api/crm/payments/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    if (!res.ok) { await alertDialog((await res.json()).error || 'Failed to update payment'); return }
    load()
  }
  async function deletePayment(id) {
    if (!(await confirmDialog('Delete this payment record?'))) return
    await authFetch(`/api/crm/payments/${id}`, { method: 'DELETE' }).catch(() => {})
    load()
  }

  async function addDiscount(d) {
    const res = await authFetch('/api/crm/discounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) })
    if (!res.ok) { await alertDialog((await res.json()).error || 'Failed to save discount'); return }
    load()
  }
  async function updateDiscount(id, d) {
    const res = await authFetch(`/api/crm/discounts/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) })
    if (!res.ok) { await alertDialog((await res.json()).error || 'Failed to save discount'); return }
    load()
  }
  async function deleteDiscount(id) {
    if (!(await confirmDialog('Delete this discount code?'))) return
    await authFetch(`/api/crm/discounts/${id}`, { method: 'DELETE' }).catch(() => {})
    load()
  }

  const groupMap = new Map()
  properties.forEach(p => {
    const key = customerKey(p)
    if (!groupMap.has(key)) groupMap.set(key, [])
    groupMap.get(key).push(p)
  })

  const groups = Array.from(groupMap.entries()).map(([key, props]) => {
    const ids = props.map(p => p.id)
    const groupFollowups = followups.filter(f => ids.includes(f.property_id))
    const groupPayments = payments.filter(pay => ids.includes(pay.property_id)).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    const pending = groupFollowups.filter(f => f.status === 'pending').sort((a, b) => {
      if (!a.due_date) return 1
      if (!b.due_date) return -1
      return new Date(a.due_date) - new Date(b.due_date)
    })
    const sentDates = groupFollowups.map(f => f.sent_at).filter(Boolean)
    props.forEach(p => { if (p.customer_notified_at) sentDates.push(p.customer_notified_at) })
    sentDates.sort()
    return {
      key,
      properties: props,
      customer_name: props.find(p => p.customer_name)?.customer_name || null,
      customer_email: props.find(p => p.customer_email)?.customer_email || null,
      customer_phone: props.find(p => p.customer_phone)?.customer_phone || null,
      unsubscribed: props.some(p => p.unsubscribed),
      followups: groupFollowups.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
      payments: groupPayments,
      nextFollowup: pending[0] || null,
      lastContact: sentDates.length ? sentDates[sentDates.length - 1] : null,
    }
  }).sort((a, b) => {
    const aOver = isOverdue(a.nextFollowup)
    const bOver = isOverdue(b.nextFollowup)
    if (aOver !== bOver) return aOver ? -1 : 1
    const aDate = a.nextFollowup?.due_date
    const bDate = b.nextFollowup?.due_date
    if (aDate && bDate) return new Date(aDate) - new Date(bDate)
    if (aDate) return -1
    if (bDate) return 1
    return (a.properties[0]?.address || '').localeCompare(b.properties[0]?.address || '')
  })

  const q = search.trim().toLowerCase()
  const visible = q ? groups.filter(g => [g.customer_name, g.customer_email, g.customer_phone, ...g.properties.map(p => p.address)].some(v => v?.toLowerCase().includes(q))) : groups

  const overdueCount = groups.filter(g => isOverdue(g.nextFollowup)).length

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginTop: 0, marginBottom: 16, maxWidth: 720 }}>
        Grouped by customer — a customer with more than one property shows as one row with every address linked. Click a row to see contact history, log a call/text, send a templated email, or schedule the next follow-up.
        {overdueCount > 0 && <span style={{ color: 'var(--warn)', fontWeight: 700 }}> {overdueCount} overdue.</span>}
      </p>

      {loadError && (
        <div style={{ border: '1px solid var(--warn)', borderRadius: 6, padding: '10px 12px', marginBottom: 14, background: 'var(--surface)', maxWidth: 720 }}>
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--warn)', fontFamily: 'monospace' }}>Couldn't load properties: {loadError}</p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
            Run <code>supabase/migrations/013_customer_contact.sql</code> and <code>supabase/migrations/014_crm_phase2.sql</code> in the Supabase SQL editor, then reload.
          </p>
        </div>
      )}

      <TemplatesPanel templates={templates} onAdd={addTemplate} onUpdate={updateTemplate} onDelete={deleteTemplate} />
      <DiscountsPanel discounts={discounts} onAdd={addDiscount} onUpdate={updateDiscount} onDelete={deleteDiscount} />

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search name, address, email, phone…"
        style={{ fontSize: 13, padding: '7px 10px', border: '1px solid var(--line)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', width: 280, marginBottom: 14 }}
      />

      {!fetching && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 0.9fr 0.9fr 0.9fr 22px', gap: 10, padding: '0 12px 6px', fontSize: 10.5, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
          <span>Address</span>
          <span>Email</span>
          <span>Phone</span>
          <span>Report</span>
          <span>Next Follow-up</span>
          <span>Last Contact</span>
          <span />
        </div>
      )}

      {fetching && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading…</p>}
      {!fetching && visible.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No customers match.</p>}
      {!fetching && visible.map(group => (
        <CustomerGroupRow
          key={group.key}
          group={group}
          expanded={expandedKey === group.key}
          onToggle={() => setExpandedKey(k => k === group.key ? null : group.key)}
          templates={templates}
          onSaveField={saveField}
          onToggleUnsubscribed={toggleUnsubscribed}
          onAddFollowup={addFollowup}
          onLogContact={logContact}
          onSendEmail={sendEmail}
          onSend={sendPendingNow}
          onMarkDone={f => setStatus(f, 'done')}
          onReopen={f => setStatus(f, 'pending')}
          onDelete={deleteFollowup}
          sending={sending}
          discounts={discounts}
          onAddPayment={addPayment}
          onSetPaymentStatus={setPaymentStatus}
          onDeletePayment={deletePayment}
        />
      ))}
    </div>
  )
}
