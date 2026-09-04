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

Look at their photo and give brief, friendly, plain-language guidance — no technical jargon, no compliance terminology, no codes or standards references. If something on the list looks like it might need a closer look, say so simply (e.g. "Can't quite tell if there's mesh on that vent — a closer shot would help" rather than referencing ember-resistant mesh specifications). If you genuinely can't tell something important from this photo, end with ONE direct, simple yes/no or short-answer question you'd want them to answer (e.g. "Does the deck underneath look enclosed, or open?"). Only ask a question if you're truly unsure about something that matters — don't force one. Keep the whole response to 2-4 short lines.`
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

  let suggestions
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
    suggestions = aiResponse.content[0].text
  } catch (err) {
    console.error('segment-analysis AI error:', err)
    return Response.json({ error: 'Analysis failed: ' + err.message }, { status: 502 })
  }

  const { error } = await supabaseAdmin
    .from('guided_segments')
    .upsert({
      property_id: propertyId,
      segment_key: segmentKey,
      photo_url: photoUrl,
      ai_suggestions: suggestions,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'property_id,segment_key' })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Same "first activity moves Invited -> In Progress" behavior as the
  // homeowner/entries route — this is often a homeowner's first real
  // action in the walkthrough, so it shouldn't be the only place that
  // transition can happen, but it needs to happen here too.
  if (profile.role === 'homeowner') {
    await supabaseAdmin
      .from('properties')
      .update({ homeowner_status: 'in_progress' })
      .eq('id', propertyId)
      .eq('homeowner_status', 'invited')
  }

  return Response.json({ suggestions })
}
