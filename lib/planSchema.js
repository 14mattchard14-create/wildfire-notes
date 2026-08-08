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

// --- Block-level parsing, for natural line-by-line editing in the Plan tab ---
// A section's body (everything AFTER its own "## Heading" line) is split
// into small units — subheadings, individual list items, table blocks, rule
// lines, and paragraphs — each independently click-to-edit in the UI. This
// replaces swapping the whole section for one large raw-markdown textarea:
// instead the page always shows the fully rendered/formatted view, and
// clicking any one line turns just that line into a small raw-text field.
//
// Deliberately line-oriented and dumb (no nested lists, no multi-paragraph
// list items) — that matches how business-plan.md is actually written, and
// keeps the parser trivially reversible via blocksToMarkdown, which matters
// more here than generality: a lossy round-trip would silently corrupt the
// document.
export function parseBlocks(bodyMarkdown) {
  const lines = (bodyMarkdown || '').split('\n')
  const blocks = []
  let i = 0
  const isTable = l => /^\s*\|/.test(l)
  const isSubheading = l => /^#{3,6}\s+/.test(l)
  const isListItem = l => /^\s*([-*]|\d+\.)\s+/.test(l)
  const isRule = l => /^\s*---+\s*$/.test(l)
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) { i++; continue }
    if (isRule(line)) { blocks.push({ type: 'rule', raw: line }); i++; continue }
    if (isTable(line)) {
      const start = i
      while (i < lines.length && isTable(lines[i])) i++
      blocks.push({ type: 'table', raw: lines.slice(start, i).join('\n') })
      continue
    }
    if (isSubheading(line)) {
      const level = line.match(/^(#{3,6})/)[1].length
      blocks.push({ type: `heading${level}`, raw: line })
      i++
      continue
    }
    if (isListItem(line)) {
      blocks.push({ type: 'listitem', ordered: /^\s*\d+\./.test(line), raw: line })
      i++
      continue
    }
    const start = i
    while (i < lines.length && lines[i].trim() && !isTable(lines[i]) && !isSubheading(lines[i]) && !isListItem(lines[i]) && !isRule(lines[i])) i++
    blocks.push({ type: 'paragraph', raw: lines.slice(start, i).join('\n') })
  }
  return blocks
}

// Inverse of parseBlocks — consecutive list-item blocks are rejoined with
// single newlines (one markdown list, tight-spaced), everything else gets a
// blank line between it and its neighbors.
export function blocksToMarkdown(blocks) {
  const parts = []
  let i = 0
  while (i < blocks.length) {
    if (blocks[i].type === 'listitem') {
      const group = []
      while (i < blocks.length && blocks[i].type === 'listitem') { group.push(blocks[i].raw); i++ }
      parts.push(group.join('\n'))
    } else {
      parts.push(blocks[i].raw)
      i++
    }
  }
  return parts.join('\n\n')
}
