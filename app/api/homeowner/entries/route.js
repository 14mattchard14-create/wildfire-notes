import { getAuthedUser, supabaseAdmin } from '@/lib/auth-server'

// Homeowner-safe entries endpoint. This is the actual server-side
// enforcement point for "homeowner must never see or set compliance
// status" — `status` is stripped from every response here, full stop,
// regardless of what's in the database. Never add `status` to the
// select() below or to any response payload in this file.

export async function GET(request) {
  const { user, profile } = await getAuthedUser(request)
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })
  if (profile.role !== 'homeowner') return Response.json({ error: 'Homeowner account required' }, { status: 403 })
  if (!profile.property_id) return Response.json({ error: 'No property linked to this account' }, { status: 400 })

  const [{ data, error }, { data: property }] = await Promise.all([
    supabaseAdmin
      .from('entries')
      .select('id, zone, category, note, detail, distance, photo_url, created_at, created_by_name')
      .eq('property_id', profile.property_id)
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('properties')
      .select('id, address, visit_date, homeowner_status')
      .eq('id', profile.property_id)
      .maybeSingle(),
  ])

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ entries: data, property })
}

export async function POST(request) {
  const { user, profile } = await getAuthedUser(request)
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })
  if (profile.role !== 'homeowner') return Response.json({ error: 'Homeowner account required' }, { status: 403 })
  if (!profile.property_id) return Response.json({ error: 'No property linked to this account' }, { status: 400 })

  const body = await request.json()
  const { zone, category, note, detail, distance, photo_url } = body

  if (!zone || !note?.trim()) return Response.json({ error: 'zone and note are required' }, { status: 400 })

  const userName = user.user_metadata?.full_name || user.email || 'Homeowner'

  const { data, error } = await supabaseAdmin
    .from('entries')
    .insert({
      property_id: profile.property_id, // always the invited property — never client-supplied
      zone,
      category: category || zone,
      status: null, // homeowners never set compliance status — determined later by an inspector/rules engine
      note: note.trim(),
      detail: detail || null,
      distance: distance || null,
      photo_url: photo_url || null,
      created_by: user.id,
      created_by_name: userName,
    })
    .select('id, zone, category, note, detail, distance, photo_url, created_at, created_by_name')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // First entry moves the property from 'invited' to 'in_progress' for the
  // admin dashboard. Doesn't touch 'submitted'/'done' — adding more notes
  // after finishing shouldn't regress the status.
  await supabaseAdmin
    .from('properties')
    .update({ homeowner_status: 'in_progress' })
    .eq('id', profile.property_id)
    .eq('homeowner_status', 'invited')

  return Response.json({ entry: data })
}
