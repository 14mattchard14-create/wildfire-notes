'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { authFetch } from '@/lib/authFetch'
import { diffSectionSlices, sectionLabel, wordDiff } from '@/lib/reportSchema'
import { ChevronDown, ChevronRight, Sparkles, Pencil, CheckCircle2 } from 'lucide-react'

// The Activity log — every report_versions row across every property,
// grouped by property into a timeline (ai_draft → edit → edit → final),
// with a diff between each step and the one before it. This is the
// "documents all reports, changes" half of the feedback loop; the "capture
// why" half (freeform lessons-learned notes) lives on the Report Quality
// page (/quality) as its own tab, alongside the AI-draft-vs-Final A/B pairs.

const SOURCE_META = {
  ai_draft: { label: 'AI Draft', icon: Sparkles, color: 'var(--info)' },
  edit: { label: 'Edit', icon: Pencil, color: 'var(--text-muted)' },
  final: { label: 'Final Report', icon: CheckCircle2, color: 'var(--ok)' },
}

function groupByProperty(versions) {
  const byProperty = new Map()
  versions.forEach(v => {
    if (!byProperty.has(v.property_id)) byProperty.set(v.property_id, { propertyId: v.property_id, address: v.properties?.address || v.property_id, versions: [] })
    byProperty.get(v.property_id).versions.push(v)
  })
  return Array.from(byProperty.values())
    .map(p => ({ ...p, versions: p.versions.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)) }))
    .sort((a, b) => {
      const aLast = a.versions[a.versions.length - 1]?.created_at
      const bLast = b.versions[b.versions.length - 1]?.created_at
      return new Date(bLast) - new Date(aLast)
    })
}

function formatVal(v) {
  if (v == null || v === '') return '(empty)'
  if (Array.isArray(v)) {
    if (v.length && typeof v[0] === 'object') return `${v.length} item${v.length === 1 ? '' : 's'}`
    return v.filter(Boolean).join('; ') || '(empty)'
  }
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 200)
  return String(v)
}

// Word-level, not paragraph-level: only the changed words are struck
// through/highlighted inline, rather than showing the whole before/after
// text as two separate blobs (which is unreadable once a field is more
// than a sentence long, and makes even a one-word edit look like a
// wholesale rewrite).
function WordDiffLine({ before, after }) {
  const tokens = wordDiff(formatVal(before), formatVal(after))
  return (
    <span style={{ wordBreak: 'break-word' }}>
      {tokens.map((t, i) => {
        if (t.type === 'removed') return <span key={i} style={{ color: 'var(--warn)', textDecoration: 'line-through', opacity: 0.7 }}>{t.text}</span>
        if (t.type === 'added') return <span key={i} style={{ color: 'var(--ok)', background: 'rgba(58,125,68,.14)', borderRadius: 2 }}>{t.text}</span>
        return <span key={i}>{t.text}</span>
      })}
    </span>
  )
}

function VersionStep({ version, prev }) {
  const meta = SOURCE_META[version.source] || SOURCE_META.edit
  const Icon = meta.icon
  const changes = useMemo(() => prev ? diffSectionSlices(prev.report_data, version.report_data) : [], [prev, version])

  return (
    <div style={{ display: 'flex', gap: 10, padding: '8px 0' }}>
      <div style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', border: `1.5px solid ${meta.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
        <Icon className="size-3" style={{ color: meta.color }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: meta.color }}>{meta.label}</span>
          {version.section && <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{sectionLabel(version.section)}</span>}
          <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{new Date(version.created_at).toLocaleString()}</span>
        </div>
        {changes.length > 0 && (
          <div style={{ marginTop: 4, fontSize: 11.5, color: 'var(--text-muted)' }}>
            {changes.map((ch, i) => (
              <div key={i} style={{ marginBottom: 2 }}>
                <span style={{ fontWeight: 600 }}>{ch.field}:</span>{' '}
                <WordDiffLine before={ch.before} after={ch.after} />
              </div>
            ))}
          </div>
        )}
        {prev && changes.length === 0 && (
          <div style={{ marginTop: 4, fontSize: 11.5, color: 'var(--text-muted)', fontStyle: 'italic' }}>No changes from previous version.</div>
        )}
      </div>
    </div>
  )
}

function PropertyGroup({ group }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const latest = group.versions[group.versions.length - 1]

  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 6, marginBottom: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--surface)' }}>
        <button
          onClick={() => setOpen(o => !o)}
          style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
        >
          {open ? <ChevronDown className="size-3.5 shrink-0" style={{ color: 'var(--text-muted)' }} /> : <ChevronRight className="size-3.5 shrink-0" style={{ color: 'var(--text-muted)' }} />}
          <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{group.address}</span>
        </button>
        <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{group.versions.length} version{group.versions.length === 1 ? '' : 's'}</span>
        <button
          onClick={() => router.push(`/manage/${group.propertyId}/review`)}
          style={{ fontSize: 10.5, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: 20, padding: '3px 9px', background: 'transparent', cursor: 'pointer' }}
        >
          Open Review
        </button>
      </div>
      {open && (
        <div style={{ padding: '10px 16px 14px', borderTop: '1px solid var(--line)', background: 'var(--surface-2)' }}>
          {group.versions.map((v, i) => (
            <VersionStep key={v.id} version={v} prev={i > 0 ? group.versions[i - 1] : null} />
          ))}
        </div>
      )}
      {!open && (
        <div style={{ padding: '0 16px 10px', fontSize: 11.5, color: 'var(--text-muted)' }}>
          Latest: {SOURCE_META[latest.source]?.label || latest.source} — {new Date(latest.created_at).toLocaleString()}
        </div>
      )}
    </div>
  )
}

export default function InsightsActivityPage() {
  const [versions, setVersions] = useState([])
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    authFetch('/api/report-version?scope=all')
      .then(res => res.json())
      .then(data => setVersions(data.versions || []))
      .catch(err => console.error('Failed to load report versions:', err))
      .finally(() => setFetching(false))
  }, [])

  const groups = useMemo(() => groupByProperty(versions), [versions])

  return (
    <div style={{ maxWidth: 900 }}>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginTop: 0, marginBottom: 20, maxWidth: 640 }}>
        Every report's full history — every AI draft, every section edit, every "Final Report" checkpoint — grouped by property. Expand a property to see what changed at each step.
      </p>

      {fetching && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading…</p>}

      {!fetching && groups.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No report activity yet.</p>
      )}

      {!fetching && groups.map(group => <PropertyGroup key={group.propertyId} group={group} />)}
    </div>
  )
}
