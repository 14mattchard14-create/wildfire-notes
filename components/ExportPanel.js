'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function ExportPanel({ property, entries }) {
  const [text,     setText]     = useState('')
  const [copied,   setCopied]   = useState(false)
  const [loading,  setLoading]  = useState(false)

  async function generate() {
    setLoading(true)

    // Fetch site notes and priorities for this property
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
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for browsers that block clipboard
      const el = document.querySelector('#export-text')
      el.select()
      document.execCommand('copy')
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div>
      <p className="text-xs text-stone-500 mb-4 leading-relaxed">
        Generate a plain-text summary of everything logged, then paste it into Claude to build the report.
      </p>

      <button
        onClick={generate}
        disabled={loading}
        className="w-full bg-orange-700 text-stone-950 font-bold text-sm py-3 rounded uppercase tracking-wide disabled:opacity-50 mb-4"
      >
        {loading ? 'Generating…' : 'Generate Summary'}
      </button>

      {text && (
        <>
          <textarea
            id="export-text"
            readOnly
            value={text}
            className="w-full bg-stone-900 border border-stone-700 rounded px-3 py-2.5 text-xs font-mono text-stone-300 min-h-[320px] resize-y mb-3 focus:outline-none"
          />
          <button
            onClick={copy}
            className="w-full border border-stone-700 text-stone-400 text-xs font-mono uppercase tracking-wide py-2.5 rounded hover:border-orange-600 hover:text-orange-600 transition-colors"
          >
            {copied ? '✓ Copied' : 'Copy to Clipboard'}
          </button>
        </>
      )}
    </div>
  )
}
