import Anthropic from '@anthropic-ai/sdk'
import { getAuthedUser, supabaseAdmin } from '@/lib/auth-server'
import { GUIDED_SEGMENTS } from '@/lib/criteria'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// One-time pre-flight pass over a satellite view of the whole property, run
// before the walkthrough starts. Flags large visible features as
// tentative-only candidates — this never creates entries on its own, it
// seeds each Guided Entry segment with things to watch for once the
// inspector actually gets there, and also feeds into report generation
// (see report-draft/route.js) as unconfirmed context.
//
// Earlier versions of this route tried to also place a clickable dot per
// segment directly on the photo (first AI-guessed x/y per segment, then a
// house-bounding-box + geometry approach). Neither was reliable enough in
// practice, so this went back to the simpler original design: one tightly
// cropped photo + a plain per-segment text list underneath it.
//
// Also fetches a Street View Static image of the property when Google has
// coverage there (checked via the metadata endpoint first). The satellite
// crop is top-down only, so it can't show roof material, siding, vents, or
// eaves the way a ground-level shot of the front of the house can — both
// images go to the AI together when a street view is available.

function safeParseJson(text) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  try { return JSON.parse(cleaned) } catch { return null }
}

export async function POST(request) {
  const { user, profile } = await getAuthedUser(request)
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })
  if (profile.role !== 'employee') return Response.json({ error: 'Inspector account required' }, { status: 403 })

  const { propertyId } = await request.json()
  if (!propertyId) return Response.json({ error: 'propertyId is required' }, { status: 400 })

  const { data: property } = await supabaseAdmin
    .from('properties')
    .select('id, address, lat, lng')
    .eq('id', propertyId)
    .maybeSingle()

  if (!property) return Response.json({ error: 'Property not found' }, { status: 404 })
  if (!property.lat || !property.lng) {
    return Response.json({ error: 'No coordinates on file for this property yet — add the address via autocomplete first.' }, { status: 400 })
  }

  const apiKey = process.env.GOOGLE_MAPS_KEY
  // zoom=21 is effectively as far in as Static Maps satellite imagery goes.
  // A smaller pixel size at the same zoom level shows less surrounding
  // area (not more image, just less neighborhood) — that's what actually
  // crops in tight on the house, since zoom alone was already maxed out.
  // scale=2 doubles pixel density at that same framing for more detail.
  const mapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${property.lat},${property.lng}&zoom=21&size=400x400&scale=2&maptype=satellite&key=${apiKey}`

  let imageBuffer
  try {
    const imgRes = await fetch(mapUrl)
    if (!imgRes.ok) {
      // Google returns a plain-text/HTML reason (billing not enabled, key
      // restricted, etc.) — surface it instead of just the status code.
      const body = await imgRes.text().catch(() => '')
      console.error('satellite-analysis Static Maps error body:', body)
      throw new Error(`Static Maps request failed (${imgRes.status})${body ? ': ' + body.slice(0, 300) : ''}`)
    }
    imageBuffer = Buffer.from(await imgRes.arrayBuffer())
  } catch (err) {
    console.error('satellite-analysis image fetch error:', err)
    return Response.json({ error: 'Could not fetch satellite image: ' + err.message }, { status: 502 })
  }

  // Save the image itself so the UI can display it (reuses the existing
  // entry-photos bucket under a satellite/ prefix — no new bucket needed).
  let imageUrl = null
  try {
    const path = `satellite/${propertyId}.png`
    const { error: uploadError } = await supabaseAdmin.storage
      .from('entry-photos')
      .upload(path, imageBuffer, { contentType: 'image/png', upsert: true })
    if (uploadError) throw uploadError
    const { data: pub } = supabaseAdmin.storage.from('entry-photos').getPublicUrl(path)
    imageUrl = pub.publicUrl
  } catch (err) {
    console.error('satellite-analysis image upload error:', err)
    // Not fatal — analysis can still proceed and return suggestions even if
    // the image itself couldn't be stored for display.
  }

  // Street View companion image — the satellite crop is top-down only, so
  // it can't show roof pitch/material, siding, vents, or eaves the way a
  // ground-level shot of the front of the house can. Checked via the free
  // metadata endpoint first so we don't store (or hand the AI) Google's
  // grey "no imagery here" placeholder for rural/private addresses where
  // no Street View car has driven by.
  let streetViewImageBuffer = null
  let streetViewImageUrl = null
  try {
    const svMetaUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${property.lat},${property.lng}&key=${apiKey}`
    const metaRes = await fetch(svMetaUrl)
    const meta = await metaRes.json().catch(() => null)
    if (meta?.status === 'OK') {
      const svUrl = `https://maps.googleapis.com/maps/api/streetview?size=640x400&location=${property.lat},${property.lng}&fov=80&key=${apiKey}`
      const svRes = await fetch(svUrl)
      if (svRes.ok) {
        streetViewImageBuffer = Buffer.from(await svRes.arrayBuffer())
        // Unlike Static Maps (PNG), the Street View Static API always
        // returns JPEG — no format param to change that.
        const path = `street-view/${propertyId}.jpg`
        const { error: uploadError } = await supabaseAdmin.storage
          .from('entry-photos')
          .upload(path, streetViewImageBuffer, { contentType: 'image/jpeg', upsert: true })
        if (uploadError) throw uploadError
        const { data: pub } = supabaseAdmin.storage.from('entry-photos').getPublicUrl(path)
        streetViewImageUrl = pub.publicUrl
      }
    }
  } catch (err) {
    console.error('satellite-analysis street view fetch/upload error:', err)
    // Not fatal — no Street View coverage at this address is common
    // (rural roads, private drives), and the satellite scan still works
    // fine on its own either way.
  }

  const schemaFields = GUIDED_SEGMENTS.map(s =>
    `  "${s.key}": "short note on what to watch for here, or empty string if nothing stands out"`
  ).join(',\n')

  const prompt = `You are assisting a wildfire home-hardening inspector before they walk ${property.address} in person. The first image is a satellite/overhead view of the property, cropped in tight and zoomed as far as the imagery allows.${streetViewImageBuffer ? ' The second image is a Google Street View shot of the property from the road — use it for anything the top-down satellite view can\'t show well: roof pitch/material, siding, windows/doors, vents, eaves, and the front of the house generally.' : ''}

For each of the following segments, note anything large and visible worth watching for once the inspector reaches that side in person — detached structures, dense tree canopy or vegetation clusters, roof shape/material hints, decks or patios, driveway/access routes, neighboring vegetation close to the property line. This is a tentative pre-flight scan only, not a finding — the inspector confirms everything on the ground.
${GUIDED_SEGMENTS.map(s => `"${s.key}": "${s.label}"`).join('\n')}

Respond with ONLY a valid JSON object, no markdown code fences, no extra commentary. Structure:
{
  "overview": "1-3 sentence overall summary of what's visible from above${streetViewImageBuffer ? ' and from the street' : ''}",
${schemaFields}
}

Use empty strings for segments where the imagery genuinely shows nothing notable — don't invent findings to fill every field.`

  let suggestions
  try {
    const aiResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: imageBuffer.toString('base64') } },
          ...(streetViewImageBuffer ? [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: streetViewImageBuffer.toString('base64') } }] : []),
          { type: 'text', text: prompt },
        ],
      }],
    })
    const raw = aiResponse.content[0].text
    suggestions = safeParseJson(raw) || { overview: raw }
  } catch (err) {
    console.error('satellite-analysis AI error:', err)
    return Response.json({ error: 'Analysis failed: ' + err.message }, { status: 502 })
  }

  const { error } = await supabaseAdmin
    .from('properties')
    .update({
      satellite_analysis: JSON.stringify(suggestions),
      satellite_image_url: imageUrl,
      street_view_image_url: streetViewImageUrl,
      satellite_analyzed_at: new Date().toISOString(),
    })
    .eq('id', propertyId)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ suggestions, imageUrl, streetViewImageUrl })
}
