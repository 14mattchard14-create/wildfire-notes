'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

const c = {
  surface: '#242220',
  line:    '#3a352f',
  accent:  '#be5b1d',
  text:    '#ece6db',
  muted:   '#9a9285',
  ok:      '#6b8e63',
}

export default function ExportPanel({ property, entries }) {
  const [tab,     setTab]     = useState('raw')   // 'raw' | 'report'
  const [text,    setText]    = useState('')
  const [report,  setReport]  = useState('')
  const [copied,  setCopied]  = useState(false)
  const [loading, setLoading] = useState(false)
  const [genning, setGenning] = useState(false)

  async function generateRaw() {
    setLoading(true)

    const [{ data: site }, { data: priorities }] = await Promise.all([
      supabase.from('site_notes').select('*').eq('property_id', property.id).maybeSingle(),
      supabase.from('priorities').select('*').eq('property_id', property.id).order('rank'),
    ])

    const lines = []
    lines.push(`FIELD NOTES — ${property.address}`)
    lines.push(`Visit date: ${property.visit_date ?? '—'}`)
    lines.push('')
    lines.push('--- SITE NOTES ---')
    if (site) {
      if (site.slope)     lines.push(`Slope & Topography: ${site.slope}`)
      if (site.fuel)      lines.push(`Fuel Type / Vegetation: ${site.fuel}`)
      if (site.wind)      lines.push(`Wind / Weather Exposure: ${site.wind}`)
      if (site.neighbors) lines.push(`Neighboring Properties: ${site.neighbors}`)
      if (site.other)     lines.push(`Other: ${site.other}`)
    } else {
      lines.push('(none recorded)')
    }
    lines.push('')
    lines.push('--- PRIORITIES ---')
    if (priorities?.length) {
      priorities.forEach((p, i) => {
        if (p.text) lines.push(`${i + 1}. ${p.text}${p.why ? ' — ' + p.why : ''}`)
      })
    } else {
      lines.push('(none set)')
    }
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
    } else {
      lines.push('(no entries logged)')
    }

    const raw = lines.join('\n')
    setText(raw)
    setLoading(false)
    return raw
  }

  async function generateReport() {
    setGenning(true)
    let raw = text
    if (!raw) raw = await generateRaw()

    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fieldNotes: raw, property }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setReport(data.report)
      setTab('report')
    } catch (err) {
      alert('Report generation failed: ' + err.message)
    }
    setGenning(false)
  }

  async function copy() {
    const content = tab === 'report' ? report : text
    try { await navigator.clipboard.writeText(content) }
    catch { const el = document.querySelector('#export-text'); el.select(); document.execCommand('copy') }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const btnBase = { flex: 1, border: 'none', borderRadius: 4, fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '8px', cursor: 'pointer', fontWeight: 600 }

  return (
    <div>
      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        <button onClick={() => setTab('raw')} style={{ ...btnBase, background: tab === 'raw' ? c.accent : 'transparent', color: tab === 'raw' ? '#1b1917' : c.muted, border: `1px solid ${tab === 'raw' ? c.accent : c.line}` }}>
          Raw Notes
        </button>
        <button onClick={() => setTab('report')} style={{ ...btnBase, background: tab === 'report' ? c.accent : 'transparent', color: tab === 'report' ? '#1b1917' : c.muted, border: `1px solid ${tab === 'report' ? c.accent : c.line}` }}>
          Full Report
        </button>
      </div>

      {tab === 'raw' && (
        <>
          <button
            onClick={generateRaw}
            disabled={loading}
            style={{ width: '100%', background: c.accent, color: '#1b1917', border: 'none', borderRadius: 4, fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', padding: 13, cursor: 'pointer', opacity: loading ? 0.5 : 1, marginBottom: 14 }}
          >
            {loading ? 'Generating…' : 'Generate Raw Notes'}
          </button>

          {text && (
            <>
              <textarea
                id="export-text"
                readOnly
                value={text}
                style={{ width: '100%', background: '#1b1917', border: `1px solid ${c.line}`, borderRadius: 4, padding: '10px 12px', fontSize: 12, fontFamily: 'monospace', color: c.muted, minHeight: 280, resize: 'vertical', outline: 'none', boxSizing: 'border-box', marginBottom: 10 }}
              />
              <button onClick={copy} style={{ width: '100%', background: 'transparent', border: `1px solid ${copied ? c.accent : c.line}`, borderRadius: 4, color: copied ? c.accent : c.muted, fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '10px', cursor: 'pointer' }}>
                {copied ? '✓ Copied' : 'Copy to Clipboard'}
              </button>
            </>
          )}
        </>
      )}

      {tab === 'report' && (
        <>
          <button
            onClick={generateReport}
            disabled={genning}
            style={{ width: '100%', background: c.accent, color: '#1b1917', border: 'none', borderRadius: 4, fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', padding: 13, cursor: 'pointer', opacity: genning ? 0.5 : 1, marginBottom: 14 }}
          >
            {genning ? 'Generating Report…' : 'Generate Full Report'}
          </button>

          {report && (
            <>
              <textarea
                readOnly
                value={report}
                style={{ width: '100%', background: '#1b1917', border: `1px solid ${c.line}`, borderRadius: 4, padding: '10px 12px', fontSize: 12, fontFamily: 'monospace', color: c.muted, minHeight: 400, resize: 'vertical', outline: 'none', boxSizing: 'border-box', marginBottom: 10, scrollbarWidth: 'thin', scrollbarColor: `${c.line} transparent` }}
              />
              <button onClick={copy} style={{ width: '100%', background: 'transparent', border: `1px solid ${copied ? c.accent : c.line}`, borderRadius: 4, color: copied ? c.accent : c.muted, fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '10px', cursor: 'pointer' }}>
                {copied ? '✓ Copied' : 'Copy Report'}
              </button>
            </>
          )}
        </>
      )}
    </div>
  )
}
