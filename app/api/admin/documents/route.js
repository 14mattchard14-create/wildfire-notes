import { getAuthedUser, supabaseAdmin } from '@/lib/auth-server'

// Admin-only document storage — see PORTALS_AND_ROLES_PLAN.md "Also
// decided (this round): a Documentation tab". Same admin-gate pattern as
// /api/admin/users.

export async function GET(request) {
  const { user, profile } = await getAuthedUser(request)
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })
  if (profile.role !== 'admin') return Response.json({ error: 'Admin account required' }, { status: 403 })

  const { data, error } = await supabaseAdmin
    .from('admin_documents')
    .select('id, title, content, created_by_name, updated_by_name, created_at, updated_at')
    .order('updated_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ documents: data || [] })
}

export async function POST(request) {
  const { user, profile } = await getAuthedUser(request)
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })
  if (profile.role !== 'admin') return Response.json({ error: 'Admin account required' }, { status: 403 })

  const { title, content } = await request.json()
  if (!title?.trim()) return Response.json({ error: 'title is required' }, { status: 400 })

  const authorName = user.user_metadata?.full_name || user.email || 'Admin'
  const { data, error } = await supabaseAdmin
    .from('admin_documents')
    .insert({ title: title.trim(), content: content || '', created_by_name: authorName, updated_by_name: authorName })
    .select('id, title, content, created_by_name, updated_by_name, created_at, updated_at')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ document: data })
}
