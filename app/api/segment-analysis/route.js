import Anthropic from '@anthropic-ai/sdk'
import { getAuthedUser, supabaseAdmin } from '@/lib/auth-server'
import { GUIDED_SEGMENTS, OVERALL_SITE_SEGMENT } from '@/lib/criteria'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Per-segment gap-analysis: one photo of the whole side/zone + whatever
// entries were logged for that segment, checked against the segment's
// checklist. Output is a soft suggestion banner — it never auto-creates
// entries or auto-injects questions, it just flags things worth a second
// look before moving on to the next segment.

export async function POST(request) {
  const { user, profile } = await getAuthedUser(request)
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })
  if (profile.role !== 'employee') return Response.json({ error: 'Inspector account required' }, { status: 403 })

  const { propertyId, segmentKey, photoUrl } = await request.json()
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

  const prompt = `You are assisting a wildfire home-hardening inspector during a walkthrough of ${property.address}. This photo covers the "${segment.label}" segment.

Checklist for this segment:
${checklistBlock}

Entries already logged for this segment:
${entriesBlock}

Looking at the photo, flag anything from the checklist that appears visible but is marked NOT YET LOGGED, and anything else in the photo that looks worth a closer look (even if it's not on the checklist). This is a soft suggestion only — the inspector decides what to actually log. Be brief and concrete. Output 2-5 short bullet points starting with "-". If nothing stands out beyond what's already logged, say so in one line.`

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

  return Response.json({ suggestions })
}
