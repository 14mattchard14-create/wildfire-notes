'use client'

import { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from 'react'
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

// Splices <mark> tags around any comment's quoted text found verbatim in a
// block's already-rendered HTML — Word/Google-Docs-style comment
// highlights. Deliberately string-based rather than DOM/Range-based: a
// quote only gets highlighted when it appears as a literal, uninterrupted
// substring of the output HTML, which is exactly the case where a plain
// string splice can't corrupt the markup (a quote whose selection crossed
// a <strong>/<em> boundary just won't be found, and silently isn't
// highlighted — the comment itself is never lost, it's still listed in
// that section's Comments panel). indexOf() naturally handles that
// "safe to highlight or not" check for us, no HTML parsing needed.
function applyCommentHighlights(html, quotes) {
  const withQuotes = (quotes || []).filter(q => q.quote)
  if (!withQuotes.length) return html
  let result = html
  const sorted = [...withQuotes].sort((a, b) => b.quote.length - a.quote.length)
  for (const q of sorted) {
    const idx = result.indexOf(q.quote)
    if (idx === -1) continue
    result = `${result.slice(0, idx)}<mark class="pc-comment" data-comment-id="${q.id}">${q.quote}</mark>${result.slice(idx + q.quote.length)}`
  }
  return result
}

// One markdown "line" (a paragraph, a list item, a subheading, a table
// block, a rule) rendered in its normal formatted style. Click it to edit —
// swaps to a small auto-growing textarea pre-filled with that line's raw
// markdown; Enter (without Shift) or blur commits, Escape reverts. Tables
// and rules aren't click-to-edit yet (tables are multi-line and structural
// enough that per-line editing doesn't make sense; rules are just visual
// separators) — everything else is. Clicking highlighted (commented) text
// opens that comment instead of starting an edit.
function EditableLine({ block, onCommit, saving, comments, onCommentClick }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(block.raw)
  // Captured from the rendered element the instant before it's replaced by
  // the textarea, and applied as the textarea's minHeight — without this,
  // the textarea's initial size came from its `rows` count, which is based
  // on literal "\n" characters in the raw markdown (usually 0 or 1 for a
  // single paragraph), not the wrapped visual height the paragraph actually
  // occupies on screen (often 2-4 lines). That mismatch is what made
  // clicking a paragraph visibly shrink/jump before this.
  const [editHeight, setEditHeight] = useState(null)
  useEffect(() => { setDraft(block.raw) }, [block.raw])

  function handleClick(e) {
    const markEl = e.target.closest && e.target.closest('mark.pc-comment')
    if (markEl) { e.stopPropagation(); onCommentClick(markEl.dataset.commentId); return }
    // Math.ceil + a couple px of slack: getBoundingClientRect returns a
    // sub-pixel float, and the textarea's box model can't match the
    // paragraph's to better than ~1px (see the width:auto comment below)
    // — rounding down or matching exactly risked the last line sitting
    // just outside the box, forcing an internal scroll to reach it.
    setEditHeight(Math.ceil(e.currentTarget.getBoundingClientRect().height) + 2)
    setEditing(true)
  }

  if (block.type === 'rule') return <hr />
  if (block.type === 'table') {
    return editing ? (
      <textarea
        autoFocus value={draft} onChange={e => setDraft(e.target.value)}
        onBlur={() => { setEditing(false); if (draft !== block.raw) onCommit(draft) }}
        onKeyDown={e => { if (e.key === 'Escape') { setDraft(block.raw); setEditing(false) } }}
        style={{ width: '100%', minHeight: editHeight ? `${editHeight}px` : 120, fontSize: 12, fontFamily: 'monospace', lineHeight: 1.6, padding: 10, border: '1px solid var(--accent)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box', resize: 'vertical' }}
      />
    ) : (
      <div onClick={handleClick} style={{ cursor: 'text', opacity: saving ? 0.5 : 1 }} dangerouslySetInnerHTML={{ __html: applyCommentHighlights(addHeadingIds(marked.parse(block.raw)), comments) }} />
    )
  }

  if (editing) {
    const commit = () => { setEditing(false); if (draft !== block.raw) onCommit(draft) }
    return (
      <textarea
        autoFocus value={draft} onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Escape') { setDraft(block.raw); setEditing(false) }
          else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.target.blur() }
        }}
        style={{
          // display:block + width:auto (NOT width:'100%') is what actually
          // matters here: the <p>/<li>/<hN> below use the browser's default
          // block width:auto, which lets padding/margin net out to zero
          // width change (that's the whole point of the -6/-6 margin
          // trick). width:'100%' on a border-box element pins the OUTER
          // box to the container instead, so the same padding+border eats
          // into the content area rather than being absorbed by the
          // margin — the textarea ends up with less usable width than the
          // paragraph had, text wraps onto an extra line, and the line
          // that no longer fits gets clipped by the captured minHeight.
          // That mismatch was the "shrinks / cuts off text" bug.
          display: 'block', width: 'auto', fontSize: 13.5, fontFamily: 'inherit', lineHeight: 1.65, padding: '2px 6px', marginLeft: -6, marginRight: -6,
          minHeight: editHeight ? `${editHeight}px` : undefined,
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
    onClick: handleClick,
    style: { cursor: 'text', padding: '2px 6px', marginLeft: -6, marginRight: -6, borderRadius: 4, opacity: saving ? 0.5 : 1, transition: 'background 0.1s' },
    onMouseEnter: e => { e.currentTarget.style.background = 'var(--surface-2)' },
    onMouseLeave: e => { e.currentTarget.style.background = 'transparent' },
    dangerouslySetInnerHTML: { __html: applyCommentHighlights(inlineHtml(block.raw), comments) },
  }

  if (block.type === 'listitem') return <li {...commonProps} />
  const HeadingTag = HEADING_TAGS[block.type]
  if (HeadingTag) return <HeadingTag {...commonProps} />
  return <p {...commonProps} />
}

// Groups the flat block list into render order — consecutive listitem
// blocks get wrapped in one shared <ul>/<ol> (for correct bullet/number
// styling) while each <li> inside stays independently click-to-edit.
function SectionBody({ blocks, onBlockChange, savingIndex, comments, onCommentClick }) {
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
                <EditableLine key={idx} block={blocks[idx]} saving={savingIndex === idx} onCommit={raw => onBlockChange(idx, raw)} comments={comments} onCommentClick={onCommentClick} />
              ))}
            </ListTag>
          )
        }
        return <EditableLine key={gi} block={blocks[g.index]} saving={savingIndex === g.index} onCommit={raw => onBlockChange(g.index, raw)} comments={comments} onCommentClick={onCommentClick} />
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

// One comment, rendered as a margin card — no quote text repeated inside
// it (unlike the old modal version): its position next to the highlighted
// phrase in the text IS the connection, same as Word/Google Docs.
function CommentCard({ comment, active, cardRef, style, onToggleResolved, onDelete }) {
  return (
    <div
      ref={cardRef} id={`pc-comment-${comment.id}`}
      style={{
        fontSize: 11.5, padding: '8px 10px', borderRadius: 6, boxSizing: 'border-box',
        borderLeft: `3px solid ${comment.resolved ? 'var(--line)' : 'var(--accent)'}`,
        background: comment.resolved ? 'transparent' : 'var(--surface-2)', opacity: comment.resolved ? 0.55 : 1,
        boxShadow: active ? '0 0 0 2px var(--accent)' : 'none', transition: 'box-shadow 0.15s, top 0.15s',
        ...style,
      }}
    >
      <p style={{ margin: '0 0 6px', color: 'var(--text)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{comment.body}</p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>{fmtDate(comment.created_at)}</span>
        <button onClick={() => onToggleResolved(comment)} style={{ fontSize: 9.5, background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0 }}>
          {comment.resolved ? 'Reopen' : 'Resolve'}
        </button>
        <button onClick={() => onDelete(comment)} style={{ fontSize: 9.5, background: 'none', border: 'none', color: 'var(--warn)', cursor: 'pointer', padding: 0 }}>
          Delete
        </button>
      </div>
    </div>
  )
}

// Right-margin comment column, positioned to sit next to the plan text —
// exactly like Word's/Google Docs' comment margin. Every comment card is
// vertically aligned with its highlighted <mark> in the text via a
// two-pass layout: first find where each mark actually sits (relative to
// containerRef, which shares a top edge with this column since both are
// flex-start siblings in the same row), then — since two comments can sit
// close enough in the text that their cards would overlap — push any card
// down past the bottom of the one above it, using each card's *measured*
// real height (cards vary in height with comment length, so this can't be
// precomputed, only measured after render).
//
// A MutationObserver on the content container re-triggers the first pass
// whenever the rendered text changes for any reason (a line save, a block
// toggling into/out of edit mode, a new highlight appearing) — the content
// area has no lifted-up "layout changed" signal of its own, and watching
// its actual DOM is the simplest thing that stays correct regardless of
// what caused the reflow.
function CommentMargin({ comments, containerRef, activeId, onToggleResolved, onDelete }) {
  const [desiredTop, setDesiredTop] = useState({})
  const [cardHeights, setCardHeights] = useState({})
  const cardRefs = useRef({})

  const recomputeDesired = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    const containerRect = container.getBoundingClientRect()
    const seen = new Set()
    const next = {}
    container.querySelectorAll('mark.pc-comment[data-comment-id]').forEach(markEl => {
      const id = markEl.dataset.commentId
      if (seen.has(id)) return // a repeated quote elsewhere in the section — anchor to the first hit only
      seen.add(id)
      next[id] = markEl.getBoundingClientRect().top - containerRect.top
    })
    setDesiredTop(next)
  }, [containerRef])

  useLayoutEffect(() => {
    recomputeDesired()
    const container = containerRef.current
    if (!container) return
    const mo = new MutationObserver(() => recomputeDesired())
    mo.observe(container, { childList: true, subtree: true, characterData: true, attributes: true })
    window.addEventListener('resize', recomputeDesired)
    return () => { mo.disconnect(); window.removeEventListener('resize', recomputeDesired) }
  }, [recomputeDesired, comments.length])

  const anchored = useMemo(() => comments.filter(c => desiredTop[c.id] !== undefined), [comments, desiredTop])
  const unanchored = useMemo(() => comments.filter(c => desiredTop[c.id] === undefined), [comments, desiredTop])
  const orderedIds = useMemo(
    () => [...anchored].sort((a, b) => desiredTop[a.id] - desiredTop[b.id]).map(c => c.id),
    [anchored, desiredTop]
  )

  // Second pass: measure actual rendered card heights, run after every
  // render (no deps array) since content/height can change without the
  // id list itself changing (e.g. resolving a comment shrinks its card).
  useLayoutEffect(() => {
    const heights = {}
    orderedIds.forEach(id => { const el = cardRefs.current[id]; if (el) heights[id] = el.offsetHeight })
    setCardHeights(prev => {
      const changed = orderedIds.some(id => prev[id] !== heights[id])
      return changed ? { ...prev, ...heights } : prev
    })
  })

  const finalTop = useMemo(() => {
    const CARD_GAP = 8
    let cursor = 0
    const result = {}
    orderedIds.forEach(id => {
      const top = Math.max(desiredTop[id] ?? 0, cursor)
      result[id] = top
      cursor = top + (cardHeights[id] || 56) + CARD_GAP
    })
    return result
  }, [orderedIds, desiredTop, cardHeights])

  const bottomMost = Object.values(finalTop).length ? Math.max(...Object.values(finalTop)) + 80 : 0

  // No outer wrapper here on purpose — the caller (PlanPage) provides one
  // shared position:relative column that this and PendingCommentTrigger
  // both render into, so a pending trigger's `top` and an existing card's
  // `top` are measured against the exact same origin.
  return (
    <>
      {anchored.map(c => (
        <CommentCard
          key={c.id} comment={c} active={activeId === c.id}
          cardRef={el => { if (el) cardRefs.current[c.id] = el }}
          style={{ position: 'absolute', top: finalTop[c.id] ?? desiredTop[c.id], left: 0, right: 0 }}
          onToggleResolved={onToggleResolved} onDelete={onDelete}
        />
      ))}
      {unanchored.length > 0 && (
        <div style={{ position: 'absolute', top: bottomMost, left: 0, right: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 2px' }}>
            Other comments (text since edited)
          </p>
          {unanchored.map(c => (
            <CommentCard key={c.id} comment={c} active={activeId === c.id} onToggleResolved={onToggleResolved} onDelete={onDelete} />
          ))}
        </div>
      )}
    </>
  )
}

// The "add a comment" entry point once text is selected — a small circular
// button positioned in the margin, right next to the selection (not
// floating over the text itself, so it never obscures what's selected).
// Starts collapsed to just the button; clicking it (or arriving here via
// the right-click menu, which skips straight to composing=true) expands
// it into the compose box in place. Dismissed by clicking outside it,
// Escape, or a successful post.
function PendingCommentTrigger({ pending, composing, onExpand, onCancel, onSubmit }) {
  const [draft, setDraft] = useState('')
  const [posting, setPosting] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleOutside(e) { if (ref.current && !ref.current.contains(e.target)) onCancel() }
    function handleKey(e) { if (e.key === 'Escape') onCancel() }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onCancel])

  async function submit() {
    if (!draft.trim()) return
    setPosting(true)
    await onSubmit(draft.trim())
    setPosting(false)
  }

  return (
    <div ref={ref} style={{ position: 'absolute', top: pending.top, left: 0, right: 0, zIndex: 40 }}>
      {!composing ? (
        <button
          onClick={onExpand} title="Add comment"
          style={{ ...btnAccent, borderRadius: 999, width: 30, height: 30, padding: 0, fontSize: 14, lineHeight: 1, boxShadow: '0 2px 8px rgba(0,0,0,0.25)' }}
        >
          💬
        </button>
      ) : (
        <div style={{ ...card, width: 250, boxSizing: 'border-box', background: 'var(--bg)', boxShadow: '0 4px 20px rgba(0,0,0,0.35)' }}>
          <textarea
            autoFocus value={draft} onChange={e => setDraft(e.target.value)} placeholder="Leave a comment…"
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit() }}
            style={{ width: '100%', fontSize: 12, padding: '6px 8px', border: '1px solid var(--line)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', minHeight: 52, resize: 'vertical', boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 6 }}>
            <button onClick={onCancel} style={btn}>Cancel</button>
            <button onClick={submit} disabled={posting || !draft.trim()} style={{ ...btnAccent, opacity: posting ? 0.6 : 1 }}>
              {posting ? '…' : 'Post'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Custom context menu shown instead of the browser's native one when the
// user right-clicks with a selection active inside the plan — the other
// entry point to leaving a comment, alongside the margin trigger button.
function SelectionContextMenu({ x, y, onAddComment, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    function handleOutside(e) { if (ref.current && !ref.current.contains(e.target)) onClose() }
    function handleKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed', left: x, top: y, zIndex: 70, minWidth: 160, padding: 4,
        background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
      }}
    >
      <button
        onClick={onAddComment}
        style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', textAlign: 'left', fontSize: 12.5, padding: '7px 10px', background: 'none', border: 'none', borderRadius: 4, cursor: 'pointer', color: 'var(--text)' }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
      >
        💬 Add Comment
      </button>
    </div>
  )
}

function SectionBlock({ section, onSave, savingIndex, onShowHistory, comments, onFocusComment }) {
  // section.body's first line is the "## Heading" line itself (see
  // parseSections) — kept out of the block breakdown below and stitched
  // back on unchanged when a block edit is saved, since renaming the
  // heading here would break the heading-string lookup replaceSection()
  // uses server-side (and the slug this section is anchored/linked at).
  const headingLine = useMemo(() => section.body.split('\n')[0], [section.body])
  const restBody = useMemo(() => section.body.split('\n').slice(1).join('\n'), [section.body])
  const blocks = useMemo(() => parseBlocks(restBody), [restBody])
  const sectionComments = useMemo(() => comments.filter(c => c.section === section.heading), [comments, section.heading])

  function handleBlockChange(index, newRaw) {
    const updated = blocks.map((b, i) => (i === index ? { ...b, raw: newRaw } : b))
    onSave(`${headingLine}\n\n${blocksToMarkdown(updated)}`, index)
  }

  return (
    <section id={section.slug} style={{ scrollMarginTop: 90, marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
        <button onClick={onShowHistory} style={btn}>History</button>
      </div>

      {/* data-section anchors the mouseup selection-listener (see PlanPage)
          to this section, so a comment made from a selection anywhere in
          here knows which section it belongs to. */}
      <div className="plan-content" data-section={section.heading}>
        {/* Static, not click-to-edit — see comment above on why the heading
            line is kept out of the editable block list. */}
        <h2>{section.heading}</h2>
        <SectionBody
          blocks={blocks} onBlockChange={handleBlockChange} savingIndex={savingIndex}
          comments={sectionComments} onCommentClick={onFocusComment}
        />
      </div>
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
  const [pendingComment, setPendingComment] = useState(null) // { section, quote, top } | null — top is relative to contentRef
  const [composing, setComposing] = useState(false) // pendingComment shows just the 💬 button until this flips true
  const [contextMenu, setContextMenu] = useState(null) // { x, y, section, quote, top } | null
  const [activeCommentId, setActiveCommentId] = useState(null) // flashes/scrolls the margin card when a highlight is clicked
  const contentRef = useRef(null) // the scrollable content column — CommentMargin measures mark positions against this

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

  async function handleAddComment(section, body, quote) {
    const res = await authFetch('/api/business-plan-comments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section, body, quote }),
    }).then(r => r.json())
    if (res.error) { alert('Could not post comment: ' + res.error); return }
    setComments(prev => [...prev, res.comment])
  }

  // Resolves the current window selection down to (section, quote, top) —
  // top measured relative to contentRef so it can be used directly as a
  // margin element's `top`, same coordinate space CommentMargin's cards
  // use. Returns null if there's no usable selection (collapsed, too
  // short, or outside any section) — shared by both entry points to
  // adding a comment (the mouseup trigger and the right-click menu).
  function resolveSelection() {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || !sel.rangeCount) return null
    const text = sel.toString().trim()
    if (text.length < 3) return null
    let node = sel.getRangeAt(0).commonAncestorContainer
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement
    const sectionEl = node?.closest?.('[data-section]')
    if (!sectionEl || !contentRef.current) return null
    const containerRect = contentRef.current.getBoundingClientRect()
    const rangeRect = sel.getRangeAt(0).getBoundingClientRect()
    return { section: sectionEl.dataset.section, quote: text, top: rangeRect.top - containerRect.top }
  }

  // Selecting text anywhere inside a section's rendered content shows the
  // small 💬 trigger button in the margin, next to the selection. Native
  // <textarea> selections (mid-line-edit) don't reach here — form controls
  // have their own selection model, outside window.getSelection() — so
  // this can't collide with editing a line.
  function handleContentMouseUp() {
    const resolved = resolveSelection()
    if (!resolved) return
    setPendingComment(resolved)
    setComposing(false)
  }

  // Right-click with an active selection swaps in a small "Add Comment"
  // menu instead of the browser's native context menu — the second entry
  // point to commenting, alongside the margin trigger button.
  function handleContentContextMenu(e) {
    const resolved = resolveSelection()
    if (!resolved) return // no selection under the cursor — let the native menu show
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, ...resolved })
  }

  function handleContextMenuAddComment() {
    setPendingComment({ section: contextMenu.section, quote: contextMenu.quote, top: contextMenu.top })
    setComposing(true) // right-click already expresses clear intent — skip straight to the compose box
    setContextMenu(null)
  }

  async function handlePostSelectionComment(body) {
    await handleAddComment(pendingComment.section, body, pendingComment.quote)
    setPendingComment(null)
    setComposing(false)
    window.getSelection()?.removeAllRanges()
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

  // Clicking a highlighted phrase scrolls/flashes its margin card instead
  // of opening anything — the card is always visible over there already.
  function handleFocusComment(id) {
    setActiveCommentId(id)
    document.getElementById(`pc-comment-${id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    setTimeout(() => setActiveCommentId(current => (current === id ? null : current)), 2200)
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
    <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start', maxWidth: 1440 }}>
      <nav style={{ width: 190, flexShrink: 0, position: 'sticky', top: 90, display: 'flex', flexDirection: 'column', gap: 2 }}>
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

      {/* onMouseUp/onContextMenu here (not on individual sections) means
          one pair of listeners covers every section; resolveSelection()
          figures out which section a selection belongs to via the closest
          data-section ancestor SectionBlock renders. contentRef is what
          CommentMargin and the margin column below measure mark/selection
          positions against — content and margin are both flex-start
          siblings in this row, so they share a top edge and a `top: X`
          lines up correctly between them. */}
      <div
        ref={contentRef} style={{ flex: 1, minWidth: 0, paddingBottom: 60 }}
        onMouseUp={handleContentMouseUp} onContextMenu={handleContentContextMenu}
      >
        <div className="plan-content" dangerouslySetInnerHTML={{ __html: preambleHtml }} />

        {sections.map((s, i) => (
          <div key={s.slug} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--line)', paddingTop: i === 0 ? 0 : 16, marginTop: i === 0 ? 0 : 24 }}>
            <SectionBlock
              section={s}
              savingIndex={savingBlock?.slug === s.slug ? savingBlock.index : null}
              onSave={(newBody, index) => handleSave(s, newBody, index)}
              onShowHistory={() => setHistorySlug(s.heading)}
              comments={comments}
              onFocusComment={handleFocusComment}
            />
          </div>
        ))}
      </div>

      {/* One shared position:relative column for both the persisted
          comment cards and the pending "add a comment" trigger, so their
          `top` values are measured against the same origin. */}
      <div style={{ position: 'relative', width: 250, flexShrink: 0 }}>
        <CommentMargin
          comments={comments} containerRef={contentRef} activeId={activeCommentId}
          onToggleResolved={handleToggleResolved} onDelete={handleDeleteComment}
        />
        {pendingComment && (
          <PendingCommentTrigger
            pending={pendingComment} composing={composing}
            onExpand={() => setComposing(true)}
            onCancel={() => { setPendingComment(null); setComposing(false) }}
            onSubmit={handlePostSelectionComment}
          />
        )}
      </div>

      {historySlug && (
        <HistoryPopup heading={historySlug} versions={versions} onClose={() => setHistorySlug(null)} />
      )}

      {contextMenu && (
        <SelectionContextMenu
          x={contextMenu.x} y={contextMenu.y}
          onAddComment={handleContextMenuAddComment}
          onClose={() => setContextMenu(null)}
        />
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
        .plan-content mark.pc-comment { background: rgba(255, 196, 0, 0.35); color: inherit; padding: 0 1px; border-radius: 2px; cursor: pointer; }
        .plan-content mark.pc-comment:hover { background: rgba(255, 196, 0, 0.6); }
      `}</style>
    </div>
  )
}
