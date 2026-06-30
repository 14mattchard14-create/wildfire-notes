import Anthropic from '@anthropic-ai/sdk'
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
         HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
         LevelFormat, ImageRun } from 'docx'

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
async function buildPhotoStrip(entries) {
  const withPhotos = entries.filter(e => e.photo_url)
  if (withPhotos.length === 0) return []

  const maxPerRow = 3
  const CELL_DXA = 3120 // fixed cell width regardless of count, so Docs doesn't recompute differently than Word
  const MAX_IMG_WIDTH_PX = 170
  const MAX_IMG_HEIGHT_PX = 220

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
      // Caption: short finding text
      const caption = entry.note ? entry.note.slice(0, 60) + (entry.note.length > 60 ? '…' : '') : entry.category
      cellChildren.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: caption, italics: true, size: 16, color: '9a9285', font: 'Arial' })],
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

// ---- Markdown parsing (unchanged structure, now async to allow image fetches) ----
async function parseMarkdown(markdown, entriesByZone) {
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
        const strip = await buildPhotoStrip(entriesByZone[matchedZone])
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

FIELD NOTES:
${fieldNotes}

Fill in the report using only information from the field notes. Where data is missing, write "(not assessed)". Be specific and professional. For recommendations, be actionable and concise.

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
- Base (Essential): [X of 10 met based on Base Compliant entries]
- Plus (Enhanced): [X of 10 met based on Plus Compliant entries]

---

## 2. SITE & ENVIRONMENTAL OVERVIEW

### Slope & Topography
[From site notes]

### Fuel Type / Vegetation
[From site notes]

### Prevailing Wind / Weather Exposure
[From site notes]

### Neighboring Properties
[From site notes]

---

## 3. FINDINGS BY ZONE

For each zone that has entries, create a heading using the EXACT zone name as it appears in the field notes (e.g. "### Zone 0 (0–5 ft)"), followed by a findings table and recommendations.

### Structure
| Category | Finding | Status | Distance |
|---|---|---|---|
[rows]

**Recommendations:** [list any non-compliant or verify items]

### Zone 0 (0–5 ft)
| Category | Finding | Status | Distance |
|---|---|---|---|
[rows]

**Recommendations:** [list]

### Zone 1 (5–30 ft)
| Category | Finding | Status | Distance |
|---|---|---|---|
[rows]

**Recommendations:** [list]

### Zone 2 (30–100 ft)
| Category | Finding | Status | Distance |
|---|---|---|---|
[rows]

**Recommendations:** [list]

---

## 4. PRIORITIZED ACTION PLAN

| # | Action | Zone | Cost | Priority |
|---|---|---|---|---|
[ranked recommendations]

---

## 5. DISCLAIMER

This report reflects conditions observed on the date of assessment and is intended to provide risk-reduction guidance. It is not a guarantee against wildfire damage or loss, nor an official Wildfire Prepared Home designation.

IMPORTANT: Use the exact zone names from the field notes as your ### headings in section 3 (e.g. if field notes say "[Zone 0 (0–5 ft)]", your heading must be "### Zone 0 (0–5 ft)"), so photos can be matched to the correct section.`

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    })

    const reportText = message.content[0].text

    // Build DOCX (now async due to image fetching)
    const titlePageChildren = buildTitlePage(property, inspectorName)
    // Strip the redundant H1 + Property/Inspector/Date lines + first --- from the markdown
    // since that info now lives in the title page table
    const bodyText = reportText
      .replace(/^#\s+WILDFIRE RISK REDUCTION ASSESSMENT\s*\n+/i, '')
      .replace(/^\*\*Property:\*\*.*\n/m, '')
      .replace(/^\*\*Inspector:\*\*.*\n/m, '')
      .replace(/^\*\*Date of Assessment:\*\*.*\n/m, '')
      .replace(/^---\s*\n/, '')
    const bodyChildren = await parseMarkdown(bodyText, entriesByZone)
    const docChildren = [...titlePageChildren, ...bodyChildren]

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
