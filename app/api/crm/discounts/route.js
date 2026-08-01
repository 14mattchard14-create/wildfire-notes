import { getAuthedUser, supabaseAdmin } from '@/lib/auth-server'

// Self-managed discount codes — see supabase/migrations/015_booking_payments.sql.
// Independent of any payment processor by design (see BOOKING_PAYMENTS_PLAN.md
// decision 4): works today with the manual payment ledger, stays useful even
// if Stripe gets added later.

export async function GET(request) {
  const { user, profile } = await getAuthedUser(request)
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })
  if (profile.role !== 'employee') return Response.json({ error: 'Inspector account required' }, { status: 403 })

  const { data, error } = await supabaseAdmin
    .from('crm_discounts')
    .select('id, code, label, kind, amount, active, expires_at, created_by_name, created_at')
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ discounts: data || [] })
}

export async function POST(request) {
  const { user, profile } = await getAuthedUser(request)
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })
  if (profile.role !== 'employee') return Response.json({ error: 'Inspector account required' }, { status: 403 })

  const { code, label, kind, amount, expiresAt } = await request.json()
  if (!code?.trim()) return Response.json({ error: 'code is required' }, { status: 400 })
  if (!['flat', 'percent'].includes(kind)) return Response.json({ error: 'kind must be flat or percent' }, { status: 400 })
  const amountNum = Number(amount)
  if (!Number.isFinite(amountNum) || amountNum <= 0) return Response.json({ error: 'amount must be a positive number' }, { status: 400 })
  if (kind === 'percent' && amountNum > 100) return Response.json({ error: 'percent amount cannot exceed 100' }, { status: 400 })

  const userName = user.user_metadata?.full_name || user.email || 'Unknown'
  const { data, error } = await supabaseAdmin
    .from('crm_discounts')
    .insert({
      code: code.trim().toUpperCase(), label: label?.trim() || null, kind, amount: amountNum,
      expires_at: expiresAt || null, created_by_name: userName,
    })
    .select('id, code, label, kind, amount, active, expires_at, created_by_name, created_at')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ discount: data })
}
