import { getAuthedUser, supabaseAdmin } from '@/lib/auth-server'

const VALID_ROLES = ['employee', 'homeowner', 'admin', 'partner', 'field_inspector', 'manager']

// Admin-only: reassign a single account's role. Upserts the profiles row
// rather than requiring one to already exist, since some accounts may
// predate the profiles trigger or have a stale/missing row.
export async function PATCH(request, { params }) {
  const { id } = await params
  const { user, profile } = await getAuthedUser(request)
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })
  if (profile.role !== 'admin') return Response.json({ error: 'Admin account required' }, { status: 403 })

  const { role } = await request.json()
  if (!VALID_ROLES.includes(role)) return Response.json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .upsert({ id, role }, { onConflict: 'id' })
    .select('id, role, property_id')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ profile: data })
}

// Admin-only: permanently delete an account (auth.users row + cascaded
// profiles row). Blocks self-deletion so an admin can't lock themselves
// out. Will fail with a DB foreign-key error if the account has created
// or redeemed a homeowner invite (homeowner_invites.created_by/used_by
// has no ON DELETE clause) — that's intentional rather than silently
// orphaning invite history; check for that first if this errors.
export async function DELETE(request, { params }) {
  const { id } = await params
  const { user, profile } = await getAuthedUser(request)
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })
  if (profile.role !== 'admin') return Response.json({ error: 'Admin account required' }, { status: 403 })
  if (id === user.id) return Response.json({ error: "Can't delete your own account" }, { status: 400 })

  const { error } = await supabaseAdmin.auth.admin.deleteUser(id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
