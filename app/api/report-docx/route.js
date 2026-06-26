import Anthropic from '@anthropic-ai/sdk'
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
         HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
         LevelFormat } from 'docx'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Parse markdown into docx elements
function parseMarkdown(markdown, property) {
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

    // H3
    if (line.startsWith('### ')) {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun({ text: line.replace(/^### /, '').replace(/\*\*/g, ''), bold: true, font: 'Arial', size: 24 })],
        spacing: { before: 200, after: 100 },
      }))
      i++; continue
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

        // Estimate column widths evenly
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
    const { fieldNotes, property } = await req.json()

    // Generate report text from Claude
    const prompt = `You are an expert wildfire risk assessor. Using the field notes below, generate a complete Wildfire Risk Reduction Assessment report in Markdown format.

FIELD NOTES:
${fieldNotes}

Fill in the report using only information from the field notes. Where data is missing, write "(not assessed)". Be specific and professional. For recommendations, be actionable and concise.

Use this structure:

# WILDFIRE RISK REDUCTION ASSESSMENT

**Property:** ${property.address}
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

For each zone that has entries, create a findings table and recommendations.

### Structure
| Category | Finding | Status | Distance |
|---|---|---|---|
[rows]

**Recommendations:** [list any non-compliant or verify items]

### Immediate Zone (0–5 ft)
| Category | Finding | Status | Distance |
|---|---|---|---|
[rows]

**Recommendations:** [list]

### Intermediate Zone (5–30 ft)
| Category | Finding | Status | Distance |
|---|---|---|---|
[rows]

**Recommendations:** [list]

### Extended Zone (30–100 ft)
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

This report reflects conditions observed on the date of assessment and is intended to provide risk-reduction guidance. It is not a guarantee against wildfire damage or loss, nor an official Wildfire Prepared Home designation.`

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    })

    const reportText = message.content[0].text

    // Build DOCX
    const docChildren = parseMarkdown(reportText, property)

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
