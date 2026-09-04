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

// PostgREST phrases a missing column differently depending on whether it's
// a read (raw Postgres error, "column ... does not exist") or a write
// (its own schema-cache validation, "Could not find the 'X' column ...
// in the schema cache") — same root cause, two different message shapes.
function isMissingColumnError(error, columnName) {
  if (!error?.message?.includes(columnName)) return false
  return error.message.includes('does not exist') || error.message.includes('schema cache')
}

export async function GET(request) {
  const { user, profile } = await getAuthedUser(request)
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })
  const propertyId = resolvePropertyId(request, profile)
  if (profile.role !== 'homeowner' && !propertyId) return Response.json({ error: 'propertyId is required for staff preview' }, { status: 400 })
  if (!propertyId) return Response.json({ error: 'No property linked to this account' }, { status: 400 })

  const { data: property } = await supabaseAdmin
    .from('properties')
    .select('id, address, homeowner_status')
    .eq('id', propertyId)
    .maybeSingle()

  // Falls back column-by-column rather than 500ing the whole page when a
  // migration (009 for notes, 031 for considerations) hasn't been run
  // against this database yet — see NEXT_STEPS.md's Action Required list.
  let columns = 'segment_key, photo_url, ai_suggestions, notes, considerations'
  let { data: segments, error } = await supabaseAdmin.from('guided_segments').select(columns).eq('property_id', propertyId)
  let considerationsColumnMissing = false
  if (isMissingColumnError(error, 'considerations')) {
    considerationsColumnMissing = true
    columns = 'segment_key, photo_url, ai_suggestions, notes'
    ;({ data: segments, error } = await supabaseAdmin.from('guided_segments').select(columns).eq('property_id', propertyId))
  }
  let notesColumnMissing = false
  if (isMissingColumnError(error, 'notes')) {
    notesColumnMissing = true
    columns = 'segment_key, photo_url, ai_suggestions'
    ;({ data: segments, error } = await supabaseAdmin.from('guided_segments').select(columns).eq('property_id', propertyId))
  }

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ segments: segments || [], property, notesColumnMissing, considerationsColumnMissing })
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

  if (isMissingColumnError(error, 'notes')) {
    return Response.json({ error: 'Notes aren\'t set up on this database yet — run migration 009_guided_segment_notes.sql, then try again.' }, { status: 500 })
  }
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
