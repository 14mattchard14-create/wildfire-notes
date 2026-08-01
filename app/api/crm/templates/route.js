import { getAuthedUser, supabaseAdmin } from '@/lib/auth-server'

// Reusable follow-up email templates for the CRM's Send flow — see
// supabase/migrations/014_crm_phase2.sql (seeded with a starting set).
// {{address}} and {{name}} are substituted client-side when a template is
// picked, so what the inspector sees before sending is exactly what goes
// out.

export async function GET(request) {
  const { user, profile } = await getAuthedUser(request)
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })
  if (profile.role !== 'employee') return Response.json({ error: 'Inspector account required' }, { status: 403 })

  const { data, error } = await supabaseAdmin
    .from('crm_message_templates')
    .select('id, name, subject, body, created_by_name, created_at')
    .order('created_at', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ templates: data || [] })
}

export async function POST(request) {
  const { user, profile } = await getAuthedUser(request)
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })
  if (profile.role !== 'employee') return Response.json({ error: 'Inspector account required' }, { status: 403 })

  const { name, subject, body } = await request.json()
  if (!name?.trim() || !subject?.trim() || !body?.trim()) return Response.json({ error: 'name, subject, and body are required' }, { status: 400 })

  const userName = user.user_metadata?.full_name || user.email || 'Unknown'
  const { data, error } = await supabaseAdmin
    .from('crm_message_templates')
    .insert({ name: name.trim(), subject: subject.trim(), body: body.trim(), created_by_name: userName })
    .select('id, name, subject, body, created_by_name, created_at')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ template: data })
}
