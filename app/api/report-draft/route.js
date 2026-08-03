import Anthropic from '@anthropic-ai/sdk'
import { getAuthedUser, supabaseAdmin } from '@/lib/auth-server'
import { GUIDED_SEGMENTS, OVERALL_SITE_SEGMENT } from '@/lib/criteria'
import { parseSatellite, getAreaText } from '@/lib/satellite'

// Site notes used to live in a standalone `site_notes` table (one row per
// property, 15 freeform columns). That's now folded into Guided Entry as
// one freeform note per segment, saved onto guided_segments.notes — so the
// report prompt below reads from there instead. Includes the Overall Site
// segment since it now carries its own note too.
const NOTE_SEGMENTS = [OVERALL_SITE_SEGMENT, ...GUIDED_SEGMENTS]

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Generates (or regenerates) a report draft for a property from its
// current entries/site notes/priorities, and saves it to
// properties.report_draft_markdown. This is deliberately separate from
// shared_reports — nothing here is customer-visible until the inspector
// explicitly publishes via /api/report-publish.

export async function POST(request) {
  const { user, profile } = await getAuthedUser(request)
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })
  if (profile.role !== 'employee') return Response.json({ error: 'Inspector account required' }, { status: 403 })

  const { propertyId } = await request.json()
  if (!propertyId) return Response.json({ error: 'propertyId is required' }, { status: 400 })

  const [{ data: property }, { data: entries }, { data: segments }, { data: priorities }, { data: plantRows }] = await Promise.all([
    supabaseAdmin.from('properties').select('*').eq('id', propertyId).maybeSingle(),
    supabaseAdmin.from('entries').select('*').eq('property_id', propertyId).order('created_at'),
    supabaseAdmin.from('guided_segments').select('segment_key, notes').eq('property_id', propertyId),
    supabaseAdmin.from('priorities').select('*').eq('property_id', propertyId).order('rank'),
    supabaseAdmin.from('property_plants').select('zone, photo_url').eq('property_id', propertyId).not('photo_url', 'is', null).order('created_at'),
  ])

  if (!property) return Response.json({ error: 'Property not found' }, { status: 404 })

  const notesByKey = {}
  ;(segments || []).forEach(s => { if (s.notes?.trim()) notesByKey[s.segment_key] = s.notes.trim() })

  const lines = []
  lines.push(`FIELD NOTES — ${property.address}`)
  lines.push(`Visit date: ${property.visit_date ?? '—'}`)
  lines.push('')
  lines.push('--- SITE NOTES BY CATEGORY ---')
  if (Object.keys(notesByKey).length) {
    NOTE_SEGMENTS.forEach(seg => { if (notesByKey[seg.key]) lines.push(`${seg.label}: ${notesByKey[seg.key]}`) })
  } else { lines.push('(none recorded)') }
  lines.push('')
  lines.push('--- PRIORITIES ---')
  if (priorities?.length) { priorities.forEach((p, i) => { if (p.text) lines.push(`${i + 1}. ${p.text}${p.why ? ' — ' + p.why : ''}`) }) } else { lines.push('(none set)') }
  lines.push('')
  lines.push('--- SATELLITE PRE-FLIGHT OBSERVATIONS (tentative, unconfirmed — context only, NOT a finding, do not use for compliance determinations) ---')
  const satellite = parseSatellite(property.satellite_analysis)
  if (satellite) {
    if (satellite.overview) lines.push(`Overview: ${satellite.overview}`)
    let hasAny = !!satellite.overview
    GUIDED_SEGMENTS.forEach(s => {
      const text = getAreaText(satellite, s.key)
      if (text) { lines.push(`${s.label}: ${text}`); hasAny = true }
    })
    if (!hasAny) lines.push('(no notable observations)')
  } else {
    lines.push('(not run for this property)')
  }
  lines.push('')
  lines.push('--- ENTRIES ---')
  if (entries?.length) {
    entries.forEach(en => {
      lines.push(`[${en.zone}] ${en.category} — ${en.status ?? 'Pending review'}`)
      if (en.distance) lines.push(`  Distance: ${en.distance}`)
      lines.push(`  Finding: ${en.note}`)
      if (en.detail) lines.push(`  Details: ${en.detail}`)
      if (en.photo_url) lines.push(`  Photo: ${en.photo_url}`)
      lines.push('')
    })
  } else { lines.push('(no entries logged)') }
  const fieldNotes = lines.join('\n')

  const entriesList = (entries || []).map(e =>
    `- [id:${e.id}] [${e.zone}] ${e.status ?? 'Pending review'}: ${e.note || ''}${e.detail ? ' — ' + e.detail : ''}${e.photo_url ? ' [HAS_PHOTO]' : ''}`
  ).join('\n')

  // Plant photos (see property_plants, migration 019/020) are handed to the
  // AI as actual images rather than text — there's nothing for the
  // inspector to type, the point is the AI identifies each plant visually.
  // Interleaved image + label so a photo's zone is unambiguous even with
  // several photos in one message.
  const plantImageBlocks = []
  ;(plantRows || []).forEach((p, i) => {
    plantImageBlocks.push({ type: 'image', source: { type: 'url', url: p.photo_url } })
    plantImageBlocks.push({ type: 'text', text: `↑ Plant photo #${i + 1} — captured in zone "${p.zone}"` })
  })

  const prompt = `You are an expert wildfire risk assessor writing a formal client-facing report. Use ONLY the field notes provided. Do not invent data.

The SATELLITE PRE-FLIGHT OBSERVATIONS below are tentative and unconfirmed — an AI's guess from an overhead photo, not something the inspector verified on the ground. You may use them as light color in the site overview narrative (e.g. general context about surrounding vegetation or lot layout), but never as a finding, never as a compliance determination, and never stated as fact — only the ENTRIES list reflects confirmed, on-the-ground findings.

${plantImageBlocks.length ? `${plantImageBlocks.length / 2} plant photo(s) are attached above this message, each labeled with the zone it was captured in — see the "vegetationConsiderations" instructions below for what to do with them.\n\n` : ''}Property: ${property.address}
Visit Date: ${property.visit_date || 'Not recorded'}
FHSZ: ${property.fhsz || 'Not determined'}

FIELD NOTES:
${fieldNotes}

ENTRIES (${(entries || []).length} logged):
${entriesList}

Respond with ONLY a single valid JSON object — no markdown code fences, no commentary before or after — matching this EXACT shape:

{
  "overallRiskRating": "Low" | "Moderate" | "High" | "Very High",
  "summaryNarrative": "2-4 sentences: biggest risks, notable strengths, overall assessment",
  "topPriorities": ["most urgent action", "second priority", "third priority"],
  "wphBase": "1-2 sentences: X of Y assessed categories meet Base requirements, listing non-compliant ones",
  "wphPlus": "1-2 sentences: X categories meet Plus Compliant status, noting if Base must be met first",
  "siteOverview": "3-5 sentences covering location context, FHSZ status, surrounding fuel load, primary ignition pathways",
  "zones": [
    {
      "zone": "exact zone name as it appears in ENTRIES, e.g. 'Roof' or '0-5 FT. Noncombustible Zone'",
      "findings": [
        {
          "category": "short label for this zone's finding — normally just the zone/category name itself",
          "finding": "what was observed for this category ACROSS THE WHOLE HOUSE, in plain client-facing language — synthesize every side into one description, e.g. 'Metal mesh present on the front, left, and back; missing on the right side.' Only call out per-side differences when they actually differ; if every side is the same, just say so once",
          "status": "Base Compliant" | "Plus Compliant" | "Non-Compliant" | "Needs Verification" | "Not Applicable" | "Pending review",
          "recommendation": "actionable next step — empty string if fully compliant and nothing is needed",
          "rationale": "brief explanation of WHY this status was assigned, especially for Non-Compliant/Needs Verification findings — shown to the client only when they click 'Learn more about this finding' (alongside the finding text above), so it's supporting detail, not something repeated elsewhere"
        }
      ]
    }
  ],
  "actionPlan": [
    { "action": "string", "zone": "string", "priority": "High" | "Medium" | "Low" }
  ],
  "photoCaptions": {
    "<exact id from ENTRIES, one entry per [HAS_PHOTO] entry only>": "short caption for that entry's photo, phrased as GUIDANCE rather than a plain description — an imperative action if the entry is Non-Compliant/Needs Verification (e.g. 'Remove shrubs within 5 ft of the house to meet defensible space requirements', not 'Shrubs within 5 ft of house'), or a brief confirmation if it's compliant (e.g. 'Metal mesh vent cover meets code')"
  },
  "vegetationIntro": "1-2 sentences prefacing that it's the COMBINATION and SPACING of plants together — not any single species alone — that most affects defensible-space wildfire risk, so a higher-risk plant isolated and well-spaced can matter less than several moderate-risk plants clustered together. Empty string if no plant photos were attached.",
  "vegetationConsiderations": [
    {
      "zone": "the zone this photo was captured in, exactly as labeled above the image, e.g. '5-30 FT. Defensible Space - Vegetation'",
      "photoUrl": "leave this as an empty string — you don't have the actual URL, the app fills it in afterward by matching each entry back to its photo by position",
      "plantId": "your best-guess identification of the plant's species or genus from the photo, e.g. 'Italian Cypress (Cupressus sempervirens)'. If you can't identify it confidently, say so plainly instead of guessing, e.g. 'Unable to confidently identify — appears to be a low, broadleaf shrub'",
      "assessment": "1-3 sentences: is this a fire-safe / defensible-space-appropriate choice and why, covering native-to-region status if you can reasonably judge it and general wildfire fuel characteristics (e.g. low-moisture/resinous/oily plants carry fire more readily than high-moisture, low-resin ones). Say so if you're not confident rather than asserting false precision",
      "spacingGuidance": "1-2 sentences of spacing/placement guidance specific to what's visible in this photo, referencing defensible-space spacing principles where relevant (e.g. shrub clusters capped at 10 ft wide with spacing at least 2x the tallest plant's height up to a 10 ft max, 10 ft horizontal clearance between continuous vegetation and the home, 6 ft vertical clearance under tree canopies)"
    }
  ]
}

Rules:
- One "zones" entry per distinct zone that has at least one entry logged — do not invent zones with no entries.
- Entries logged from different sides of the house (front/left/right/back) under the SAME zone (e.g. "Vents" logged on all four sides) must be MERGED into exactly ONE finding for that zone — never one finding per side. This report is organized by WPH category, not by side of the house, matching the original reporting structure; don't make it longer by breaking the same category out per side.
- When merging same-zone entries into one finding, the status should reflect the least-compliant entry among them (e.g. if 3 sides are Base Compliant and 1 side is Non-Compliant, the merged finding's status is Non-Compliant), and the rationale/finding text should note which side(s) are the outlier.
- In the rare case a zone genuinely has two unrelated issues that don't belong in the same sentence (e.g. two different detached structures with different problems), it's fine to have more than one finding — but default to one finding per zone.
- If an entry's status is "Pending review" (no status was recorded), use that exact string as the status rather than inventing a compliance determination.
- "actionPlan" should rank every non-empty recommendation across all zones by urgency — most urgent first.
- "photoCaptions" is keyed by entry id exactly as written after "id:" in ENTRIES — copy it verbatim, don't invent or reformat it. Only include entries marked [HAS_PHOTO]; skip everything else.
- Every string field must be present (use "" for an empty recommendation/rationale, never omit the key or use null).
- "vegetationConsiderations" is a SEPARATE section from "zones" — do NOT also fold plant commentary into any zone's finding/rationale text; that would duplicate it.
- Produce exactly one "vegetationConsiderations" entry per attached plant photo, IN THE SAME ORDER the photos were attached (photo #1 first, etc.) — the app matches them back to each photo by that order, so don't skip, merge, or reorder them. Leave "photoUrl" as "" as instructed above.
- If no plant photos were attached, "vegetationConsiderations" must be an empty array and "vegetationIntro" must be "".`

  const messageContent = [...plantImageBlocks, { type: 'text', text: prompt }]

  let reportData
  let aiResponse
  try {
    aiResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      messages: [{ role: 'user', content: messageContent }],
    })
  } catch (err) {
    console.error('report-draft generation error:', err)
    return Response.json({ error: 'Report generation failed: ' + err.message }, { status: 502 })
  }

  const raw = aiResponse.content[0].text
  try {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
    reportData = JSON.parse((fenced ? fenced[1] : raw).trim())
  } catch (err) {
    console.error('report-draft JSON parse error:', err, '— stop_reason:', aiResponse.stop_reason)
    const truncated = aiResponse.stop_reason === 'max_tokens'
    return Response.json({
      error: truncated
        ? 'The report was too large for the response limit and got cut off — try generating again. If this keeps happening, it may need splitting into fewer entries.'
        : 'The AI response wasn\'t valid JSON — try generating again.',
    }, { status: 502 })
  }

  // The model is told to leave "photoUrl" blank and just return entries in
  // the same order the photos were attached — filled back in here by
  // straight positional match, rather than trusting the model to copy a
  // URL string verbatim (a common source of subtly-mangled links).
  if (Array.isArray(reportData?.vegetationConsiderations)) {
    if (reportData.vegetationConsiderations.length !== (plantRows || []).length) {
      console.error(`report-draft: vegetationConsiderations count (${reportData.vegetationConsiderations.length}) doesn't match plant photo count (${(plantRows || []).length}) — matching what we can by position.`)
    }
    reportData.vegetationConsiderations = reportData.vegetationConsiderations.map((v, i) => ({
      ...v,
      photoUrl: plantRows?.[i]?.photo_url || '',
    })).filter(v => v.photoUrl)
  }

  const { error } = await supabaseAdmin
    .from('properties')
    .update({ report_draft_markdown: JSON.stringify(reportData), report_status: 'draft' })
    .eq('id', propertyId)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Save the untouched AI output as an 'ai_draft' version — this is the
  // "A" side of every A/B training pair the Report Quality portal builds
  // later (paired against whatever gets marked 'final' after edits). Not
  // fatal if this fails; the report itself already saved successfully.
  const { error: versionError } = await supabaseAdmin
    .from('report_versions')
    .insert({ property_id: propertyId, report_data: reportData, source: 'ai_draft', created_by: user.id })
  if (versionError) console.error('report-draft: failed to save ai_draft version:', versionError.message)

  return Response.json({ draft: reportData })
}
