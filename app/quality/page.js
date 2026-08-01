'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { authFetch } from '@/lib/authFetch'
import { diffSectionSlices } from '@/lib/reportSchema'
import ThemeToggle from '@/components/ThemeToggle'
import BrandLogo from '@/components/BrandLogo'
import BackNav from '@/components/BackNav'
import AdminSidebar from '@/components/AdminSidebar'
import LessonsLearned from '@/components/LessonsLearned'
import { Button } from '@/components/ui/button'
import { Download, ChevronDown, ChevronRight } from 'lucide-react'

// Report Quality — the A/B training portal. Pairs each property's original,
// untouched AI draft (report_versions.source = 'ai_draft', earliest one) with
// its most recent inspector-approved "Final Report" checkpoint (source =
// 'final', latest one). Only properties with both sides of the pair show up
// here — that's the point: these are exactly the before/after examples
// worth feeding back into prompt improvements. Selected pairs export as a
// single JSON file of { propertyId, address, aiDraft, final, diff } objects.

function buildPairs(versions) {
  const byProperty = new Map()
  versions.forEach(v => {
    if (!byProperty.has(v.property_id)) byProperty.set(v.property_id, { address: v.properties?.address || v.property_id, aiDraft: null, final: null })
    const entry = byProperty.get(v.property_id)
    if (v.source === 'ai_draft') {
      if (!entry.aiDraft || new Date(v.created_at) < new Date(entry.aiDraft.created_at)) entry.aiDraft = v
    } else if (v.source === 'final') {
      if (!entry.final || new Date(v.created_at) > new Date(entry.final.created_at)) entry.final = v
    }
  })
  return Array.from(byProperty.entries())
    .map(([propertyId, v]) => ({ propertyId, ...v }))
    .filter(p => p.aiDraft && p.final)
    .sort((a, b) => new Date(b.final.created_at) - new Date(a.final.created_at))
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function PairRow({ pair, checked, onToggle }) {
  const [open, setOpen] = useState(false)
  const changes = useMemo(() => diffSectionSlices(pair.aiDraft.report_data, pair.final.report_data), [pair])

  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 6, marginBottom: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--surface)' }}>
        <input type="checkbox" checked={checked} onChange={onToggle} style={{ flexShrink: 0 }} />
        <button
          onClick={() => setOpen(o => !o)}
          style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
        >
          {open ? <ChevronDown className="size-3.5 shrink-0" style={{ color: 'var(--text-muted)' }} /> : <ChevronRight className="size-3.5 shrink-0" style={{ color: 'var(--text-muted)' }} />}
          <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{pair.address}</span>
        </button>
        <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{changes.length} field{changes.length === 1 ? '' : 's'} changed</span>
      </div>
      {open && (
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--line)', background: 'var(--surface-2)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, fontFamily: 'monospace' }}>
            AI draft: {new Date(pair.aiDraft.created_at).toLocaleString()} · Final: {new Date(pair.final.created_at).toLocaleString()}
          </div>
          {changes.length === 0 && <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: 0 }}>No differences — the final report matches the AI's original draft exactly.</p>}
          {changes.map((ch, i) => (
            <div key={i} style={{ marginBottom: 10, fontSize: 12.5 }}>
              <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>{ch.field}</div>
              <div style={{ color: 'var(--warn)', opacity: 0.8, marginBottom: 2, wordBreak: 'break-word' }}>
                <span style={{ fontFamily: 'monospace', fontSize: 10, marginRight: 6 }}>AI</span>
                {formatVal(ch.before)}
              </div>
              <div style={{ color: 'var(--ok)', wordBreak: 'break-word' }}>
                <span style={{ fontFamily: 'monospace', fontSize: 10, marginRight: 6 }}>FINAL</span>
                {formatVal(ch.after)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
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

export default function ReportQualityPortal() {
  const router = useRouter()
  const { user, loading, isHomeowner, profileReady } = useAuth()
  const [versions, setVersions] = useState([])
  const [fetching, setFetching] = useState(true)
  const [selected, setSelected] = useState(new Set())
  const [tab, setTab] = useState('pairs') // 'pairs' | 'lessons'

  useEffect(() => {
    authFetch('/api/report-version')
      .then(res => res.json())
      .then(data => setVersions(data.versions || []))
      .catch(err => console.error('Failed to load report versions:', err))
      .finally(() => setFetching(false))
  }, [])

  const pairs = useMemo(() => buildPairs(versions), [versions])

  function toggle(propertyId) {
    setSelected(s => {
      const next = new Set(s)
      if (next.has(propertyId)) next.delete(propertyId); else next.add(propertyId)
      return next
    })
  }

  function toggleAll() {
    setSelected(s => s.size === pairs.length ? new Set() : new Set(pairs.map(p => p.propertyId)))
  }

  function exportSelected() {
    const chosen = pairs.filter(p => selected.has(p.propertyId))
    const payload = chosen.map(p => ({
      propertyId: p.propertyId,
      address: p.address,
      aiDraftAt: p.aiDraft.created_at,
      finalAt: p.final.created_at,
      aiDraft: p.aiDraft.report_data,
      final: p.final.report_data,
      diff: diffSectionSlices(p.aiDraft.report_data, p.final.report_data),
    }))
    downloadJson(`report-training-pairs-${new Date().toISOString().slice(0, 10)}.json`, payload)
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

  return (
    <div style={{ minHeight: '100vh' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--header-bg)', borderBottom: '1px solid var(--line)' }}>
        <div style={{ padding: '18px 20px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ marginBottom: 4 }}><BrandLogo /></div>
            <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.02em', textTransform: 'uppercase', margin: 0, color: 'var(--header-text)' }}>Report Quality</h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
        <AdminSidebar />
        <div style={{ flex: 1, minWidth: 0 }}>
          <BackNav href="/manage" label="All Properties" maxWidth="none" />
          <main style={{ maxWidth: CONTENT_WIDTH, padding: '20px 24px 64px' }}>
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--line)' }}>
          {[['pairs', 'A/B Pairs'], ['lessons', 'Lessons Learned']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                fontSize: 12.5, fontWeight: 600, padding: '9px 14px', cursor: 'pointer',
                background: 'none', border: 'none', borderBottom: `2px solid ${tab === key ? 'var(--accent)' : 'transparent'}`,
                color: tab === key ? 'var(--accent)' : 'var(--text-muted)', marginBottom: -1,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'lessons' && <LessonsLearned />}

        {tab === 'pairs' && (
          <>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginTop: 0, marginBottom: 20, maxWidth: 640 }}>
              Every property below has both an original AI-generated draft and a "Final Report" checkpoint saved from the review editor — that pairing is what makes it useful as a before/after training example. Select the ones worth learning from and export them as JSON to feed into prompt improvements.
            </p>

            {fetching && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading…</p>}

            {!fetching && pairs.length === 0 && (
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                No A/B pairs yet. A property needs a generated draft and a "Final Report" checkpoint (from the review page) before it shows up here.
              </p>
            )}

            {!fetching && pairs.length > 0 && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={selected.size === pairs.length} onChange={toggleAll} />
                    Select all ({pairs.length})
                  </label>
                  <Button
                    onClick={exportSelected}
                    disabled={selected.size === 0}
                    className="ml-auto gap-1.5 text-[12px] font-bold uppercase tracking-wide h-auto py-2.5 px-4"
                  >
                    <Download className="size-3.5" /> Export Selected as JSON
                  </Button>
                </div>

                {pairs.map(pair => (
                  <PairRow key={pair.propertyId} pair={pair} checked={selected.has(pair.propertyId)} onToggle={() => toggle(pair.propertyId)} />
                ))}
              </>
            )}
          </>
        )}
          </main>
        </div>
      </div>
    </div>
  )
}
