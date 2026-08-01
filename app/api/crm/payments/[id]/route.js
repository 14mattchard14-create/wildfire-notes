import { getAuthedUser, supabaseAdmin } from '@/lib/auth-server'

export async function PATCH(request, { params }) {
  const { id } = await params
  const { user, profile } = await getAuthedUser(request)
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })
  if (profile.role !== 'employee') return Response.json({ error: 'Inspector account required' }, { status: 403 })

  const { status, method, notes } = await request.json()
  const update = {}
  if (status !== undefined) {
    if (!['pending', 'paid', 'refunded', 'failed'].includes(status)) return Response.json({ error: 'Invalid status' }, { status: 400 })
    update.status = status
    update.paid_at = status === 'paid' ? new Date().toISOString() : null
  }
  if (method !== undefined) update.method = method || null
  if (notes !== undefined) update.notes = notes?.trim() || null

  const { data, error } = await supabaseAdmin
    .from('crm_payments')
    .update(update)
    .eq('id', id)
    .select('id, property_id, amount_cents, currency, status, method, stripe_payment_intent_id, discount_code, discount_amount_cents, notes, paid_at, created_by_name, created_at')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ payment: data })
}

export async function DELETE(request, { params }) {
  const { id } = await params
  const { user, profile } = await getAuthedUser(request)
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })
  if (profile.role !== 'employee') return Response.json({ error: 'Inspector account required' }, { status: 403 })

  const { error } = await supabaseAdmin.from('crm_payments').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
