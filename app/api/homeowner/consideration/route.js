import Anthropic from '@anthropic-ai/sdk'
import { getAuthedUser, supabaseAdmin } from '@/lib/auth-server'
import { GUIDED_SEGMENTS, OVERALL_SITE_SEGMENT } from '@/lib/criteria'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function resolvePropertyId(request, profile, body) {
  if (profile.role === 'homeowner') return profile.property_id
  return body.propertyId || null
}

// Saves a homeowner's typed answer to one consideration (auto-save, no
// explicit Save button), and/or — if they attached a follow-up photo —
// runs a second, narrowly-scoped AI check against just that consideration
// and stores the result alongside it. Both live in `guided_segments
// .considerations`, updated in place by id.
export async function POST(request) {
  const { user, profile } = await getAuthedUser(request)
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })
  if (profile.role !== 'employee' && profile.role !== 'homeowner') {
    return Response.json({ error: 'Inspector or homeowner account required' }, { status: 403 })
  }

  const body = await request.json()
  const { segmentKey, considerationId, answer, followUpPhotoUrl } = body
  const propertyId = resolvePropertyId(request, profile, body)
  if (!propertyId || !segmentKey || !considerationId) {
    return Response.json({ error: 'propertyId, segmentKey, and considerationId are required' }, { status: 400 })
  }

  const { data: row, error: loadError } = await supabaseAdmin
    .from('guided_segments')
    .select('considerations')
    .eq('property_id', propertyId)
    .eq('segment_key', segmentKey)
    .maybeSingle()

  if (loadError?.message?.includes('considerations') && (loadError.message.includes('does not exist') || loadError.message.includes('schema cache'))) {
    return Response.json({ error: 'This feature needs migration 031_guided_segments_considerations.sql run first.' }, { status: 500 })
  }
  if (loadError) return Response.json({ error: loadError.message }, { status: 500 })

  const considerations = row?.considerations || []
  const idx = considerations.findIndex(c => c.id === considerationId)
  if (idx === -1) return Response.json({ error: 'Consideration not found' }, { status: 404 })

  const updated = { ...considerations[idx] }
  if (typeof answer === 'string') {
    updated.answer = answer
    updated.answeredAt = new Date().toISOString()
  }

  if (followUpPhotoUrl) {
    const segment = segmentKey === 'overall_site' ? OVERALL_SITE_SEGMENT : GUIDED_SEGMENTS.find(s => s.key === segmentKey)
    let base64Image
    try {
      const imgRes = await fetch(followUpPhotoUrl)
      if (!imgRes.ok) throw new Error(`Photo fetch failed (${imgRes.status})`)
      const contentType = imgRes.headers.get('content-type') || 'image/jpeg'
      const buf = Buffer.from(await imgRes.arrayBuffer())
      base64Image = { data: buf.toString('base64'), media_type: contentType.split(';')[0] }
    } catch (err) {
      return Response.json({ error: 'Could not load the follow-up photo: ' + err.message }, { status: 502 })
    }

    const prompt = `A homeowner is doing a self-guided wildfire-risk walkthrough of the "${segment?.label || segmentKey}" area of their home. Earlier, this was flagged: "${updated.text}"${updated.answer ? ` They answered: "${updated.answer}".` : ''} They've now taken a closer follow-up photo specifically to help clarify this. Look at it and respond in 1-2 short, plain-language sentences confirming what you can now see, or saying what's still unclear. No jargon, no compliance terminology, no em dashes, no praise of unrelated things in the photo — stay focused on this one point.`

    try {
      const aiResponse = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: base64Image.media_type, data: base64Image.data } },
            { type: 'text', text: prompt },
          ],
        }],
      })
      updated.followUpPhotoUrl = followUpPhotoUrl
      updated.followUpResponse = aiResponse.content[0].text
    } catch (err) {
      console.error('consideration follow-up AI error:', err)
      return Response.json({ error: 'Follow-up analysis failed: ' + err.message }, { status: 502 })
    }
  }

  considerations[idx] = updated

  const { error: saveError } = await supabaseAdmin
    .from('guided_segments')
    .update({ considerations, updated_at: new Date().toISOString() })
    .eq('property_id', propertyId)
    .eq('segment_key', segmentKey)

  if (saveError) return Response.json({ error: saveError.message }, { status: 500 })

  if (profile.role === 'homeowner') {
    await supabaseAdmin
      .from('properties')
      .update({ homeowner_status: 'in_progress' })
      .eq('id', propertyId)
      .eq('homeowner_status', 'invited')
  }

  return Response.json({ consideration: updated })
}
