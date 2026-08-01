import { getAuthedUser, supabaseAdmin } from '@/lib/auth-server'

// PATCH toggles a lesson's `applied` state — marking that it's been folded
// into the report-draft prompt (see components/LessonsLearned.js, used on
// the /quality page). DELETE removes a note outright (e.g. it was a
// duplicate or turned out not to be useful).

export async function PATCH(request, { params }) {
  const { id } = await params
  const { user, profile } = await getAuthedUser(request)
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })
  if (profile.role !== 'employee') return Response.json({ error: 'Inspector account required' }, { status: 403 })

  const { applied } = await request.json()
  const { data, error } = await supabaseAdmin
    .from('report_lessons')
    .update({ applied: !!applied, applied_at: applied ? new Date().toISOString() : null })
    .eq('id', id)
    .select('id, property_id, note, created_by_name, applied, applied_at, created_at')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ lesson: data })
}

export async function DELETE(request, { params }) {
  const { id } = await params
  const { user, profile } = await getAuthedUser(request)
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })
  if (profile.role !== 'employee') return Response.json({ error: 'Inspector account required' }, { status: 403 })

  const { error } = await supabaseAdmin.from('report_lessons').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
