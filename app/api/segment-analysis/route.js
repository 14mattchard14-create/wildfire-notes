import Anthropic from '@anthropic-ai/sdk'
import { getAuthedUser, supabaseAdmin } from '@/lib/auth-server'
import { GUIDED_SEGMENTS, OVERALL_SITE_SEGMENT } from '@/lib/criteria'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Per-segment gap-analysis: one photo of the whole side/zone, checked
// against the segment's checklist. Output is a soft suggestion banner —
// it never auto-creates entries. Used by both roles, with different
// framing:
//   - Inspector: sees which checklist items are already logged (entries
//     table) vs. not, and gets suggestions phrased for a trained
//     professional deciding what to log.
//   - Homeowner: never sees the checklist's WPH/compliance framing or any
//     logged/not-logged state (homeowners don't create entries at all —
//     compliance is determined later, server-side, from what they
//     capture here). Gets plain-language guidance, and when the AI can't
//     tell something from the photo, one direct clarifying question
//     instead of jargon.

export async function POST(request) {
  const { user, profile } = await getAuthedUser(request)
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })
  if (profile.role !== 'employee' && profile.role !== 'homeowner') {
    return Response.json({ error: 'Inspector or homeowner account required' }, { status: 403 })
  }

  const body = await request.json()
  const { segmentKey, photoUrl } = body
  // Homeowners are always scoped to their own invited property — never to
  // whatever propertyId a request body claims, same pattern as
  // /api/homeowner/entries. Staff pass propertyId explicitly.
  const propertyId = profile.role === 'homeowner' ? profile.property_id : body.propertyId
  if (!propertyId || !segmentKey || !photoUrl) {
    return Response.json({ error: 'propertyId, segmentKey, and photoUrl are required' }, { status: 400 })
  }

  const segment = segmentKey === 'overall_site'
    ? OVERALL_SITE_SEGMENT
    : GUIDED_SEGMENTS.find(s => s.key === segmentKey)
  if (!segment) return Response.json({ error: 'Unknown segment' }, { status: 400 })

  const { data: property } = await supabaseAdmin
    .from('properties')
    .select('id, address')
    .eq('id', propertyId)
    .maybeSingle()
  if (!property) return Response.json({ error: 'Property not found' }, { status: 404 })

  let base64Image
  try {
    const imgRes = await fetch(photoUrl)
    if (!imgRes.ok) throw new Error(`Photo fetch failed (${imgRes.status})`)
    const contentType = imgRes.headers.get('content-type') || 'image/jpeg'
    const buf = Buffer.from(await imgRes.arrayBuffer())
    base64Image = { data: buf.toString('base64'), media_type: contentType.split(';')[0] }
  } catch (err) {
    console.error('segment-analysis image fetch error:', err)
    return Response.json({ error: 'Could not load the segment photo: ' + err.message }, { status: 502 })
  }

  let prompt
  if (profile.role === 'homeowner') {
    // Plain-language checklist — item labels + hints only, no zone/status
    // jargon, no logged/not-logged state (homeowners never create
    // entries, so there's nothing to compare against).
    const checklistBlock = segment.items.map(item => `- ${item.label}: ${item.hint}`).join('\n')

    prompt = `You're helping a homeowner (not a professional inspector) photo-document the "${segment.label}" area of their home at ${property.address}, as part of a self-guided wildfire-risk walkthrough.

Things worth checking in this area:
${checklistBlock}

Look at their photo and identify individual considerations worth raising with the homeowner: things that need a closer look, or something you genuinely can't tell from this photo and need to ask about. Do not mention or praise anything that already looks fine, only flag what's actually worth their attention. Each consideration should be plain language, no technical jargon, no compliance terminology, no codes or standards references. Never use a dash or hyphen to join two clauses in one sentence (not even a plain "-") — write two separate sentences instead, or use a comma. If there's truly nothing worth raising, return an empty list.

Respond with ONLY a JSON object, no other text, in exactly this shape:
{"considerations": [{"text": "short plain-language observation or question", "isQuestion": true or false}]}

Use "isQuestion": true only when you genuinely cannot tell something from the photo and need the homeowner to answer (e.g. "Does the deck underneath look enclosed, or open?"). Use "isQuestion": false for something worth a closer look that doesn't need an answer, just their attention. Keep each "text" to one short sentence. Return at most 4 considerations.`
  } else {
    const segmentZones = [...new Set(segment.items.map(i => i.zone))]
    const { data: allEntries } = await supabaseAdmin
      .from('entries')
      .select('zone, detail, note, status, photo_url')
      .eq('property_id', propertyId)
      .in('zone', segmentZones)

    const loggedLabels = new Set((allEntries || []).map(e => e.detail).filter(Boolean))

    const checklistBlock = segment.items.map(item =>
      `- ${item.label}${loggedLabels.has(item.label) ? ' [LOGGED]' : ' [NOT YET LOGGED]'} — ${item.hint}`
    ).join('\n')

    const entriesBlock = (allEntries || []).length
      ? allEntries.map(e => `- [${e.zone}] ${e.detail || '(no item)'}: ${e.note || ''}${e.status ? ' — ' + e.status : ''}`).join('\n')
      : '(none logged yet for this segment)'

    prompt = `You are assisting a wildfire home-hardening inspector during a walkthrough of ${property.address}. This photo covers the "${segment.label}" segment.

Checklist for this segment:
${checklistBlock}

Entries already logged for this segment:
${entriesBlock}

Looking at the photo, flag anything from the checklist that appears visible but is marked NOT YET LOGGED, and anything else in the photo that looks worth a closer look (even if it's not on the checklist). This is a soft suggestion only — the inspector decides what to actually log. Be brief and concrete. Output 2-5 short bullet points starting with "-". If nothing stands out beyond what's already logged, say so in one line.`
  }

  let rawResponse
  try {
    const aiResponse = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: base64Image.media_type, data: base64Image.data } },
          { type: 'text', text: prompt },
        ],
      }],
    })
    rawResponse = aiResponse.content[0].text
  } catch (err) {
    console.error('segment-analysis AI error:', err)
    return Response.json({ error: 'Analysis failed: ' + err.message }, { status: 502 })
  }

  if (profile.role === 'homeowner') {
    const considerations = parseConsiderations(rawResponse)

    const { error } = await supabaseAdmin
      .from('guided_segments')
      .upsert({
        property_id: propertyId,
        segment_key: segmentKey,
        photo_url: photoUrl,
        considerations,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'property_id,segment_key' })

    if (isMissingColumnError(error, 'considerations')) {
      return Response.json({ error: 'This feature needs migration 031_guided_segments_considerations.sql run first.' }, { status: 500 })
    }
    if (error) return Response.json({ error: error.message }, { status: 500 })

    // Same "first activity moves Invited -> In Progress" behavior as the
    // homeowner/entries route — this is often a homeowner's first real
    // action in the walkthrough, so it shouldn't be the only place that
    // transition can happen, but it needs to happen here too.
    await supabaseAdmin
      .from('properties')
      .update({ homeowner_status: 'in_progress' })
      .eq('id', propertyId)
      .eq('homeowner_status', 'invited')

    return Response.json({ considerations })
  }

  const { error } = await supabaseAdmin
    .from('guided_segments')
    .upsert({
      property_id: propertyId,
      segment_key: segmentKey,
      photo_url: photoUrl,
      ai_suggestions: rawResponse,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'property_id,segment_key' })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ suggestions: rawResponse })
}

// Claude sometimes wraps JSON in a markdown code fence despite being asked
// not to — strip that before parsing. Falls back to a single non-question
// consideration holding the raw text if parsing fails outright, so a
// malformed response degrades to "something to read" rather than silently
// vanishing.
function parseConsiderations(rawResponse) {
  const cleaned = rawResponse.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
  try {
    const parsed = JSON.parse(cleaned)
    const list = Array.isArray(parsed?.considerations) ? parsed.considerations : []
    return list
      .filter(c => c && typeof c.text === 'string' && c.text.trim())
      .slice(0, 6)
      .map(c => ({
        id: crypto.randomUUID(),
        text: c.text.trim(),
        isQuestion: !!c.isQuestion,
        answer: null,
        answeredAt: null,
        followUpPhotoUrl: null,
        followUpResponse: null,
      }))
  } catch {
    console.error('segment-analysis: could not parse considerations JSON:', rawResponse)
    return [{
      id: crypto.randomUUID(),
      text: cleaned || 'Could not analyze this photo. Try again.',
      isQuestion: false,
      answer: null,
      answeredAt: null,
      followUpPhotoUrl: null,
      followUpResponse: null,
    }]
  }
}

// Same PostgREST dual-phrasing issue as app/api/homeowner/segments/route.js
// — a missing column errors differently on read vs. write.
function isMissingColumnError(error, columnName) {
  if (!error?.message?.includes(columnName)) return false
  return error.message.includes('does not exist') || error.message.includes('schema cache')
}
