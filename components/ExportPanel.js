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

export default function ExportPanel({ property, entries }) {
  const [text,    setText]    = useState('')
  const [copied,  setCopied]  = useState(false)
  const [loading, setLoading] = useState(false)

  async function generate() {
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

    setText(lines.join('\n'))
    setLoading(false)
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const el = document.querySelector('#export-text')
      el.select()
      document.execCommand('copy')
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <button
        onClick={generate}
        disabled={loading}
        style={{ width: '100%', background: c.accent, color: '#1b1917', border: 'none', borderRadius: 4, fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', padding: 13, cursor: 'pointer', opacity: loading ? 0.5 : 1, marginBottom: 14 }}
      >
        {loading ? 'Generating…' : 'Generate Summary'}
      </button>

      {text && (
        <>
          <textarea
            id="export-text"
            readOnly
            value={text}
            style={{ width: '100%', background: '#1b1917', border: `1px solid ${c.line}`, borderRadius: 4, padding: '10px 12px', fontSize: 12, fontFamily: 'monospace', color: c.muted, minHeight: 320, resize: 'vertical', outline: 'none', boxSizing: 'border-box', marginBottom: 10 }}
          />
          <button
            onClick={copy}
            style={{ width: '100%', background: 'transparent', border: `1px solid ${copied ? c.accent : c.line}`, borderRadius: 4, color: copied ? c.accent : c.muted, fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '10px', cursor: 'pointer' }}
          >
            {copied ? '✓ Copied' : 'Copy to Clipboard'}
          </button>
        </>
      )}
    </div>
  )
}
