import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req) {
  try {
    const { fieldNotes, property } = await req.json()

    const prompt = `You are an expert wildfire risk assessor. Using the field notes below, generate a complete Wildfire Risk Reduction Assessment report in Markdown format.

FIELD NOTES:
${fieldNotes}

Fill in the report template below using only information from the field notes. Where data is missing, write "(not assessed)" or leave the field blank rather than inventing information. Be specific and professional. For recommendations, be actionable and concise. Infer the risk rating from the overall findings.

Use this structure:

# WILDFIRE RISK REDUCTION ASSESSMENT

**Property:** ${property.address}
**Date of Assessment:** ${property.visit_date ?? 'Not recorded'}

---

## 1. EXECUTIVE SUMMARY

### Overall Risk Rating
[Low / Moderate / High / Severe — pick one based on findings]

### Summary Narrative
[2–4 sentence plain-language summary of the biggest risks and strengths]

### Top Priorities
[List the top 3 action items from the priorities section of the field notes]

### WPH Designation Snapshot
- Base (Essential): [X of 10 met, based on Base Compliant entries]
- Plus (Enhanced): [X of 10 met, based on Plus Compliant entries]

---

## 2. SITE & ENVIRONMENTAL OVERVIEW

### Slope & Topography
[From site notes]

### Fuel Type / Vegetation
[From site notes]

### Prevailing Wind / Weather Exposure
[From site notes]

### Neighboring Properties / Conflagration Risk
[From site notes]

### Other Geographic Considerations
[From site notes]

---

## 3. FINDINGS BY ZONE

For each entry in the field notes, place it under the correct zone section below. Create a findings table and recommendations for each zone that has entries.

### Structure
| Category | Finding | Status | Distance |
|---|---|---|---|
[rows for Structure zone entries]

**Recommendations:**
[Based on non-compliant/verify findings in this zone]

---

### Immediate Zone (0–5 ft)
| Category | Finding | Status | Distance |
|---|---|---|---|
[rows for Immediate Zone entries]

**Recommendations:**
[Based on non-compliant/verify findings in this zone]

---

### Intermediate Zone (5–30 ft)
| Category | Finding | Status | Distance |
|---|---|---|---|
[rows for Intermediate Zone entries]

**Recommendations:**
[Based on non-compliant/verify findings in this zone]

---

### Extended Zone (30–100 ft)
| Category | Finding | Status | Distance |
|---|---|---|---|
[rows for Extended Zone entries]

**Recommendations:**
[Based on non-compliant/verify findings in this zone]

---

## 4. WPH CHECKLIST SUMMARY

Based on the entries marked "Base Compliant" or "Plus Compliant", summarize which WPH requirements appear to be met and which are outstanding or not assessed.

---

## 5. PRIORITIZED ACTION PLAN

| # | Action | Zone | Cost | Priority |
|---|---|---|---|---|
[Ranked list of all recommendations — non-compliant and needs-verification items first, ordered by impact]

---

## 6. DISCLAIMER

This report reflects conditions observed on the date of assessment and is intended to provide risk-reduction guidance. It is not a guarantee against wildfire damage or loss, nor an official Wildfire Prepared Home designation.`

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    })

    const report = message.content[0].text

    return Response.json({ report })
  } catch (err) {
    console.error('Report generation error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
