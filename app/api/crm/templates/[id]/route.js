import { getAuthedUser, supabaseAdmin } from '@/lib/auth-server'

export async function PATCH(request, { params }) {
  const { id } = await params
  const { user, profile } = await getAuthedUser(request)
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })
  if (profile.role !== 'employee') return Response.json({ error: 'Inspector account required' }, { status: 403 })

  const { name, subject, body } = await request.json()
  const update = {}
  if (name !== undefined) update.name = name.trim()
  if (subject !== undefined) update.subject = subject.trim()
  if (body !== undefined) update.body = body.trim()

  const { data, error } = await supabaseAdmin
    .from('crm_message_templates')
    .update(update)
    .eq('id', id)
    .select('id, name, subject, body, created_by_name, created_at')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ template: data })
}

export async function DELETE(request, { params }) {
  const { id } = await params
  const { user, profile } = await getAuthedUser(request)
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })
  if (profile.role !== 'employee') return Response.json({ error: 'Inspector account required' }, { status: 403 })

  const { error } = await supabaseAdmin.from('crm_message_templates').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
