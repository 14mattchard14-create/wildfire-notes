import { getAuthedUser, supabaseAdmin } from '@/lib/auth-server'

// Admin-only: list every account with its current role and assigned
// property (if any), for the Users & Roles tab. See
// PORTALS_AND_ROLES_PLAN.md resolved question #8 — existing accounts get
// reassigned explicitly through this UI, not auto-migrated.
export async function GET(request) {
  const { user, profile } = await getAuthedUser(request)
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })
  if (profile.role !== 'admin') return Response.json({ error: 'Admin account required' }, { status: 403 })

  // auth.users isn't queryable via the normal Supabase client — the
  // service-role admin API is the only way to list accounts + emails.
  const { data: authList, error: authError } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
  if (authError) return Response.json({ error: authError.message }, { status: 500 })

  const { data: profiles, error: profilesError } = await supabaseAdmin
    .from('profiles')
    .select('id, role, property_id')
  if (profilesError) return Response.json({ error: profilesError.message }, { status: 500 })

  const profileById = new Map(profiles.map(p => [p.id, p]))

  const { data: assignedProperties } = await supabaseAdmin
    .from('properties')
    .select('id, address, assigned_inspector_id')
    .not('assigned_inspector_id', 'is', null)
  const assignedByInspector = new Map()
  for (const p of assignedProperties || []) {
    const list = assignedByInspector.get(p.assigned_inspector_id) || []
    list.push({ id: p.id, address: p.address })
    assignedByInspector.set(p.assigned_inspector_id, list)
  }

  const users = authList.users
    .map(u => {
      const p = profileById.get(u.id)
      return {
        id: u.id,
        email: u.email,
        fullName: u.user_metadata?.full_name || null,
        role: p?.role || 'employee',
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at,
        assignedProperties: assignedByInspector.get(u.id) || [],
      }
    })
    .sort((a, b) => (a.email || '').localeCompare(b.email || ''))

  return Response.json({ users })
}
