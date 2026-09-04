import { getAuthedUser, supabaseAdmin } from '@/lib/auth-server'

// Homeowner-safe guided_segments endpoint — the data backing
// HomeownerGuidedEntry.js. Mirrors app/api/homeowner/entries/route.js's
// resolvePropertyId pattern: a homeowner is always locked to their own
// profile.property_id; staff may pass ?propertyId= to QA a real property
// without a second account.
function resolvePropertyId(request, profile) {
  if (profile.role === 'homeowner') return profile.property_id
  const url = new URL(request.url)
  return url.searchParams.get('propertyId') || null
}

export async function GET(request) {
  const { user, profile } = await getAuthedUser(request)
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })
  const propertyId = resolvePropertyId(request, profile)
  if (profile.role !== 'homeowner' && !propertyId) return Response.json({ error: 'propertyId is required for staff preview' }, { status: 400 })
  if (!propertyId) return Response.json({ error: 'No property linked to this account' }, { status: 400 })

  const [{ data: segments, error }, { data: property }] = await Promise.all([
    supabaseAdmin
      .from('guided_segments')
      .select('segment_key, photo_url, ai_suggestions, notes')
      .eq('property_id', propertyId),
    supabaseAdmin
      .from('properties')
      .select('id, address, homeowner_status')
      .eq('id', propertyId)
      .maybeSingle(),
  ])

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ segments: segments || [], property })
}

// Saves the freeform notes box for one segment — separate from
// segment-analysis's POST (which is specifically "analyze this photo") so
// notes can be edited/saved independently of running (or re-running) the
// AI gap-check.
export async function POST(request) {
  const { user, profile } = await getAuthedUser(request)
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })
  const propertyId = resolvePropertyId(request, profile)
  if (profile.role !== 'homeowner' && !propertyId) return Response.json({ error: 'propertyId is required for staff preview' }, { status: 400 })
  if (!propertyId) return Response.json({ error: 'No property linked to this account' }, { status: 400 })

  const { segmentKey, notes } = await request.json()
  if (!segmentKey) return Response.json({ error: 'segmentKey is required' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('guided_segments')
    .upsert({
      property_id: propertyId,
      segment_key: segmentKey,
      notes: notes ?? '',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'property_id,segment_key' })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  if (profile.role === 'homeowner') {
    await supabaseAdmin
      .from('properties')
      .update({ homeowner_status: 'in_progress' })
      .eq('id', propertyId)
      .eq('homeowner_status', 'invited')
  }

  return Response.json({ ok: true })
}
