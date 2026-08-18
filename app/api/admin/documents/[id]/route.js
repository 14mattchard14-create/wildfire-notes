import { getAuthedUser, supabaseAdmin } from '@/lib/auth-server'

export async function PATCH(request, { params }) {
  const { id } = await params
  const { user, profile } = await getAuthedUser(request)
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })
  if (profile.role !== 'admin') return Response.json({ error: 'Admin account required' }, { status: 403 })

  const { title, content } = await request.json()
  const update = { updated_at: new Date().toISOString(), updated_by_name: user.user_metadata?.full_name || user.email || 'Admin' }
  if (title !== undefined) {
    if (!title.trim()) return Response.json({ error: 'title cannot be empty' }, { status: 400 })
    update.title = title.trim()
  }
  if (content !== undefined) update.content = content

  const { data, error } = await supabaseAdmin
    .from('admin_documents')
    .update(update)
    .eq('id', id)
    .select('id, title, content, created_by_name, updated_by_name, created_at, updated_at')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ document: data })
}

export async function DELETE(request, { params }) {
  const { id } = await params
  const { user, profile } = await getAuthedUser(request)
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })
  if (profile.role !== 'admin') return Response.json({ error: 'Admin account required' }, { status: 403 })

  const { error } = await supabaseAdmin.from('admin_documents').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
