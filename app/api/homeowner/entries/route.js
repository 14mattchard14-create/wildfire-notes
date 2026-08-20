import { getAuthedUser, supabaseAdmin } from '@/lib/auth-server'

// Homeowner-safe entries endpoint. This is the actual server-side
// enforcement point for "homeowner must never see or set compliance
// status" — `status` is stripped from every response here, full stop,
// regardless of what's in the database. Never add `status` to the
// select() below or to any response payload in this file.
//
// Staff preview override: any signed-in non-homeowner account may pass
// ?propertyId=<id> to view/exercise this exact endpoint against a real
// property, for QA'ing the homeowner experience without a second account.
// Homeowner accounts can never use this override — they're always locked
// to their own profile.property_id, invite-flow-assigned, same as before.
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

  const [{ data, error }, { data: property }] = await Promise.all([
    supabaseAdmin
      .from('entries')
      .select('id, zone, category, note, detail, distance, photo_url, created_at, created_by_name')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('properties')
      .select('id, address, visit_date, homeowner_status')
      .eq('id', propertyId)
      .maybeSingle(),
  ])

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ entries: data, property })
}

export async function POST(request) {
  const { user, profile } = await getAuthedUser(request)
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })
  const propertyId = resolvePropertyId(request, profile)
  if (profile.role !== 'homeowner' && !propertyId) return Response.json({ error: 'propertyId is required for staff preview' }, { status: 400 })
  if (!propertyId) return Response.json({ error: 'No property linked to this account' }, { status: 400 })

  const body = await request.json()
  const { zone, category, note, detail, distance, photo_url } = body

  if (!zone || !note?.trim()) return Response.json({ error: 'zone and note are required' }, { status: 400 })

  const userName = user.user_metadata?.full_name || user.email || 'Homeowner'

  const { data, error } = await supabaseAdmin
    .from('entries')
    .insert({
      property_id: propertyId, // always the invited (or staff-preview) property — never client-supplied in the body
      zone,
      category: category || zone,
      status: null, // homeowners never set compliance status — determined later by an inspector/rules engine
      note: note.trim(),
      detail: detail || null,
      distance: distance || null,
      photo_url: photo_url || null,
      created_by: user.id,
      created_by_name: profile.role === 'homeowner' ? userName : `${userName} (preview)`,
    })
    .select('id, zone, category, note, detail, distance, photo_url, created_at, created_by_name')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // First entry moves the property from 'invited' to 'in_progress' for the
  // admin dashboard. Doesn't touch 'submitted'/'done' — adding more notes
  // after finishing shouldn't regress the status. Skipped entirely for
  // staff previews so clicking around doesn't perturb a real property's
  // homeowner_status.
  if (profile.role === 'homeowner') {
    await supabaseAdmin
      .from('properties')
      .update({ homeowner_status: 'in_progress' })
      .eq('id', propertyId)
      .eq('homeowner_status', 'invited')
  }

  return Response.json({ entry: data })
}
