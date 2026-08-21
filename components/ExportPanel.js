'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { useConfirmDialog } from '@/components/ConfirmDialogProvider'
import { X } from 'lucide-react'

export default function ExportPanel({ property, entries, user }) {
  const { alertDialog } = useConfirmDialog()
  const [tab,        setTab]        = useState('raw')
  const [text,       setText]       = useState('')
  const [report,     setReport]     = useState('')
  const [copied,     setCopied]     = useState(false)
  const [loading,    setLoading]    = useState(false)
  const [genning,    setGenning]    = useState(false)
  const [shareLoading,   setShareLoading]   = useState(false)
  const [shareResult,    setShareResult]    = useState(null)
  const [shareError,     setShareError]     = useState('')
  const [copyLabel,      setCopyLabel]      = useState('Copy Link')
  const [editMode,       setEditMode]       = useState(false)
  const [editMarkdown,   setEditMarkdown]   = useState('')
  const [republishing,   setRepublishing]   = useState(false)
  const [republishMsg,   setRepublishMsg]   = useState('')
  const [rewriteOpen,    setRewriteOpen]    = useState(false)
  const [rewriteSection, setRewriteSection] = useState('')
  const [rewriteInstr,   setRewriteInstr]   = useState('')
  const [rewriting,      setRewriting]      = useState(false)
  const [rewriteError,   setRewriteError]   = useState('')

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
      const fieldLabels = [['overall_site','Overall Site & Surrounding Environment'],['zone_0','0-5 Ft Noncombustible Zone'],['zone_5_30','5-30 Ft Defensible Space'],['detached_structures','Detached Structures & Other Large Items'],['roof','Roof'],['gutters','Gutters & Downspouts'],['wall_clearance','6-Inch Noncombustible Wall Clearance'],['vents','Vents'],['eaves_soffits','Eaves & Soffits'],['skylights','Skylights'],['siding','Exterior Wall Coverings / Siding'],['windows_doors','Exterior Windows & Doors'],['decks','Decks, Patios & Overhead Structures'],['access','Access & Address'],['other','Other Observations']]
      let hasAny = false
      fieldLabels.forEach(([key, label]) => { if (site[key]) { lines.push(`${label}: ${site[key]}`); hasAny = true } })
      if (!hasAny) lines.push('(none recorded)')
    } else { lines.push('(none recorded)') }
    lines.push('')
    lines.push('--- PRIORITIES ---')
    if (priorities?.length) { priorities.forEach((p, i) => { if (p.text) lines.push(`${i + 1}. ${p.text}${p.why ? ' — ' + p.why : ''}`) }) } else { lines.push('(none set)') }
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

  async function generateRaw() { setLoading(true); const raw = await buildRaw(); setText(raw); setLoading(false); return raw }

  async function generateReport() {
    setGenning(true)
    const raw = text || await buildRaw()
    if (!text) setText(raw)
    try {
      const res = await fetch('/api/report-docx', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fieldNotes: raw, property, inspectorName: user?.user_metadata?.full_name || user?.email || 'Unknown', entries }) })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setReport(data.report); downloadDocx(data.docx)
    } catch (err) { await alertDialog('Report generation failed: ' + err.message) }
    setGenning(false)
  }

  async function handleGenerateShareLink() {
    setShareLoading(true); setShareError(''); setShareResult(null); setEditMode(false); setRepublishMsg('')
    try {
      const raw = text || await buildRaw()
      if (!text) setText(raw)
      const res = await fetch('/api/share-report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fieldNotes: raw, property, inspectorName: user?.user_metadata?.full_name || user?.email || 'Unknown', entries }) })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to generate link') }
      const data = await res.json(); setShareResult(data)
    } catch (err) { setShareError(err.message) } finally { setShareLoading(false) }
  }

  function handleCopyLink() { navigator.clipboard.writeText(`${window.location.origin}/report/${shareResult.token}`); setCopyLabel('Copied!'); setTimeout(() => setCopyLabel('Copy Link'), 2000) }

  function handleOpenEdit() {
    supabase.from('shared_reports').select('report_markdown').eq('token', shareResult.token).single()
      .then(({ data }) => { if (data) { setEditMarkdown(data.report_markdown); setEditMode(true); setRewriteOpen(false); setRewriteSection(''); setRewriteInstr(''); setRewriteError(''); setRepublishMsg('') } })
  }

  async function handleRepublish() {
    setRepublishing(true); setRepublishMsg('')
    try {
      const res = await fetch('/api/edit-report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'republish', token: shareResult.token, markdown: editMarkdown }) })
      if (!res.ok) throw new Error('Failed to republish')
      setRepublishMsg('✓ Report updated — the link now shows the new version.')
    } catch (err) { setRepublishMsg('✗ ' + err.message) } finally { setRepublishing(false) }
  }

  async function handleRewriteSection() {
    if (!rewriteSection || !rewriteInstr.trim()) return
    setRewriting(true); setRewriteError('')
    try {
      const res = await fetch('/api/edit-report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'rewrite-section', token: shareResult.token, markdown: editMarkdown, sectionTitle: rewriteSection, instructions: rewriteInstr }) })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Rewrite failed')
      setEditMarkdown(data.markdown); setRewriteInstr(''); setRewriteOpen(false)
    } catch (err) { setRewriteError(err.message) } finally { setRewriting(false) }
  }

  function getSections(md) { if (!md) return []; return md.split('\n').filter(l => l.startsWith('## ') || l.startsWith('### ')).map(l => l.replace(/^#{2,3} /, '').trim()) }

  function downloadDocx(base64) {
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
    const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a')
    a.href = url; a.download = `${property.address ?? 'wildfire-report'}.docx`; a.click(); URL.revokeObjectURL(url)
  }

  function downloadTxt(content, filename) { const blob = new Blob([content], { type: 'text/plain' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url) }

  async function copy(content) { try { await navigator.clipboard.writeText(content) } catch { } setCopied(true); setTimeout(() => setCopied(false), 2000) }

  const sections = getSections(editMarkdown)

  const btnBase = { flex: 1, border: 'none', borderRadius: 4, fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '8px', cursor: 'pointer', fontWeight: 600 }
  const textareaClass = "font-mono text-xs bg-secondary text-muted-foreground resize-y"

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {['raw','report','share'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ ...btnBase, background: tab === t ? 'var(--accent)' : 'transparent', color: tab === t ? 'var(--bg)' : 'var(--text-muted)', border: `1px solid ${tab === t ? 'var(--accent)' : 'var(--line)'}` }}>
            {t === 'raw' ? 'Raw Notes' : t === 'report' ? 'Full Report' : 'Share Link'}
          </button>
        ))}
      </div>

      {tab === 'raw' && (
        <>
          <Button onClick={generateRaw} disabled={loading} className="w-full text-[13px] font-bold uppercase tracking-wide py-3 h-auto mb-3.5">
            {loading ? 'Generating…' : 'Generate Raw Notes'}
          </Button>
          {text && (
            <>
              <Textarea readOnly value={text} className={`${textareaClass} min-h-[280px] mb-2.5`} />
              <div style={{ display: 'flex', gap: 6 }}>
                <Button onClick={() => copy(text)} variant="outline" className={`flex-1 font-mono text-xs uppercase tracking-wide h-auto py-2.5 ${copied ? 'border-primary text-primary' : ''}`}>{copied ? '✓ Copied' : 'Copy'}</Button>
                <Button onClick={() => downloadTxt(text, `${property.address ?? 'field-notes'}.txt`)} variant="outline" className="flex-1 font-mono text-xs uppercase tracking-wide h-auto py-2.5">↓ Download .txt</Button>
              </div>
            </>
          )}
        </>
      )}

      {tab === 'report' && (
        <>
          <Button onClick={generateReport} disabled={genning} className="w-full text-[13px] font-bold uppercase tracking-wide py-3 h-auto mb-3.5">
            {genning ? 'Generating Report…' : 'Generate & Download Report'}
          </Button>
          {report && (
            <>
              <Textarea readOnly value={report} className={`${textareaClass} min-h-[400px] mb-2.5`} />
              <div style={{ display: 'flex', gap: 6 }}>
                <Button onClick={() => copy(report)} variant="outline" className={`flex-1 font-mono text-xs uppercase tracking-wide h-auto py-2.5 ${copied ? 'border-primary text-primary' : ''}`}>{copied ? '✓ Copied' : 'Copy'}</Button>
                <Button onClick={() => generateReport()} disabled={genning} variant="outline" className="flex-1 font-mono text-xs uppercase tracking-wide h-auto py-2.5">↓ Re-download .docx</Button>
              </div>
            </>
          )}
        </>
      )}

      {tab === 'share' && (
        <>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>Generate a private web report for your client. You'll get a link and a 6-digit access code to share separately.</div>

          <Button onClick={handleGenerateShareLink} disabled={shareLoading || !property} className="w-full text-[13px] font-bold uppercase tracking-wide py-3 h-auto mb-3.5 gap-2">
            {shareLoading ? 'Generating…' : '🔗 Generate Shareable Link'}
          </Button>

          {shareError && <div style={{ padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--warn)', borderRadius: 6, fontSize: 12, color: 'var(--warn)', marginBottom: 14 }}>{shareError}</div>}

          {shareResult && !editMode && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderLeft: '3px solid var(--ok)', borderRadius: 8, padding: '16px 18px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ok)', marginBottom: 14, letterSpacing: '0.08em', textTransform: 'uppercase' }}>✓ Report Ready</div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Access Code</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.5 }}>Share this separately with your client.</div>
                <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--text)', letterSpacing: '0.25em', background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 6, padding: '10px 16px', textAlign: 'center' }}>{shareResult.accessCode}</div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Report Link</div>
                <div style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: 'var(--text-muted)', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                  {typeof window !== 'undefined' ? `${window.location.origin}/report/${shareResult.token}` : `/report/${shareResult.token}`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <Button onClick={handleCopyLink} variant="outline" className={`flex-1 font-mono text-xs uppercase tracking-wide h-auto py-2.5 ${copyLabel === 'Copied!' ? 'border-primary text-primary' : ''}`}>{copyLabel === 'Copied!' ? '✓ Copied' : '↗ Copy Link'}</Button>
                <Button onClick={handleOpenEdit} variant="outline" className="flex-1 font-mono text-xs uppercase tracking-wide h-auto py-2.5">✏ Edit Report</Button>
              </div>
            </div>
          )}

          {shareResult && editMode && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>✏ Edit Report</div>
                <Button onClick={() => setEditMode(false)} variant="ghost" size="icon" className="size-7 text-muted-foreground">
                  <X className="size-4" />
                </Button>
              </div>

              <div style={{ marginBottom: 14, background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 6, padding: '12px 14px' }}>
                <button onClick={() => setRewriteOpen(o => !o)} style={{ width: '100%', background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, fontWeight: 700, cursor: 'pointer', textAlign: 'left', letterSpacing: '0.04em', textTransform: 'uppercase', padding: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>✦ AI Rewrite a Section</span>
                  <span style={{ fontSize: 14, opacity: 0.6 }}>{rewriteOpen ? '▲' : '▼'}</span>
                </button>
                {rewriteOpen && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Select section</div>
                    <Select value={rewriteSection} onValueChange={setRewriteSection}>
                      <SelectTrigger className="w-full mb-2.5 h-8 text-xs">
                        <SelectValue placeholder="— Pick a section —" />
                      </SelectTrigger>
                      <SelectContent>
                        {sections.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Instructions for Claude</div>
                    <Textarea value={rewriteInstr} onChange={e => setRewriteInstr(e.target.value)} placeholder="e.g. Make this section more urgent. Emphasize the fence as a fire pathway." className={`${textareaClass} min-h-20 mb-2.5 text-foreground`} />
                    {rewriteError && <div style={{ fontSize: 12, color: 'var(--warn)', marginBottom: 8 }}>{rewriteError}</div>}
                    <Button onClick={handleRewriteSection} disabled={rewriting || !rewriteSection || !rewriteInstr.trim()} className="w-full text-xs font-bold uppercase tracking-wide h-auto py-2.5">
                      {rewriting ? 'Rewriting…' : 'Rewrite Section'}
                    </Button>
                  </div>
                )}
              </div>

              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Edit markdown directly</div>
              <Textarea value={editMarkdown} onChange={e => setEditMarkdown(e.target.value)} className={`${textareaClass} min-h-[320px] mb-2.5 text-foreground`} />

              {republishMsg && <div style={{ fontSize: 12, color: republishMsg.startsWith('✓') ? 'var(--ok)' : 'var(--warn)', marginBottom: 10 }}>{republishMsg}</div>}

              <div style={{ display: 'flex', gap: 6 }}>
                <Button onClick={() => setEditMode(false)} variant="outline" className="flex-1 font-mono text-xs uppercase tracking-wide h-auto py-2.5">Cancel</Button>
                <Button onClick={handleRepublish} disabled={republishing} className="flex-[2] text-xs font-bold uppercase tracking-wide h-auto py-2.5">
                  {republishing ? 'Publishing…' : '↑ Republish'}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
