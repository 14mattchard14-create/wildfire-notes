'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { authFetch } from '@/lib/authFetch'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Check, Trash2, Plus } from 'lucide-react'

// Freeform "lessons learned" notes — the human-written half of the Report
// Quality feedback loop, living alongside the AI-draft-vs-Final A/B pairs
// on /quality. Each note is optionally tied to the property that prompted
// it. `applied` just tracks whether it's already been folded into the
// report-draft prompt by hand — this is a reference log, not an automatic
// injection point (see supabase/migrations/011_report_lessons.sql).

function LessonRow({ lesson, onToggleApplied, onDelete }) {
  const router = useRouter()
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', border: '1px solid var(--line)', borderRadius: 6, marginBottom: 8, background: 'var(--surface)', opacity: lesson.applied ? 0.65 : 1 }}>
      <button
        onClick={() => onToggleApplied(lesson)}
        title={lesson.applied ? 'Mark as not yet applied' : 'Mark as applied to the prompt'}
        style={{
          flexShrink: 0, width: 20, height: 20, borderRadius: '50%', marginTop: 1,
          border: `1.5px solid ${lesson.applied ? 'var(--ok)' : 'var(--line)'}`,
          background: lesson.applied ? 'var(--ok)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0,
        }}
      >
        {lesson.applied && <Check className="size-3" style={{ color: '#fff' }} />}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text)', lineHeight: 1.5, textDecoration: lesson.applied ? 'line-through' : 'none' }}>{lesson.note}</p>
        <div style={{ marginTop: 5, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10.5, fontFamily: 'monospace', color: 'var(--text-muted)' }}>
            {lesson.created_by_name || 'Unknown'} · {new Date(lesson.created_at).toLocaleDateString()}
          </span>
          {lesson.property_id && (
            <button
              onClick={() => router.push(`/manage/${lesson.property_id}/review`)}
              style={{ fontSize: 10.5, fontFamily: 'monospace', color: 'var(--accent)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline' }}
            >
              {lesson.properties?.address || 'View report'}
            </button>
          )}
          {lesson.applied && <span style={{ fontSize: 10.5, fontFamily: 'monospace', color: 'var(--ok)' }}>Applied {lesson.applied_at ? new Date(lesson.applied_at).toLocaleDateString() : ''}</span>}
        </div>
      </div>
      <button onClick={() => onDelete(lesson)} title="Delete" style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-muted)' }}>
        <Trash2 className="size-3.5" />
      </button>
    </div>
  )
}

export default function LessonsLearned() {
  const [lessons, setLessons] = useState([])
  const [properties, setProperties] = useState([])
  const [fetching, setFetching] = useState(true)
  const [note, setNote] = useState('')
  const [propertyId, setPropertyId] = useState('')
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('open') // 'open' | 'applied' | 'all'

  function load() {
    setFetching(true)
    Promise.all([
      authFetch('/api/lessons').then(res => res.json()),
      authFetch('/api/report-version?scope=all').then(res => res.json()).catch(() => ({ versions: [] })),
    ]).then(([lessonsData, versionsData]) => {
      setLessons(lessonsData.lessons || [])
      const seen = new Map()
      ;(versionsData.versions || []).forEach(v => { if (v.property_id && !seen.has(v.property_id)) seen.set(v.property_id, v.properties?.address || v.property_id) })
      setProperties(Array.from(seen.entries()).map(([id, address]) => ({ id, address })))
    }).finally(() => setFetching(false))
  }

  useEffect(() => { load() }, [])

  async function addLesson() {
    if (!note.trim()) return
    setSaving(true)
    try {
      const res = await authFetch('/api/lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note, propertyId: propertyId || null }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to save')
      setNote('')
      setPropertyId('')
      load()
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleApplied(lesson) {
    setLessons(prev => prev.map(l => l.id === lesson.id ? { ...l, applied: !l.applied } : l))
    await authFetch(`/api/lessons/${lesson.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applied: !lesson.applied }),
    }).catch(() => {})
    load()
  }

  async function deleteLesson(lesson) {
    if (!confirm('Delete this lesson?')) return
    setLessons(prev => prev.filter(l => l.id !== lesson.id))
    await authFetch(`/api/lessons/${lesson.id}`, { method: 'DELETE' }).catch(() => {})
  }

  const visible = lessons.filter(l => filter === 'all' ? true : filter === 'applied' ? l.applied : !l.applied)

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginTop: 0, marginBottom: 20, maxWidth: 640 }}>
        Short notes on what the AI got wrong (or right) — patterns worth folding into the report-draft prompt. Mark a note "applied" once you've actually updated the prompt for it, so this stays a useful backlog rather than a pile of everything ever noticed.
      </p>

      <div style={{ border: '1px solid var(--line)', borderRadius: 6, padding: 14, marginBottom: 20, background: 'var(--surface)', maxWidth: 640 }}>
        <Textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="e.g. AI keeps rating defensible-space clearance as 'Moderate' when photos clearly show dense brush within 5ft — should default to 'High' unless the photo shows otherwise."
          rows={3}
          className="mb-2"
        />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Select value={propertyId || '__none__'} onValueChange={v => setPropertyId(v === '__none__' ? '' : v)}>
            <SelectTrigger className="w-[260px]">
              <SelectValue placeholder="Tie to a property (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">General — not tied to a property</SelectItem>
              {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.address}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={addLesson} disabled={saving || !note.trim()} className="ml-auto gap-1.5 text-[12px] font-bold uppercase tracking-wide h-auto py-2.5 px-4">
            <Plus className="size-3.5" /> {saving ? 'Saving…' : 'Add Lesson'}
          </Button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {[['open', 'Open'], ['applied', 'Applied'], ['all', 'All']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            style={{
              fontSize: 11, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.04em',
              padding: '4px 10px', borderRadius: 20, cursor: 'pointer',
              border: `1px solid ${filter === key ? 'var(--accent)' : 'var(--line)'}`,
              color: filter === key ? 'var(--accent)' : 'var(--text-muted)',
              background: 'transparent',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {fetching && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading…</p>}
      {!fetching && visible.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No lessons here yet.</p>}
      {!fetching && visible.map(lesson => (
        <LessonRow key={lesson.id} lesson={lesson} onToggleApplied={toggleApplied} onDelete={deleteLesson} />
      ))}
    </div>
  )
}
