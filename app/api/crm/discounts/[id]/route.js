import { getAuthedUser, supabaseAdmin } from '@/lib/auth-server'

export async function PATCH(request, { params }) {
  const { id } = await params
  const { user, profile } = await getAuthedUser(request)
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })
  if (profile.role !== 'employee') return Response.json({ error: 'Inspector account required' }, { status: 403 })

  const { label, kind, amount, active, expiresAt } = await request.json()
  const update = {}
  if (label !== undefined) update.label = label?.trim() || null
  if (kind !== undefined) {
    if (!['flat', 'percent'].includes(kind)) return Response.json({ error: 'kind must be flat or percent' }, { status: 400 })
    update.kind = kind
  }
  if (amount !== undefined) {
    const amountNum = Number(amount)
    if (!Number.isFinite(amountNum) || amountNum <= 0) return Response.json({ error: 'amount must be a positive number' }, { status: 400 })
    update.amount = amountNum
  }
  if (active !== undefined) update.active = !!active
  if (expiresAt !== undefined) update.expires_at = expiresAt || null

  const { data, error } = await supabaseAdmin
    .from('crm_discounts')
    .update(update)
    .eq('id', id)
    .select('id, code, label, kind, amount, active, expires_at, created_by_name, created_at')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ discount: data })
}

export async function DELETE(request, { params }) {
  const { id } = await params
  const { user, profile } = await getAuthedUser(request)
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })
  if (profile.role !== 'employee') return Response.json({ error: 'Inspector account required' }, { status: 403 })

  const { error } = await supabaseAdmin.from('crm_discounts').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
