'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

const c = {
  surface: '#242220',
  line:    '#3a352f',
  accent:  '#be5b1d',
  text:    '#ece6db',
  muted:   '#9a9285',
}

export default function ExportPanel({ property, entries, user }) {
  const [tab,        setTab]        = useState('raw')
  const [text,       setText]       = useState('')
  const [report,     setReport]     = useState('')
  const [copied,     setCopied]     = useState(false)
  const [loading,    setLoading]    = useState(false)
  const [genning,    setGenning]    = useState(false)
  const [debugLog,   setDebugLog]   = useState(null)

  // Shareable link state
  const [shareLoading, setShareLoading] = useState(false)
  const [shareResult,  setShareResult]  = useState(null)
  const [shareError,   setShareError]   = useState('')
  const [copyLabel,    setCopyLabel]    = useState('Copy Link')

  async function buildRaw() {
    const [{ data: site }, { data: priorities }] = await Promise.all([
      supabase.from('site_notes').select('*').eq('property_id', property.id).maybeSingle(),
      supabase.from('priorities').select('*').eq('property_id', property.id).order('rank'),
    ])
    const lines = []
    lines.push(`FIELD NOTES — ${property.address}`)
    lines.push(`Visit date: ${property.visit_date ?? '—'}`)
    lines.push('')
    lines.push('--- SITE NOTES BY CATEGORY ---')
    if (site) {
      const fieldLabels = [
        ['overall_site', 'Overall Site & Surrounding Environment'],
        ['zone_0', '0-5 Ft Noncombustible Zone'],
        ['zone_5_30', '5-30 Ft Defensible Space'],
        ['detached_structures', 'Detached Structures & Other Large Items'],
        ['roof', 'Roof'],
        ['gutters', 'Gutters & Downspouts'],
        ['wall_clearance', '6-Inch Noncombustible Wall Clearance'],
        ['vents', 'Vents'],
        ['eaves_soffits', 'Eaves & Soffits'],
        ['skylights', 'Skylights'],
        ['siding', 'Exterior Wall Coverings / Siding'],
        ['windows_doors', 'Exterior Windows & Doors'],
        ['decks', 'Decks, Patios & Overhead Structures'],
        ['access', 'Access & Address'],
        ['other', 'Other Observations'],
      ]
      let hasAny = false
      fieldLabels.forEach(([key, label]) => {
        if (site[key]) { lines.push(`${label}: ${site[key]}`); hasAny = true }
      })
      if (!hasAny) lines.push('(none recorded)')
    } else { lines.push('(none recorded)') }
    lines.push('')
    lines.push('--- PRIORITIES ---')
    if (priorities?.length) {
      priorities.forEach((p, i) => { if (p.text) lines.push(`${i + 1}. ${p.text}${p.why ? ' — ' + p.why : ''}`) })
    } else { lines.push('(none set)') }
    lines.push('')
    lines.push('--- ENTRIES ---')
    if (entries.length) {
      const sorted = [...entries].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      sorted.forEach(en => {
        lines.push(`[${en.zone}] ${en.category} — ${en.status}`)
        if (en.distance)  lines.push(`  Distance: ${en.distance}`)
        lines.push(`  Finding: ${en.note}`)
        if (en.detail)    lines.push(`  Details: ${en.detail}`)
        if (en.photo_url) lines.push(`  Photo: ${en.photo_url}`)
        lines.push('')
      })
    } else { lines.push('(no entries logged)') }
    return lines.join('\n')
  }

  async function generateRaw() {
    setLoading(true)
    const raw = await buildRaw()
    setText(raw)
    setLoading(false)
    return raw
  }

  async function generateReport() {
    setGenning(true)
    const raw = text || await buildRaw()
    if (!text) setText(raw)
    try {
      const res = await fetch('/api/report-docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fieldNotes: raw, property, inspectorName: user?.user_metadata?.full_name || user?.email || 'Unknown', entries }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setReport(data.report)
      setDebugLog(data.debugLog ?? null)
      downloadDocx(data.docx)
    } catch (err) {
      alert('Report generation failed: ' + err.message)
    }
    setGenning(false)
  }

  async function handleGenerateShareLink() {
    setShareLoading(true)
    setShareError('')
    setShareResult(null)
    try {
      const raw = text || await buildRaw()
      if (!text) setText(raw)
      const res = await fetch('/api/share-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fieldNotes: raw,
          property,
          inspectorName: user?.user_metadata?.full_name || user?.email || 'Unknown',
          entries,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to generate link')
      }
      const data = await res.json()
      setShareResult(data)
    } catch (err) {
      setShareError(err.message)
    } finally {
      setShareLoading(false)
    }
  }

  function handleCopyLink() {
    const url = `${window.location.origin}/report/${shareResult.token}`
    navigator.clipboard.writeText(url)
    setCopyLabel('Copied!')
    setTimeout(() => setCopyLabel('Copy Link'), 2000)
  }

  function downloadDocx(base64) {
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
    const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${property.address ?? 'wildfire-report'}.docx`
    a.click()
    URL.revokeObjectURL(url)
  }

  function downloadTxt(content, filename) {
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  async function copy(content) {
    try { await navigator.clipboard.writeText(content) } catch { /* silent */ }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const btnBase = { flex: 1, border: 'none', borderRadius: 4, fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '8px', cursor: 'pointer', fontWeight: 600 }
  const outlineBtn = { background: 'transparent', border: `1px solid ${c.line}`, borderRadius: 4, color: c.muted, fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '10px', cursor: 'pointer' }

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        <button onClick={() => setTab('raw')} style={{ ...btnBase, background: tab === 'raw' ? c.accent : 'transparent', color: tab === 'raw' ? '#1b1917' : c.muted, border: `1px solid ${tab === 'raw' ? c.accent : c.line}` }}>
          Raw Notes
        </button>
        <button onClick={() => setTab('report')} style={{ ...btnBase, background: tab === 'report' ? c.accent : 'transparent', color: tab === 'report' ? '#1b1917' : c.muted, border: `1px solid ${tab === 'report' ? c.accent : c.line}` }}>
          Full Report
        </button>
        <button onClick={() => setTab('share')} style={{ ...btnBase, background: tab === 'share' ? c.accent : 'transparent', color: tab === 'share' ? '#1b1917' : c.muted, border: `1px solid ${tab === 'share' ? c.accent : c.line}` }}>
          Share Link
        </button>
      </div>

      {tab === 'raw' && (
        <>
          <button onClick={generateRaw} disabled={loading} style={{ width: '100%', background: c.accent, color: '#1b1917', border: 'none', borderRadius: 4, fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', padding: 13, cursor: 'pointer', opacity: loading ? 0.5 : 1, marginBottom: 14 }}>
            {loading ? 'Generating…' : 'Generate Raw Notes'}
          </button>
          {text && (
            <>
              <textarea readOnly value={text} style={{ width: '100%', background: '#1b1917', border: `1px solid ${c.line}`, borderRadius: 4, padding: '10px 12px', fontSize: 12, fontFamily: 'monospace', color: c.muted, minHeight: 280, resize: 'vertical', outline: 'none', boxSizing: 'border-box', marginBottom: 10, scrollbarWidth: 'thin', scrollbarColor: `${c.line} transparent` }} />
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => copy(text)} style={{ ...outlineBtn, flex: 1, borderColor: copied ? c.accent : c.line, color: copied ? c.accent : c.muted }}>
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
                <button onClick={() => downloadTxt(text, `${property.address ?? 'field-notes'}.txt`)} style={{ ...outlineBtn, flex: 1 }}>
                  ↓ Download .txt
                </button>
              </div>
            </>
          )}
        </>
      )}

      {tab === 'report' && (
        <>
          <button onClick={generateReport} disabled={genning} style={{ width: '100%', background: c.accent, color: '#1b1917', border: 'none', borderRadius: 4, fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', padding: 13, cursor: 'pointer', opacity: genning ? 0.5 : 1, marginBottom: 14 }}>
            {genning ? 'Generating Report…' : 'Generate & Download Report'}
          </button>
          {report && (
            <>
              <textarea readOnly value={report} style={{ width: '100%', background: '#1b1917', border: `1px solid ${c.line}`, borderRadius: 4, padding: '10px 12px', fontSize: 12, fontFamily: 'monospace', color: c.muted, minHeight: 400, resize: 'vertical', outline: 'none', boxSizing: 'border-box', marginBottom: 10, scrollbarWidth: 'thin', scrollbarColor: `${c.line} transparent` }} />
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => copy(report)} style={{ ...outlineBtn, flex: 1, borderColor: copied ? c.accent : c.line, color: copied ? c.accent : c.muted }}>
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
                <button onClick={() => generateReport()} disabled={genning} style={{ ...outlineBtn, flex: 1 }}>
                  ↓ Re-download .docx
                </button>
              </div>
            </>
          )}
        </>
      )}

      {tab === 'share' && (
        <>
          <div style={{ fontSize: 12, color: c.muted, marginBottom: 16, lineHeight: 1.6 }}>
            Generate a private web report for your client. You'll get a link and a 6-digit access code to share with them separately.
          </div>

          <button
            onClick={handleGenerateShareLink}
            disabled={shareLoading || !property}
            style={{ width: '100%', background: c.accent, color: '#1b1917', border: 'none', borderRadius: 4, fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', padding: 13, cursor: shareLoading || !property ? 'not-allowed' : 'pointer', opacity: shareLoading || !property ? 0.5 : 1, marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            {shareLoading ? 'Generating…' : '🔗 Generate Shareable Link'}
          </button>

          {shareError && (
            <div style={{ padding: '10px 14px', background: '#2c1a18', border: `1px solid #b5483a`, borderRadius: 6, fontSize: 12, color: '#e07060', marginBottom: 14 }}>
              {shareError}
            </div>
          )}

          {shareResult && (
            <div style={{ background: '#1e2820', border: '1px solid #3a5e42', borderRadius: 8, padding: '16px 18px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#8ec99a', marginBottom: 14, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                ✓ Report Ready
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: c.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Access Code</div>
                <div style={{ fontSize: 11, color: c.muted, marginBottom: 8, lineHeight: 1.5 }}>Share this separately with your client — they'll need it to open the report.</div>
                <div style={{ fontSize: 32, fontWeight: 800, color: c.text, letterSpacing: '0.25em', fontVariantNumeric: 'tabular-nums', background: '#242220', border: `1px solid ${c.line}`, borderRadius: 6, padding: '10px 16px', textAlign: 'center' }}>
                  {shareResult.accessCode}
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: c.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Report Link</div>
                <div style={{ background: '#242220', border: `1px solid ${c.line}`, borderRadius: 6, padding: '8px 12px', fontSize: 12, color: c.muted, wordBreak: 'break-all', fontFamily: 'monospace' }}>
                  {typeof window !== 'undefined' ? `${window.location.origin}/report/${shareResult.token}` : `/report/${shareResult.token}`}
                </div>
              </div>

              <button
                onClick={handleCopyLink}
                style={{ ...outlineBtn, width: '100%', borderColor: copyLabel === 'Copied!' ? c.accent : c.line, color: copyLabel === 'Copied!' ? c.accent : c.muted }}
              >
                {copyLabel === 'Copied!' ? '✓ Copied' : '↗ Copy Link'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
