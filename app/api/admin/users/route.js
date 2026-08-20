import { getAuthedUser, supabaseAdmin } from '@/lib/auth-server'

// Admin AND Manager: list every account with its current role and
// assigned property (if any). Originally admin-only for the Users & Roles
// tab (see PORTALS_AND_ROLES_PLAN.md resolved question #8 — existing
// accounts get reassigned explicitly through that UI, not auto-migrated);
// Manager was added so the "assign someone else" picker in
// /manage/[id] has a roster to populate for non-admin managers too. The
// Users & Roles page itself stays admin-only (gated separately in
// AdminSidebar.js via adminOnly), so a Manager calling this route only
// ever sees it rendered as a plain assignee dropdown, not the full
// role-management UI.
export async function GET(request) {
  const { user, profile } = await getAuthedUser(request)
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })
  if (profile.role !== 'admin' && profile.role !== 'manager') return Response.json({ error: 'Admin or Manager account required' }, { status: 403 })

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
