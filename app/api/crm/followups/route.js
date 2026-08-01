import { getAuthedUser, supabaseAdmin } from '@/lib/auth-server'

// Reads/writes crm_followups — scheduled or completed customer touchpoints,
// the core data behind the CRM tab (see
// supabase/migrations/012_crm_followups.sql, extended in
// 014_crm_phase2.sql with `channel` and `template_id`). Emails send through
// /api/crm/send-followup; this route also handles manually logging a call
// or text (channel !== 'email', status created as 'done' directly — there's
// nothing to send, just a record of contact).

const SELECT = 'id, property_id, due_date, note, status, channel, template_id, sent_at, completed_at, created_by_name, created_at'

export async function GET(request) {
  const { user, profile } = await getAuthedUser(request)
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })
  if (profile.role !== 'employee') return Response.json({ error: 'Inspector account required' }, { status: 403 })

  const { data, error } = await supabaseAdmin
    .from('crm_followups')
    .select(`${SELECT}, properties(address, customer_email)`)
    .order('due_date', { ascending: true, nullsFirst: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ followups: data || [] })
}

export async function POST(request) {
  const { user, profile } = await getAuthedUser(request)
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })
  if (profile.role !== 'employee') return Response.json({ error: 'Inspector account required' }, { status: 403 })

  const { propertyId, dueDate, note, channel, status, completedAt } = await request.json()
  if (!propertyId) return Response.json({ error: 'propertyId is required' }, { status: 400 })
  if (channel && !['email', 'call', 'text', 'note'].includes(channel)) return Response.json({ error: 'Invalid channel' }, { status: 400 })
  if (status && !['pending', 'done'].includes(status)) return Response.json({ error: 'Invalid status' }, { status: 400 })

  const userName = user.user_metadata?.full_name || user.email || 'Unknown'
  const row = {
    property_id: propertyId,
    due_date: dueDate || null,
    note: note?.trim() || null,
    channel: channel || 'email',
    created_by: user.id,
    created_by_name: userName,
  }
  if (status === 'done') {
    row.status = 'done'
    // completedAt lets a logged call/text carry the time it actually
    // happened (the inspector may be logging it after the fact), rather
    // than always stamping "now".
    const parsed = completedAt ? new Date(completedAt) : new Date()
    row.completed_at = isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString()
  }

  const { data, error } = await supabaseAdmin
    .from('crm_followups')
    .insert(row)
    .select(SELECT)
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ followup: data })
}
