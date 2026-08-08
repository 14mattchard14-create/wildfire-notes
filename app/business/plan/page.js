'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { marked } from 'marked'
import { authFetch } from '@/lib/authFetch'
import { wordDiff } from '@/lib/reportSchema'
import { parseSections, parseBlocks, blocksToMarkdown, slugify } from '@/lib/planSchema'

// Editable, version-tracked, commentable view of the business plan
// (migration 027 — business_plan / business_plan_versions /
// business_plan_comments). Edits happen one "## Section" at a time, but the
// section itself is never swapped for a raw-markdown textarea — instead
// each section is split into small blocks (subheadings, list items, table
// blocks, paragraphs) via parseBlocks(), and the page always shows the
// fully rendered/formatted view. Clicking any one line turns just that
// line into a small editable text field, styled inline; blurring it saves
// — reassembling the section's full body from all its blocks via
// blocksToMarkdown() and posting to /api/business-plan-db, same as before.
// This keeps editing feeling like editing the document itself rather than
// its markdown source, while the backend/versioning/diffing underneath is
// unchanged (still one edit = one section-scoped version row).
//
// business/business-plan.md itself is untouched by any of this — the file
// stays in git as the originally captured version; the "Import" action
// below is a one-time copy into the database, and from then on the DB row
// is what's live.

function addHeadingIds(html) {
  return html.replace(/<(h[1-4])>(.*?)<\/\1>/g, (m, tag, inner) => `<${tag} id="${slugify(inner)}">${inner}</${tag}>`)
}

// marked.parseInline() renders just the inline formatting (bold, italic,
// links, code) without wrapping the result in a <p>, so a block's preview
// HTML can be dropped straight into whatever tag actually matches its
// markdown semantics (a <li>, an <h3>, a plain paragraph <div>) instead of
// nesting a <p> inside it.
function inlineHtml(text) {
  return marked.parseInline((text || '').replace(/^([-*]|\d+\.)\s+/, '').replace(/^#{3,6}\s+/, ''))
}

const HEADING_TAGS = { heading3: 'h3', heading4: 'h4', heading5: 'h5', heading6: 'h6' }

// One markdown "line" (a paragraph, a list item, a subheading, a table
// block, a rule) rendered in its normal formatted style. Click it to edit —
// swaps to a small auto-growing textarea pre-filled with that line's raw
// markdown; Enter (without Shift) or blur commits, Escape reverts. Tables
// and rules aren't click-to-edit yet (tables are multi-line and structural
// enough that per-line editing doesn't make sense; rules are just visual
// separators) — everything else is.
function EditableLine({ block, onCommit, saving }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(block.raw)
  useEffect(() => { setDraft(block.raw) }, [block.raw])

  if (block.type === 'rule') return <hr />
  if (block.type === 'table') {
    return editing ? (
      <textarea
        autoFocus value={draft} onChange={e => setDraft(e.target.value)}
        onBlur={() => { setEditing(false); if (draft !== block.raw) onCommit(draft) }}
        onKeyDown={e => { if (e.key === 'Escape') { setDraft(block.raw); setEditing(false) } }}
        style={{ width: '100%', minHeight: 120, fontSize: 12, fontFamily: 'monospace', lineHeight: 1.6, padding: 10, border: '1px solid var(--accent)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box', resize: 'vertical' }}
      />
    ) : (
      <div onClick={() => setEditing(true)} style={{ cursor: 'text', opacity: saving ? 0.5 : 1 }} dangerouslySetInnerHTML={{ __html: addHeadingIds(marked.parse(block.raw)) }} />
    )
  }

  if (editing) {
    const commit = () => { setEditing(false); if (draft !== block.raw) onCommit(draft) }
    return (
      <textarea
        autoFocus value={draft} onChange={e => setDraft(e.target.value)}
        onFocus={e => e.target.setSelectionRange(e.target.value.length, e.target.value.length)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Escape') { setDraft(block.raw); setEditing(false) }
          else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.target.blur() }
        }}
        rows={Math.max(1, draft.split('\n').length)}
        style={{
          width: '100%', fontSize: 13.5, fontFamily: 'inherit', lineHeight: 1.65, padding: '2px 6px', marginLeft: -6, marginRight: -6,
          border: '1px solid var(--accent)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box', resize: 'vertical',
        }}
      />
    )
  }

  // Horizontal-only negative margin so the click-hover highlight bleeds a
  // little past the text without disturbing the vertical spacing the
  // .plan-content CSS below sets between paragraphs/list items/headings —
  // an inline `margin` shorthand here would win over that stylesheet rule
  // and collapse everything to zero gap.
  const commonProps = {
    onClick: () => setEditing(true),
    style: { cursor: 'text', padding: '2px 6px', marginLeft: -6, marginRight: -6, borderRadius: 4, opacity: saving ? 0.5 : 1, transition: 'background 0.1s' },
    onMouseEnter: e => { e.currentTarget.style.background = 'var(--surface-2)' },
    onMouseLeave: e => { e.currentTarget.style.background = 'transparent' },
    dangerouslySetInnerHTML: { __html: inlineHtml(block.raw) },
  }

  if (block.type === 'listitem') return <li {...commonProps} />
  const HeadingTag = HEADING_TAGS[block.type]
  if (HeadingTag) return <HeadingTag {...commonProps} />
  return <p {...commonProps} />
}

// Groups the flat block list into render order — consecutive listitem
// blocks get wrapped in one shared <ul>/<ol> (for correct bullet/number
// styling) while each <li> inside stays independently click-to-edit.
function SectionBody({ blocks, onBlockChange, savingIndex }) {
  const groups = []
  let i = 0
  while (i < blocks.length) {
    if (blocks[i].type === 'listitem') {
      const start = i
      const items = []
      while (i < blocks.length && blocks[i].type === 'listitem') { items.push(i); i++ }
      groups.push({ kind: 'list', ordered: blocks[start].ordered, items })
    } else {
      groups.push({ kind: 'single', index: i })
      i++
    }
  }
  return (
    <>
      {groups.map((g, gi) => {
        if (g.kind === 'list') {
          const ListTag = g.ordered ? 'ol' : 'ul'
          return (
            <ListTag key={gi}>
              {g.items.map(idx => (
                <EditableLine key={idx} block={blocks[idx]} saving={savingIndex === idx} onCommit={raw => onBlockChange(idx, raw)} />
              ))}
            </ListTag>
          )
        }
        return <EditableLine key={gi} block={blocks[g.index]} saving={savingIndex === g.index} onCommit={raw => onBlockChange(g.index, raw)} />
      })}
    </>
  )
}

const label = { display: 'block', fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }
const card = { border: '1px solid var(--line)', borderRadius: 8, padding: 14, background: 'var(--surface)' }
const btn = { fontSize: 11.5, fontWeight: 600, background: 'none', border: '1px solid var(--line)', borderRadius: 4, padding: '5px 10px', cursor: 'pointer', color: 'var(--text)' }
const btnAccent = { ...btn, color: '#fff', background: 'var(--accent)', border: 'none', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }

function fmtDate(d) {
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function DiffView({ before, after }) {
  const tokens = useMemo(() => wordDiff(before || '', after || ''), [before, after])
  return (
    <div style={{ fontSize: 12, lineHeight: 1.6, fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
      {tokens.map((t, i) => {
        if (t.type === 'same') return <span key={i} style={{ color: 'var(--text-muted)' }}>{t.text}</span>
        if (t.type === 'removed') return <span key={i} style={{ color: 'var(--warn)', textDecoration: 'line-through', opacity: 0.7 }}>{t.text}</span>
        return <span key={i} style={{ color: 'var(--ok)', background: 'rgba(0,150,0,0.08)' }}>{t.text}</span>
      })}
    </div>
  )
}

function HistoryPopup({ heading, versions, onClose }) {
  const relevant = versions.filter(v => v.section === heading)
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onClose}>
      <div style={{ ...card, maxWidth: 620, width: '100%', maxHeight: '80vh', overflowY: 'auto', background: 'var(--bg)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h3 style={{ fontSize: 13.5, fontWeight: 700, margin: 0, color: 'var(--text)' }}>History — {heading}</h3>
          <button onClick={onClose} style={btn}>Close</button>
        </div>
        {relevant.length === 0 ? (
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>No edits recorded for this section yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {relevant.map(v => (
              <div key={v.id} style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
                <p style={{ fontSize: 10.5, color: 'var(--text-muted)', margin: '0 0 6px' }}>{fmtDate(v.created_at)}</p>
                <DiffView before={v.section_before} after={v.section_after} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function CommentThread({ section, comments, onAdd, onToggleResolved, onDelete }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [posting, setPosting] = useState(false)
  const list = comments.filter(c => c.section === section)
  const openCount = list.filter(c => !c.resolved).length

  async function submit() {
    if (!draft.trim()) return
    setPosting(true)
    await onAdd(section, draft.trim())
    setDraft('')
    setPosting(false)
  }

  return (
    <div style={{ marginTop: 10 }}>
      <button onClick={() => setOpen(o => !o)} style={{ ...btn, fontSize: 11 }}>
        💬 {list.length ? `${list.length} comment${list.length === 1 ? '' : 's'}${openCount ? ` (${openCount} open)` : ''}` : 'Comment'}
      </button>
      {open && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 4, borderLeft: '2px solid var(--line)' }}>
          {list.map(c => (
            <div key={c.id} style={{ fontSize: 12, padding: '6px 10px', borderRadius: 6, background: c.resolved ? 'transparent' : 'var(--surface-2)', opacity: c.resolved ? 0.6 : 1 }}>
              <p style={{ margin: '0 0 4px', color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{c.body}</p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{fmtDate(c.created_at)}</span>
                <button onClick={() => onToggleResolved(c)} style={{ fontSize: 10, background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0 }}>
                  {c.resolved ? 'Reopen' : 'Resolve'}
                </button>
                <button onClick={() => onDelete(c)} style={{ fontSize: 10, background: 'none', border: 'none', color: 'var(--warn)', cursor: 'pointer', padding: 0 }}>
                  Delete
                </button>
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 6 }}>
            <textarea
              value={draft} onChange={e => setDraft(e.target.value)} placeholder="Add a comment on this section…"
              style={{ flex: 1, fontSize: 12, padding: '6px 8px', border: '1px solid var(--line)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', minHeight: 36, resize: 'vertical' }}
            />
            <button onClick={submit} disabled={posting || !draft.trim()} style={{ ...btnAccent, alignSelf: 'flex-start', opacity: posting ? 0.6 : 1 }}>
              {posting ? '…' : 'Post'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function SectionBlock({ section, onSave, savingIndex, onShowHistory, comments, onAddComment, onToggleResolved, onDeleteComment }) {
  // section.body's first line is the "## Heading" line itself (see
  // parseSections) — kept out of the block breakdown below and stitched
  // back on unchanged when a block edit is saved, since renaming the
  // heading here would break the heading-string lookup replaceSection()
  // uses server-side (and the slug this section is anchored/linked at).
  const headingLine = useMemo(() => section.body.split('\n')[0], [section.body])
  const restBody = useMemo(() => section.body.split('\n').slice(1).join('\n'), [section.body])
  const blocks = useMemo(() => parseBlocks(restBody), [restBody])

  function handleBlockChange(index, newRaw) {
    const updated = blocks.map((b, i) => (i === index ? { ...b, raw: newRaw } : b))
    onSave(`${headingLine}\n\n${blocksToMarkdown(updated)}`, index)
  }

  return (
    <section id={section.slug} style={{ scrollMarginTop: 90, marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
        <button onClick={onShowHistory} style={btn}>History</button>
      </div>

      <div className="plan-content">
        {/* Static, not click-to-edit — see comment above on why the heading
            line is kept out of the editable block list. */}
        <h2>{section.heading}</h2>
        <SectionBody blocks={blocks} onBlockChange={handleBlockChange} savingIndex={savingIndex} />
      </div>

      <CommentThread
        section={section.heading} comments={comments}
        onAdd={onAddComment} onToggleResolved={onToggleResolved} onDelete={onDeleteComment}
      />
    </section>
  )
}

export default function PlanPage() {
  const [plan, setPlan] = useState(undefined) // undefined = loading, null = no plan yet
  const [versions, setVersions] = useState([])
  const [comments, setComments] = useState([])
  const [error, setError] = useState(null)
  const [importing, setImporting] = useState(false)
  const [savingBlock, setSavingBlock] = useState(null) // { slug, index } | null
  const [historySlug, setHistorySlug] = useState(null)
  const [activeSlug, setActiveSlug] = useState(null)

  const load = useCallback(async () => {
    const [planRes, commentsRes] = await Promise.all([
      authFetch('/api/business-plan-db').then(r => r.json()),
      authFetch('/api/business-plan-comments').then(r => r.json()),
    ])
    if (planRes.error) { setError(planRes.error); return }
    setPlan(planRes.plan)
    setVersions(planRes.versions || [])
    if (!commentsRes.error) setComments(commentsRes.comments || [])
  }, [])

  useEffect(() => { load() }, [load])

  const { preamble, sections } = useMemo(() => (plan ? parseSections(plan.content) : { preamble: '', sections: [] }), [plan])
  const preambleHtml = useMemo(() => (preamble ? addHeadingIds(marked.parse(preamble)) : ''), [preamble])

  useEffect(() => {
    if (!sections.length) return
    const headings = sections.map(s => document.getElementById(s.slug)).filter(Boolean)
    if (!headings.length) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActiveSlug(visible[0].target.id)
      },
      { rootMargin: '0px 0px -70% 0px' }
    )
    headings.forEach(h => observer.observe(h))
    return () => observer.disconnect()
  }, [sections])

  async function handleImport() {
    setImporting(true)
    const fileRes = await authFetch('/api/business-plan').then(r => r.json())
    if (fileRes.error) { setError(fileRes.error); setImporting(false); return }
    const seedRes = await authFetch('/api/business-plan-db', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'seed', content: fileRes.content }),
    }).then(r => r.json())
    setImporting(false)
    if (seedRes.error) { setError(seedRes.error); return }
    await load()
  }

  // Fires on blur/Enter for a single edited line — reassembled to the full
  // section body by SectionBlock before it gets here. index is just which
  // block within the section is mid-save, for the dimmed-while-saving look
  // on that one line; nothing else in the section is blocked from editing
  // while this is in flight.
  async function handleSave(section, newBody, index) {
    setSavingBlock({ slug: section.slug, index })
    const res = await authFetch('/api/business-plan-db', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'edit', heading: section.heading, newBody }),
    }).then(r => r.json())
    setSavingBlock(null)
    if (res.error) { alert('Save failed: ' + res.error); return }
    await load()
  }

  async function handleAddComment(section, body) {
    const res = await authFetch('/api/business-plan-comments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section, body }),
    }).then(r => r.json())
    if (res.error) { alert('Could not post comment: ' + res.error); return }
    setComments(prev => [...prev, res.comment])
  }

  async function handleToggleResolved(comment) {
    const res = await authFetch('/api/business-plan-comments', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: comment.id, resolved: !comment.resolved }),
    }).then(r => r.json())
    if (res.error) { alert('Could not update comment: ' + res.error); return }
    setComments(prev => prev.map(c => (c.id === comment.id ? res.comment : c)))
  }

  async function handleDeleteComment(comment) {
    if (!confirm('Delete this comment?')) return
    const res = await authFetch(`/api/business-plan-comments?id=${comment.id}`, { method: 'DELETE' }).then(r => r.json())
    if (res.error) { alert('Could not delete comment: ' + res.error); return }
    setComments(prev => prev.filter(c => c.id !== comment.id))
  }

  if (error) return <p style={{ fontSize: 13, color: 'var(--warn)' }}>{error}</p>
  if (plan === undefined) return <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading…</p>

  if (plan === null) {
    return (
      <div style={{ ...card, maxWidth: 520 }}>
        <p style={{ fontSize: 13, color: 'var(--text)', margin: '0 0 12px' }}>
          No plan in the database yet — import it from <code style={{ fontSize: 11.5 }}>business/business-plan.md</code> to start editing.
        </p>
        <button onClick={handleImport} disabled={importing} style={{ ...btnAccent, padding: '9px 14px', opacity: importing ? 0.6 : 1 }}>
          {importing ? 'Importing…' : 'Import from business-plan.md'}
        </button>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '10px 0 0', lineHeight: 1.5 }}>
          This copies the file's current content into the database once. From then on, the database version is what's live and editable here — the file in the repo stays as the originally captured version.
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start', maxWidth: 1100 }}>
      <nav style={{ width: 200, flexShrink: 0, position: 'sticky', top: 90, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
          Sections
        </span>
        {sections.map(s => {
          const openComments = comments.filter(c => c.section === s.heading && !c.resolved).length
          return (
            <a
              key={s.slug} href={`#${s.slug}`}
              style={{
                fontSize: 12, padding: '5px 8px', borderRadius: 4, textDecoration: 'none', display: 'flex', justifyContent: 'space-between', gap: 4,
                color: activeSlug === s.slug ? 'var(--accent)' : 'var(--text-muted)',
                background: activeSlug === s.slug ? 'var(--surface-2)' : 'transparent',
                fontWeight: activeSlug === s.slug ? 700 : 500,
              }}
            >
              <span>{s.heading.replace(/^Section \d+:\s*/, '')}</span>
              {openComments > 0 && <span style={{ fontSize: 10, color: 'var(--warn)' }}>{openComments}</span>}
            </a>
          )
        })}
        <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 14, lineHeight: 1.5 }}>
          Last saved {fmtDate(plan.updated_at)}. Editable here — the git file no longer updates automatically.
        </p>
      </nav>

      <div style={{ flex: 1, minWidth: 0, paddingBottom: 60 }}>
        <div className="plan-content" dangerouslySetInnerHTML={{ __html: preambleHtml }} />

        {sections.map((s, i) => (
          <div key={s.slug} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--line)', paddingTop: i === 0 ? 0 : 16, marginTop: i === 0 ? 0 : 24 }}>
            <SectionBlock
              section={s}
              savingIndex={savingBlock?.slug === s.slug ? savingBlock.index : null}
              onSave={(newBody, index) => handleSave(s, newBody, index)}
              onShowHistory={() => setHistorySlug(s.heading)}
              comments={comments}
              onAddComment={handleAddComment}
              onToggleResolved={handleToggleResolved}
              onDeleteComment={handleDeleteComment}
            />
          </div>
        ))}
      </div>

      {historySlug && (
        <HistoryPopup heading={historySlug} versions={versions} onClose={() => setHistorySlug(null)} />
      )}

      <style jsx global>{`
        .plan-content h1 { font-size: 22px; font-weight: 700; margin: 0 0 6px; color: var(--text); }
        .plan-content h2 { font-size: 17px; font-weight: 700; margin: 0 0 12px; color: var(--text); }
        .plan-content h3 { font-size: 14px; font-weight: 700; margin: 22px 0 8px; color: var(--text); }
        .plan-content h4 { font-size: 12.5px; font-weight: 700; margin: 16px 0 6px; color: var(--text); text-transform: uppercase; letter-spacing: 0.03em; }
        .plan-content p { margin: 0 0 12px; font-size: 13.5px; line-height: 1.65; color: var(--text); }
        .plan-content ul, .plan-content ol { margin: 0 0 12px; padding-left: 22px; }
        .plan-content li { margin-bottom: 4px; font-size: 13.5px; line-height: 1.65; color: var(--text); }
        .plan-content strong { font-weight: 700; color: var(--text); }
        .plan-content em { font-style: italic; }
        .plan-content code { font-family: monospace; font-size: 12px; background: var(--surface-2); padding: 1px 5px; border-radius: 3px; }
        .plan-content a { color: var(--accent); text-decoration: underline; }
        .plan-content hr { border: none; border-top: 1px solid var(--line); margin: 24px 0; }
        .plan-content table { width: 100%; border-collapse: collapse; margin: 0 0 16px; font-size: 12.5px; }
        .plan-content th, .plan-content td { border: 1px solid var(--line); padding: 6px 10px; text-align: left; }
        .plan-content th { background: var(--surface-2); font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--text-muted); }
        .plan-content blockquote { margin: 0 0 12px; padding: 8px 14px; border-left: 3px solid var(--accent); background: var(--surface-2); color: var(--text-muted); }
      `}</style>
    </div>
  )
}
