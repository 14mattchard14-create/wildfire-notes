'use client'

import { useState, useEffect, useMemo } from 'react'
import { marked } from 'marked'
import { authFetch } from '@/lib/authFetch'

// Read-only view of business/business-plan.md, served live from the repo
// (app/api/business-plan/route.js reads the actual file — no separate copy
// to fall out of sync). This is the "review it" pass: a formatted, browsable
// version of the plan with a section jump-nav. Editing/commenting/version
// history would need their own design pass — the plan is still git-tracked
// and reconciled against legal-risk-notes.md / competitive-research.md by
// hand for now (see business/README.md).

function slugify(text) {
  return text.toLowerCase().replace(/<[^>]+>/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function addHeadingIds(html) {
  return html.replace(/<(h[1-4])>(.*?)<\/\1>/g, (m, tag, inner) => `<${tag} id="${slugify(inner)}">${inner}</${tag}>`)
}

function extractSections(markdown) {
  const lines = markdown.split('\n')
  return lines
    .filter(l => /^##\s+/.test(l))
    .map(l => l.replace(/^##\s+/, '').trim())
    .map(text => ({ text, slug: slugify(text) }))
}

export default function PlanPage() {
  const [content, setContent] = useState(null)
  const [updatedAt, setUpdatedAt] = useState(null)
  const [error, setError] = useState(null)
  const [activeSlug, setActiveSlug] = useState(null)

  useEffect(() => {
    let cancelled = false
    authFetch('/api/business-plan')
      .then(res => res.json())
      .then(data => {
        if (cancelled) return
        if (data.error) { setError(data.error); return }
        setContent(data.content)
        setUpdatedAt(data.updatedAt)
      })
      .catch(err => { if (!cancelled) setError(err.message) })
    return () => { cancelled = true }
  }, [])

  const sections = useMemo(() => (content ? extractSections(content) : []), [content])
  const html = useMemo(() => (content ? addHeadingIds(marked.parse(content)) : ''), [content])

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
  }, [sections, html])

  if (error) return <p style={{ fontSize: 13, color: 'var(--warn)' }}>{error}</p>
  if (!content) return <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading…</p>

  return (
    <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start', maxWidth: 1100 }}>
      <nav style={{ width: 200, flexShrink: 0, position: 'sticky', top: 90, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
          Sections
        </span>
        {sections.map(s => (
          <a
            key={s.slug}
            href={`#${s.slug}`}
            style={{
              fontSize: 12, padding: '5px 8px', borderRadius: 4, textDecoration: 'none',
              color: activeSlug === s.slug ? 'var(--accent)' : 'var(--text-muted)',
              background: activeSlug === s.slug ? 'var(--surface-2)' : 'transparent',
              fontWeight: activeSlug === s.slug ? 700 : 500,
            }}
          >
            {s.text.replace(/^Section \d+:\s*/, '')}
          </a>
        ))}
        {updatedAt && (
          <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 14, lineHeight: 1.5 }}>
            Last updated {new Date(updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.
            Source of truth is <code style={{ fontSize: 9.5 }}>business/business-plan.md</code> in the repo — edit there to change it.
          </p>
        )}
      </nav>

      <article
        className="plan-content"
        style={{ flex: 1, minWidth: 0, fontSize: 13.5, lineHeight: 1.65, color: 'var(--text)', paddingBottom: 60 }}
        dangerouslySetInnerHTML={{ __html: html }}
      />

      <style jsx global>{`
        .plan-content h1 { font-size: 22px; font-weight: 700; margin: 0 0 6px; color: var(--text); }
        .plan-content h2 { font-size: 17px; font-weight: 700; margin: 36px 0 12px; padding-top: 16px; border-top: 1px solid var(--line); color: var(--text); scroll-margin-top: 90px; }
        .plan-content h2:first-child { margin-top: 0; padding-top: 0; border-top: none; }
        .plan-content h3 { font-size: 14px; font-weight: 700; margin: 22px 0 8px; color: var(--text); scroll-margin-top: 90px; }
        .plan-content h4 { font-size: 12.5px; font-weight: 700; margin: 16px 0 6px; color: var(--text); text-transform: uppercase; letter-spacing: 0.03em; }
        .plan-content p { margin: 0 0 12px; }
        .plan-content ul, .plan-content ol { margin: 0 0 12px; padding-left: 22px; }
        .plan-content li { margin-bottom: 4px; }
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
