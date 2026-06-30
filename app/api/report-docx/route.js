import Anthropic from '@anthropic-ai/sdk'
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
         HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
         LevelFormat, ImageRun, TableOfContents, PageBreak } from 'docx'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ---- Image helpers ----
async function fetchImageBuffer(url) {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const arrayBuffer = await res.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch {
    return null
  }
}

// Read actual pixel dimensions from JPEG/PNG buffer so images aren't stretched
function getImageDimensions(buf) {
  try {
    // PNG
    if (buf[0] === 0x89 && buf[1] === 0x50) {
      const width = buf.readUInt32BE(16)
      const height = buf.readUInt32BE(20)
      return { width, height }
    }
    // JPEG — scan markers for SOF0/SOF2
    if (buf[0] === 0xFF && buf[1] === 0xD8) {
      let offset = 2
      while (offset < buf.length) {
        if (buf[offset] !== 0xFF) break
        const marker = buf[offset + 1]
        if (marker === 0xC0 || marker === 0xC2) {
          const height = buf.readUInt16BE(offset + 5)
          const width = buf.readUInt16BE(offset + 7)
          return { width, height }
        }
        const segLength = buf.readUInt16BE(offset + 2)
        offset += 2 + segLength
      }
    }
  } catch {}
  return { width: 800, height: 600 } // fallback assumption
}

// Build a horizontal "strip" of photos (as a borderless table row) for one category/zone group.
// Each photo gets a small caption underneath (the entry's finding text, truncated).
// Fixed-size cells (in DXA) keep Word AND Google Docs rendering consistent.
async function buildPhotoStrip(entries, captionMap) {
  const withPhotos = entries.filter(e => e.photo_url)
  if (withPhotos.length === 0) return []

  const maxPerRow = 2
  const CELL_DXA = 4680 // fixed cell width regardless of count, so Docs doesn't recompute differently than Word
  const MAX_IMG_WIDTH_PX = 260
  const MAX_IMG_HEIGHT_PX = 280

  const rows = []
  for (let i = 0; i < withPhotos.length; i += maxPerRow) {
    const group = withPhotos.slice(i, i + maxPerRow)
    const cells = []
    for (const entry of group) {
      const buf = await fetchImageBuffer(entry.photo_url)
      const cellChildren = []
      if (buf) {
        try {
          const { width: nativeW, height: nativeH } = getImageDimensions(buf)
          // Scale to fit within the max box while preserving aspect ratio
          const scale = Math.min(MAX_IMG_WIDTH_PX / nativeW, MAX_IMG_HEIGHT_PX / nativeH, 1)
          const drawW = Math.round(nativeW * scale)
          const drawH = Math.round(nativeH * scale)
          cellChildren.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new ImageRun({ data: buf, transformation: { width: drawW, height: drawH } })],
          }))
        } catch {
          cellChildren.push(new Paragraph({ children: [new TextRun({ text: '[image unavailable]', italics: true, size: 16, color: '9a9285' })] }))
        }
      } else {
        cellChildren.push(new Paragraph({ children: [new TextRun({ text: '[image unavailable]', italics: true, size: 16, color: '9a9285' })] }))
      }
      // Caption: AI-polished description if available, otherwise fall back to raw note
      const caption = captionMap?.[entry.id] || entry.note || entry.category
      cellChildren.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: caption, italics: true, size: 15, color: '9a9285', font: 'Arial' })],
        spacing: { before: 60 },
      }))
      cells.push(new TableCell({
        width: { size: CELL_DXA, type: WidthType.DXA },
        verticalAlign: 'center',
        borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
        margins: { top: 80, bottom: 80, left: 80, right: 80 },
        children: cellChildren,
      }))
    }
    // Pad row with empty cells so column widths stay consistent across rows
    while (cells.length < maxPerRow && group.length < maxPerRow) {
      cells.push(new TableCell({
        width: { size: CELL_DXA, type: WidthType.DXA },
        borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
        children: [new Paragraph({ children: [new TextRun('')] })],
      }))
      break
    }
    rows.push(new TableRow({ children: cells }))
  }

  return [
    new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: Array(maxPerRow).fill(CELL_DXA),
      borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
      rows,
    }),
    new Paragraph({ children: [new TextRun('')], spacing: { after: 160 } }),
  ]
}

// Build the title page: big heading, "Prepared for", field table, standard disclaimer
function buildTitlePage(property, inspectorName) {
  const border = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' }
  const borders = { top: border, bottom: border, left: border, right: border }
  const cellMargins = { top: 100, bottom: 100, left: 140, right: 140 }

  const today = new Date()
  const reportDate = today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  const ownerName = property.owner_name || property.created_by_name || inspectorName || 'Not recorded'

  const fieldRows = [
    ['Property Address', property.address ?? 'Not recorded'],
    ['Date of Assessment', property.visit_date ?? 'Not recorded'],
    ['Inspector', inspectorName ?? 'Not recorded'],
    ['Report Date', reportDate],
    ['Owner', ownerName],
    ['Resident (if different)', property.resident_name ?? ownerName],
  ]

  const tableRows = fieldRows.map(([field, detail], idx) => new TableRow({
    children: [
      new TableCell({
        width: { size: 3120, type: WidthType.DXA },
        borders, margins: cellMargins,
        shading: { fill: idx % 2 === 0 ? 'FFFFFF' : 'EEF0F2', type: ShadingType.CLEAR },
        children: [new Paragraph({ children: [new TextRun({ text: field, bold: false, font: 'Arial', size: 21 })] })],
      }),
      new TableCell({
        width: { size: 6240, type: WidthType.DXA },
        borders, margins: cellMargins,
        shading: { fill: idx % 2 === 0 ? 'FFFFFF' : 'EEF0F2', type: ShadingType.CLEAR },
        children: [new Paragraph({ children: [new TextRun({ text: detail, font: 'Arial', size: 21 })] })],
      }),
    ],
  }))

  const headerRow = new TableRow({
    children: [
      new TableCell({
        width: { size: 3120, type: WidthType.DXA }, borders, margins: cellMargins,
        shading: { fill: '2C3E50', type: ShadingType.CLEAR },
        children: [new Paragraph({ children: [new TextRun({ text: 'Field', bold: true, font: 'Arial', size: 21, color: 'FFFFFF' })] })],
      }),
      new TableCell({
        width: { size: 6240, type: WidthType.DXA }, borders, margins: cellMargins,
        shading: { fill: '2C3E50', type: ShadingType.CLEAR },
        children: [new Paragraph({ children: [new TextRun({ text: 'Detail', bold: true, font: 'Arial', size: 21, color: 'FFFFFF' })] })],
      }),
    ],
  })

  const disclaimer = 'This report is intended to give homeowners a clear picture of their wildfire risk, while also outlining the gaps that would need to be addressed before the property could successfully obtain Wildfire Prepared Home certification (https://wildfireprepared.org/), should the owner wish to pursue certification; compliance and non-compliance determinations throughout this report are based on the Wildfire Prepared Home criteria, as outlined in the official checklist (https://wildfireprepared.org/wp-content/uploads/WPH-How-To-Prepare-My-Home-Checklist.pdf)'

  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'WILDFIRE RISK REDUCTION ASSESSMENT', bold: true, font: 'Arial', size: 40, color: '2C3E50' })],
      spacing: { before: 200, after: 120 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: `Prepared for: ${ownerName}`, bold: true, font: 'Arial', size: 24, color: '5A6B7D' })],
      spacing: { after: 200 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: 'BE5B1D', space: 8 } },
    }),
    new Paragraph({ children: [new TextRun('')], spacing: { after: 200 } }),
    new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [3120, 6240],
      rows: [headerRow, ...tableRows],
    }),
    new Paragraph({ children: [new TextRun('')], spacing: { after: 240 } }),
    new Paragraph({
      shading: { fill: 'FDF1D3', type: ShadingType.CLEAR },
      children: [new TextRun({ text: disclaimer, font: 'Arial', size: 20, color: '3A352F' })],
      spacing: { after: 320 },
    }),
    new Paragraph({ children: [new TextRun('')], pageBreakBefore: false }),
  ]
}

// Educational reference content for each inspection category/zone
const ZONE_EDUCATION = [
  {
    name: 'Overall Site',
    desc: 'A whole-property view of wildfire exposure, factoring in slope, prevailing wind, fuel load, and how neighboring properties could contribute to fire spread toward or away from the home.',
  },
  {
    name: '0-5 FT. Noncombustible Zone',
    desc: 'The most critical area around the home. The first five feet surrounding the home and attached features must be completely noncombustible — bare mineral soil or hardscape only, with no vegetation, mulch, or combustible items, extending vertically with no overhanging branches.',
  },
  {
    name: '5-30 FT. Defensible Space - Vegetation',
    desc: 'A fuel-reduction zone that slows fire spread before it reaches the home. Trees and shrubs must be properly spaced and pruned, grass kept short, dead vegetation removed, and firewood stored well away from the structure.',
  },
  {
    name: '10-30 FT. Defensible Space - Detached Structures & Other Large Items',
    desc: 'Sheds, pergolas, hot tubs, outdoor kitchens, and fuel/water storage tanks within 30 ft of the home each carry their own placement, spacing, and material requirements to prevent them from acting as fire bridges to the structure.',
  },
  {
    name: 'Roof',
    desc: 'The roof covering must be Class A fire-rated and kept free of debris — wood roofs and plastic corrugated panels are never permitted, since the roof is one of the most common paths for ember ignition.',
  },
  {
    name: 'Gutters',
    desc: 'Gutters and downspouts must be noncombustible and kept clear of debris, since dry leaves and needles trapped in gutters are a common ember ignition point.',
  },
  {
    name: '6-Inch Noncombustible Wall Clearance',
    desc: 'A 6-inch noncombustible buffer at the base of exterior walls, deck posts, and stairs prevents ground-level embers and flames from reaching combustible wall materials.',
  },
  {
    name: 'Vents',
    desc: 'Roof, attic, eave, and under-home vents are major ember entry points and require flame/ember-resistant construction or 1/8-inch corrosion-resistant mesh. Dryer vents need a functional flap instead, since mesh traps lint.',
  },
  {
    name: 'Eaves & Soffits',
    desc: 'The exposed underside of roof eaves can trap rising embers and heat; enclosing or protecting this area with noncombustible material is a key upgrade for ember resistance.',
  },
  {
    name: 'Skylights',
    desc: 'Plastic dome skylights are vulnerable to radiant heat; flat, multi-pane tempered-glass skylights with mesh-protected operable vents are far more fire-resistant.',
  },
  {
    name: 'Exterior Wall Coverings / Siding',
    desc: 'Full noncombustible siding (brick, stucco, fiber-cement, metal) provides much stronger protection against direct flame contact and radiant heat than the 6-inch base clearance alone.',
  },
  {
    name: 'Exterior Windows',
    desc: 'Tempered double-pane glass resists breaking under radiant heat — broken windows are a common way embers and flame enter a home\'s interior during a wildfire.',
  },
  {
    name: 'Exterior Doors',
    desc: 'Solid-core or noncombustible doors with tempered glass panes (where applicable) and noncombustible thresholds resist ignition better than hollow or thin wood doors.',
  },
  {
    name: 'Decks, Patios & Overhead Structures',
    desc: 'Decks and patios near the home need their own ember-resistant zone, noncombustible bases at posts/stairs, and (for Plus) fully noncombustible walking surfaces and railings.',
  },
  {
    name: 'Access & Address',
    desc: 'Ensures fire crews can find and reach the property quickly — visible address numbers and a clear, navigable driveway/access route are essential during an active wildfire response.',
  },
]

function buildZoneGuide() {
  const children = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: 'UNDERSTANDING THE ZONES', bold: true, font: 'Arial', size: 32, color: 'BE5B1D' })],
      spacing: { before: 200, after: 160 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'This assessment is organized around the defensible space zones used in California wildfire mitigation guidance. Each zone has distinct requirements based on its distance from the structure.', font: 'Arial', size: 21, color: '3A352F' })],
      spacing: { after: 200 },
    }),
  ]

  for (const zone of ZONE_EDUCATION) {
    children.push(new Paragraph({
      children: [new TextRun({ text: zone.name, bold: true, font: 'Arial', size: 22, color: '2F5496' })],
      spacing: { before: 140, after: 40 },
    }))
    children.push(new Paragraph({
      children: [new TextRun({ text: zone.desc, font: 'Arial', size: 20, color: '3A352F' })],
      spacing: { after: 80 },
    }))
  }

  children.push(new Paragraph({ children: [new PageBreak()] }))
  return children
}

function buildTOC() {
  return [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: 'TABLE OF CONTENTS', bold: true, font: 'Arial', size: 32, color: 'BE5B1D' })],
      spacing: { before: 200, after: 160 },
    }),
    new Paragraph({
      children: [new TextRun({ text: '(If this section appears blank, right-click it and select "Update Field" — or in Google Docs it will auto-populate after the document finishes loading.)', italics: true, font: 'Arial', size: 18, color: '9a9285' })],
      spacing: { after: 160 },
    }),
    new TableOfContents('Table of Contents', { hyperlink: true, headingStyleRange: '1-3' }),
    new Paragraph({ children: [new PageBreak()] }),
  ]
}

// ---- Markdown parsing (unchanged structure, now async to allow image fetches) ----
async function parseMarkdown(markdown, entriesByZone, captionMap) {
  const lines = markdown.split('\n')
  const children = []

  const border = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' }
  const borders = { top: border, bottom: border, left: border, right: border }
  const cellMargins = { top: 80, bottom: 80, left: 120, right: 120 }

  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    // H1
    if (line.startsWith('# ')) {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: line.replace(/^# /, '').replace(/\*\*/g, ''), bold: true, font: 'Arial', size: 32 })],
        spacing: { before: 320, after: 160 },
      }))
      i++; continue
    }

    // H2
    if (line.startsWith('## ')) {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: line.replace(/^## /, '').replace(/\*\*/g, ''), bold: true, font: 'Arial', size: 28 })],
        spacing: { before: 240, after: 120 },
      }))
      i++; continue
    }

    // H3 — also a hook point: if this is a zone heading, drop a photo strip right after it
    if (line.startsWith('### ')) {
      const headingText = line.replace(/^### /, '').replace(/\*\*/g, '')
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun({ text: headingText, bold: true, font: 'Arial', size: 24 })],
        spacing: { before: 200, after: 100 },
      }))
      i++

      // If this heading matches a zone name we have entries/photos for, insert the strip
      const matchedZone = Object.keys(entriesByZone).find(z => headingText.includes(z) || z.includes(headingText))
      if (matchedZone && entriesByZone[matchedZone]?.length) {
        const strip = await buildPhotoStrip(entriesByZone[matchedZone], captionMap)
        children.push(...strip)
      }
      continue
    }

    // Table
    if (line.startsWith('|')) {
      const tableLines = []
      while (i < lines.length && lines[i].startsWith('|')) {
        if (!lines[i].match(/^\|[-| ]+\|$/)) tableLines.push(lines[i])
        i++
      }
      if (tableLines.length > 0) {
        const rows = tableLines.map((tl, rowIdx) => {
          const cells = tl.split('|').filter(c => c.trim() !== '').map(cell => cell.trim())
          return new TableRow({
            children: cells.map(cell =>
              new TableCell({
                borders,
                margins: cellMargins,
                shading: rowIdx === 0 ? { fill: 'D9E1F2', type: ShadingType.CLEAR } : { fill: 'FFFFFF', type: ShadingType.CLEAR },
                children: [new Paragraph({
                  children: [new TextRun({
                    text: cell.replace(/\*\*/g, ''),
                    bold: rowIdx === 0,
                    font: 'Arial',
                    size: 20,
                  })]
                })]
              })
            )
          })
        })

        const colCount = tableLines[0].split('|').filter(c => c.trim() !== '').length
        const colWidth = Math.floor(9360 / colCount)
        const colWidths = Array(colCount).fill(colWidth)

        children.push(new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: colWidths,
          rows,
        }))
        children.push(new Paragraph({ children: [new TextRun('')], spacing: { after: 120 } }))
      }
      continue
    }

    // Bullet
    if (line.startsWith('- ') || line.startsWith('* ')) {
      children.push(new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [new TextRun({ text: line.replace(/^[-*] /, '').replace(/\*\*/g, ''), font: 'Arial', size: 22 })],
      }))
      i++; continue
    }

    // Numbered list
    if (/^\d+\. /.test(line)) {
      children.push(new Paragraph({
        numbering: { reference: 'numbers', level: 0 },
        children: [new TextRun({ text: line.replace(/^\d+\. /, '').replace(/\*\*/g, ''), font: 'Arial', size: 22 })],
      }))
      i++; continue
    }

    // HR
    if (line.startsWith('---')) {
      children.push(new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'BE5B1D', space: 1 } },
        spacing: { before: 160, after: 160 },
        children: [new TextRun('')]
      }))
      i++; continue
    }

    // Bold line
    if (line.startsWith('**') && line.endsWith('**')) {
      children.push(new Paragraph({
        children: [new TextRun({ text: line.replace(/\*\*/g, ''), bold: true, font: 'Arial', size: 22 })],
        spacing: { after: 80 },
      }))
      i++; continue
    }

    // Empty line
    if (line.trim() === '') {
      children.push(new Paragraph({ children: [new TextRun('')], spacing: { after: 80 } }))
      i++; continue
    }

    // Normal paragraph
    const runs = []
    const parts = line.split(/(\*\*[^*]+\*\*)/)
    parts.forEach(part => {
      if (part.startsWith('**') && part.endsWith('**')) {
        runs.push(new TextRun({ text: part.replace(/\*\*/g, ''), bold: true, font: 'Arial', size: 22 }))
      } else if (part) {
        runs.push(new TextRun({ text: part, font: 'Arial', size: 22 }))
      }
    })
    children.push(new Paragraph({ children: runs, spacing: { after: 80 } }))
    i++
  }

  return children
}

async function generateCaptions(entries) {
  const withPhotos = entries.filter(e => e.photo_url && e.note)
  if (withPhotos.length === 0) return {}

  const list = withPhotos.map(e => `ID: ${e.id}\nCategory: ${e.category}\nZone: ${e.zone}\nRaw note: ${e.note}\nDistance: ${e.distance ?? 'none'}`).join('\n\n')

  const prompt = `You are wordsmithing photo captions for a wildfire risk assessment report. Below are raw field notes (shorthand) for several photographed findings. Rewrite each into a single polished, professional caption sentence (under 18 words) suitable to appear directly beneath the photo. Use proper terminology and incorporate the distance if given. Do not include the category name redundantly if it's obvious from the photo context.

${list}

Respond ONLY with a JSON object mapping each ID to its polished caption string, like {"abc123": "Caption text here", ...}. No other text, no markdown fences.`

  try {
    const res = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = res.content[0].text.replace(/```json|```/g, '').trim()
    return JSON.parse(text)
  } catch (err) {
    console.error('Caption generation error:', err)
    return {}
  }
}

export async function POST(req) {
  try {
    const { fieldNotes, property, inspectorName, entries } = await req.json()

    // Group entries by zone so we know which photos belong under which heading
    const entriesByZone = {}
    if (Array.isArray(entries)) {
      for (const e of entries) {
        if (!entriesByZone[e.zone]) entriesByZone[e.zone] = []
        entriesByZone[e.zone].push(e)
      }
    }

    const prompt = `You are an expert wildfire risk assessor. Using the field notes below, generate a complete Wildfire Risk Reduction Assessment report in Markdown format.

IMPORTANT CONTEXT ON THE FIELD NOTES: The field notes below contain two kinds of input, both of which are raw shorthand metadata for you to interpret — not polished prose to copy verbatim:
1. "SITE NOTES BY CATEGORY" — freeform inspector observations recorded per WPH category, used to write narrative context and findings for that category even if no individual logged entry exists for it.
2. "ENTRIES" — individual logged findings, each tagged with a zone/category, a status, a short "Finding" note, optional "Details," and optional distance.

Combine BOTH sources when writing each category's findings table and recommendations — site notes often add context (e.g. material types, overall condition) that individual entries don't capture, and vice versa. Your job is to interpret this shorthand and write clear, professional, complete sentences, using your wildfire expertise to fill in standard terminology and likely implications. For example, if a note says "vent no mesh," write something like "An attic vent was observed without the required 1/8-inch corrosion-resistant metal mesh, allowing ember entry." Use status and distance values as metadata to inform your assessment and recommendations — they are not meant to appear as separate table columns.

FIELD NOTES:
${fieldNotes}

Fill in the report using the information and shorthand from the field notes above, rewritten into clear professional language. Where data is missing, write "(not assessed)". Be specific and professional. For recommendations, be actionable and concise, and ground them in the actual finding described.

Use this structure:

# WILDFIRE RISK REDUCTION ASSESSMENT

**Property:** ${property.address}
**Inspector:** ${inspectorName ?? 'Not recorded'}
**Date of Assessment:** ${property.visit_date ?? 'Not recorded'}

---

## 1. EXECUTIVE SUMMARY

### Overall Risk Rating
[Low / Moderate / High / Severe]

### Summary Narrative
[2–4 sentence plain-language summary]

### Top Priorities
- [Priority 1]
- [Priority 2]
- [Priority 3]

### WPH Designation Snapshot
- Base (Essential): [count categories marked Base Compliant vs. total categories assessed, e.g. "6 of 9 assessed categories meet Base requirements"]
- Plus (Enhanced): [same approach for Plus Compliant — note that Plus requires Base to also be met]

---

## 2. SITE & ENVIRONMENTAL OVERVIEW

Write 1-3 short paragraphs summarizing the "Overall Site & Surrounding Environment" site notes — slope, topography, prevailing wind, surrounding vegetation, neighboring properties, and general conflagration risk context. If no site notes were recorded for this section, write "(not assessed)".

---

## 3. FINDINGS BY CATEGORY

Present findings grouped under these categories, IN THIS EXACT ORDER, using the EXACT category names below as ### headings. Only include a category's table if there is at least one field-note entry OR site-note text for it; otherwise skip that category entirely. Each table has exactly two columns: Category and Finding. Fold compliance status (Base Compliant/Plus Compliant/Non-Compliant/Needs Verification/Not Applicable) and any recorded distance directly into the Finding sentence as natural language — do not create separate Status or Distance columns.

### Overall Site
| Category | Finding |
|---|---|
[rows]

**Recommendations:** [list]

### 0-5 FT. Noncombustible Zone
| Category | Finding |
|---|---|
[rows]

**Recommendations:** [list]

### 5-30 FT. Defensible Space - Vegetation
| Category | Finding |
|---|---|
[rows]

**Recommendations:** [list]

### 10-30 FT. Defensible Space - Detached Structures & Other Large Items
| Category | Finding |
|---|---|
[rows]

**Recommendations:** [list]

### Roof
| Category | Finding |
|---|---|
[rows]

**Recommendations:** [list]

### Gutters
| Category | Finding |
|---|---|
[rows]

**Recommendations:** [list]

### 6-Inch Noncombustible Wall Clearance
| Category | Finding |
|---|---|
[rows]

**Recommendations:** [list]

### Vents
| Category | Finding |
|---|---|
[rows]

**Recommendations:** [list]

### Eaves & Soffits
| Category | Finding |
|---|---|
[rows]

**Recommendations:** [list]

### Skylights
| Category | Finding |
|---|---|
[rows]

**Recommendations:** [list]

### Exterior Wall Coverings / Siding
| Category | Finding |
|---|---|
[rows]

**Recommendations:** [list]

### Exterior Windows
| Category | Finding |
|---|---|
[rows]

**Recommendations:** [list]

### Exterior Doors
| Category | Finding |
|---|---|
[rows]

**Recommendations:** [list]

### Decks, Patios & Overhead Structures
| Category | Finding |
|---|---|
[rows]

**Recommendations:** [list]

### Access & Address
| Category | Finding |
|---|---|
[rows]

**Recommendations:** [list]

## 4. PRIORITIZED ACTION PLAN

| # | Action | Zone | Priority |
|---|---|---|---|
[ranked recommendations]

---

## 5. DISCLAIMER

This report reflects conditions observed on the date of assessment and is intended to provide risk-reduction guidance. It is not a guarantee against wildfire damage or loss, nor an official Wildfire Prepared Home designation.

IMPORTANT: Use the exact zone names from the field notes as your ### headings in section 3 (e.g. if field notes say "[Zone 0 (0–5 ft)]", your heading must be "### Zone 0 (0–5 ft)"), so photos can be matched to the correct section.

IMPORTANT: Do not use any emoji or icon characters anywhere in the report (no checkmarks, warning symbols, circles, etc.). Use plain text only — e.g. write "Non-compliant" instead of using a warning emoji, and "Compliant" instead of a checkmark.

IMPORTANT: Do not include cost estimates anywhere in the report, including the action plan table — omit the Cost column entirely.`

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    })

    const reportText = message.content[0].text

    // Generate AI-polished photo captions, and build DOCX (now async due to image fetching)
    const captionMap = Array.isArray(entries) ? await generateCaptions(entries) : {}
    const titlePageChildren = buildTitlePage(property, inspectorName)
    const tocChildren = buildTOC()
    const zoneGuideChildren = buildZoneGuide()
    // Strip the redundant H1 + Property/Inspector/Date lines + first --- from the markdown
    // since that info now lives in the title page table
    const bodyText = reportText
      .replace(/^#\s+WILDFIRE RISK REDUCTION ASSESSMENT\s*\n+/i, '')
      .replace(/^\*\*Property:\*\*.*\n/m, '')
      .replace(/^\*\*Inspector:\*\*.*\n/m, '')
      .replace(/^\*\*Date of Assessment:\*\*.*\n/m, '')
      .replace(/^---\s*\n/, '')
    const bodyChildren = await parseMarkdown(bodyText, entriesByZone, captionMap)
    const docChildren = [...titlePageChildren, ...tocChildren, ...zoneGuideChildren, ...bodyChildren]

    const doc = new Document({
      numbering: {
        config: [
          { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
          { reference: 'numbers', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
        ]
      },
      styles: {
        default: { document: { run: { font: 'Arial', size: 22 } } },
        paragraphStyles: [
          { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
            run: { size: 32, bold: true, font: 'Arial', color: 'BE5B1D' },
            paragraph: { spacing: { before: 320, after: 160 }, outlineLevel: 0 } },
          { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
            run: { size: 28, bold: true, font: 'Arial', color: '1F3864' },
            paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 } },
          { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
            run: { size: 24, bold: true, font: 'Arial', color: '2F5496' },
            paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2 } },
        ]
      },
      sections: [{
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
          }
        },
        children: docChildren,
      }]
    })

    const buffer = await Packer.toBuffer(doc)
    const base64 = buffer.toString('base64')

    return Response.json({ docx: base64, report: reportText })
  } catch (err) {
    console.error('DOCX generation error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
