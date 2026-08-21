'use client'

import { useState, useEffect } from 'react'
import { authFetch } from '@/lib/authFetch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Trash2, FileText } from 'lucide-react'
import { useConfirmDialog } from '@/components/ConfirmDialogProvider'

function fmtDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function DocumentationPage() {
  const { confirmDialog, alertDialog } = useConfirmDialog()
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState(false)

  async function load(selectAfter) {
    setLoading(true)
    try {
      const res = await authFetch('/api/admin/documents')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not load documents')
      setDocuments(data.documents || [])
      if (selectAfter) select(data.documents.find(d => d.id === selectAfter) || data.documents[0])
      else if (!selectedId && data.documents.length > 0) select(data.documents[0])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function select(doc) {
    if (!doc) { setSelectedId(null); setTitle(''); setContent(''); setDirty(false); return }
    setSelectedId(doc.id)
    setTitle(doc.title)
    setContent(doc.content)
    setDirty(false)
  }

  async function createDoc() {
    setCreating(true)
    try {
      const res = await authFetch('/api/admin/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Untitled Document', content: '' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Create failed')
      await load(data.document.id)
    } catch (err) {
      await alertDialog('Could not create document: ' + err.message)
    } finally {
      setCreating(false)
    }
  }

  async function save() {
    if (!selectedId) return
    setSaving(true)
    try {
      const res = await authFetch(`/api/admin/documents/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setDocuments(prev => prev.map(d => (d.id === selectedId ? data.document : d)))
      setDirty(false)
    } catch (err) {
      await alertDialog('Could not save: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function remove(id) {
    if (!(await confirmDialog('Delete this document? This cannot be undone.'))) return
    try {
      const res = await authFetch(`/api/admin/documents/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Delete failed')
      const remaining = documents.filter(d => d.id !== id)
      setDocuments(remaining)
      if (selectedId === id) select(remaining[0])
    } catch (err) {
      await alertDialog('Could not delete: ' + err.message)
    }
  }

  const selectedDoc = documents.find(d => d.id === selectedId)

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
      <div style={{ width: 260, flexShrink: 0 }}>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 12 }}>
          Admin-only. Planning docs like PORTALS_AND_ROLES_PLAN.md and BOOKING_PAYMENTS_PLAN.md, stored here instead
          of only as repo files.
        </p>
        <Button onClick={createDoc} disabled={creating} className="flex gap-1.5 text-[11.5px] font-bold uppercase tracking-wide h-auto py-2 px-3 w-full mb-3">
          <Plus className="size-3.5" /> New Document
        </Button>

        {loading && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading…</p>}
        {error && <p style={{ fontSize: 13, color: 'var(--warn)' }}>{error}</p>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {documents.map(d => (
            <button
              key={d.id}
              onClick={() => select(d)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 8, textAlign: 'left', padding: '9px 10px', borderRadius: 6,
                border: '1px solid var(--line)', cursor: 'pointer', fontFamily: 'inherit',
                background: d.id === selectedId ? 'var(--surface-2)' : 'var(--surface)',
              }}
            >
              <FileText className="size-3.5" style={{ flexShrink: 0, marginTop: 2, color: d.id === selectedId ? 'var(--accent)' : 'var(--text-muted)' }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: d.id === selectedId ? 700 : 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</div>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{fmtDateTime(d.updated_at)}</div>
              </div>
            </button>
          ))}
          {!loading && documents.length === 0 && (
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>No documents yet.</p>
          )}
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {selectedDoc ? (
          <div style={{ border: '1px solid var(--line)', borderRadius: 6, background: 'var(--surface)', padding: 16 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
              <Input
                value={title}
                onChange={e => { setTitle(e.target.value); setDirty(true) }}
                style={{ fontSize: 15, fontWeight: 700 }}
                placeholder="Document title"
              />
              <Button onClick={save} disabled={!dirty || saving} className="text-[11px] font-bold uppercase h-auto py-2 px-3 whitespace-nowrap">
                {saving ? 'Saving…' : 'Save'}
              </Button>
              <button onClick={() => remove(selectedDoc.id)} title="Delete" style={{ background: 'none', border: '1px solid var(--line)', borderRadius: 6, padding: 8, cursor: 'pointer', color: 'var(--warn)', flexShrink: 0 }}>
                <Trash2 className="size-3.5" />
              </button>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
              {selectedDoc.created_by_name ? `Created by ${selectedDoc.created_by_name}` : ''}
              {selectedDoc.updated_by_name ? ` · Last edited by ${selectedDoc.updated_by_name}` : ''} · {fmtDateTime(selectedDoc.updated_at)}
            </p>
            <Textarea
              value={content}
              onChange={e => { setContent(e.target.value); setDirty(true) }}
              placeholder="Write in Markdown — this is stored as plain text, no live preview yet."
              style={{ fontFamily: 'monospace', fontSize: 12.5, minHeight: 520, lineHeight: 1.6 }}
            />
          </div>
        ) : (
          !loading && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Select a document, or create a new one.</p>
        )}
      </div>
    </div>
  )
}
