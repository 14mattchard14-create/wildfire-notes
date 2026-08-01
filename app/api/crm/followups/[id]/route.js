import { getAuthedUser, supabaseAdmin } from '@/lib/auth-server'

// PATCH updates a follow-up's status (pending/done/skipped) and/or
// reschedules it (due_date, note). DELETE removes it outright.

export async function PATCH(request, { params }) {
  const { id } = await params
  const { user, profile } = await getAuthedUser(request)
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })
  if (profile.role !== 'employee') return Response.json({ error: 'Inspector account required' }, { status: 403 })

  const { status, dueDate, note } = await request.json()
  const update = {}
  if (status !== undefined) {
    if (!['pending', 'done', 'skipped'].includes(status)) return Response.json({ error: 'Invalid status' }, { status: 400 })
    update.status = status
    update.completed_at = status === 'pending' ? null : new Date().toISOString()
  }
  if (dueDate !== undefined) update.due_date = dueDate || null
  if (note !== undefined) update.note = note?.trim() || null

  const { data, error } = await supabaseAdmin
    .from('crm_followups')
    .update(update)
    .eq('id', id)
    .select('id, property_id, due_date, note, status, channel, template_id, sent_at, completed_at, created_by_name, created_at')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ followup: data })
}

export async function DELETE(request, { params }) {
  const { id } = await params
  const { user, profile } = await getAuthedUser(request)
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })
  if (profile.role !== 'employee') return Response.json({ error: 'Inspector account required' }, { status: 403 })

  const { error } = await supabaseAdmin.from('crm_followups').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
