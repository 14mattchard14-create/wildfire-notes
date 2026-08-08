// Shared section parsing for the editable business plan (app/business/plan
// + app/api/business-plan-db). The document is stored as one markdown blob
// (business_plan.content), but edited and diffed one "## Section" at a time
// — see migration 027 for why (wordDiff's 600-word token cap). Both the API
// route and the client page need the exact same split/rebuild logic, so it
// lives here rather than being duplicated.

export function slugify(text) {
  return (text || '').toLowerCase().replace(/<[^>]+>/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

// Splits a markdown document into the preamble (title + any lines before
// the first "## " heading) and a list of top-level sections, each keeping
// its own "## Heading" line as the first line of its body.
export function parseSections(markdown) {
  const lines = (markdown || '').split('\n')
  const sections = []
  const preambleLines = []
  let current = null
  for (const line of lines) {
    if (/^##\s+/.test(line)) {
      if (current) sections.push(current)
      const heading = line.replace(/^##\s+/, '').trim()
      current = { heading, slug: slugify(heading), lines: [line] }
    } else if (current) {
      current.lines.push(line)
    } else {
      preambleLines.push(line)
    }
  }
  if (current) sections.push(current)
  return {
    preamble: preambleLines.join('\n'),
    sections: sections.map(s => ({ heading: s.heading, slug: s.slug, body: s.lines.join('\n').replace(/\n+$/, '') })),
  }
}

export function rebuildDocument(preamble, sections) {
  return [preamble, ...sections.map(s => s.body)].filter(Boolean).join('\n\n').replace(/\n{3,}/g, '\n\n')
}

// Replaces one section's body (matched by heading text) and returns the
// rebuilt full document plus the before/after text of just that section,
// for diffing. Throws if the heading isn't found, rather than silently
// no-op'ing on a stale/renamed heading.
export function replaceSection(markdown, heading, newBody) {
  const { preamble, sections } = parseSections(markdown)
  const idx = sections.findIndex(s => s.heading === heading)
  if (idx === -1) throw new Error(`Section "${heading}" not found in current document`)
  const before = sections[idx].body
  const updated = sections.map((s, i) => (i === idx ? { ...s, body: newBody } : s))
  return { document: rebuildDocument(preamble, updated), before, after: newBody }
}
