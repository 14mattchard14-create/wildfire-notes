import { getAuthedUser, supabaseAdmin } from '@/lib/auth-server'

// Manual payment ledger — see supabase/migrations/015_booking_payments.sql
// and BOOKING_PAYMENTS_PLAN.md decision 3. No processor integration yet;
// amount/status/method/discount are filled in by the inspector. The
// stripe_payment_intent_id column exists for when that's added later.

const SELECT = 'id, property_id, amount_cents, currency, status, method, stripe_payment_intent_id, discount_code, discount_amount_cents, notes, paid_at, created_by_name, created_at'

export async function GET(request) {
  const { user, profile } = await getAuthedUser(request)
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })
  if (profile.role !== 'employee') return Response.json({ error: 'Inspector account required' }, { status: 403 })

  const { data, error } = await supabaseAdmin
    .from('crm_payments')
    .select(`${SELECT}, properties(address)`)
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ payments: data || [] })
}

export async function POST(request) {
  const { user, profile } = await getAuthedUser(request)
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })
  if (profile.role !== 'employee') return Response.json({ error: 'Inspector account required' }, { status: 403 })

  const { propertyId, amountCents, method, status, discountCode, notes } = await request.json()
  if (!propertyId) return Response.json({ error: 'propertyId is required' }, { status: 400 })
  const amountNum = Number(amountCents)
  if (!Number.isFinite(amountNum) || amountNum < 0) return Response.json({ error: 'amountCents must be a non-negative number' }, { status: 400 })
  if (method && !['stripe', 'cash', 'check', 'venmo', 'other'].includes(method)) return Response.json({ error: 'Invalid method' }, { status: 400 })
  const finalStatus = status && ['pending', 'paid', 'refunded', 'failed'].includes(status) ? status : 'pending'

  let discountAmountCents = 0
  let normalizedCode = null
  if (discountCode?.trim()) {
    normalizedCode = discountCode.trim().toUpperCase()
    const { data: discount } = await supabaseAdmin
      .from('crm_discounts')
      .select('code, kind, amount, active, expires_at')
      .eq('code', normalizedCode)
      .maybeSingle()
    if (!discount) return Response.json({ error: `No discount code "${normalizedCode}" found` }, { status: 400 })
    if (!discount.active) return Response.json({ error: `Discount code "${normalizedCode}" is not active` }, { status: 400 })
    if (discount.expires_at && new Date(discount.expires_at) < new Date()) return Response.json({ error: `Discount code "${normalizedCode}" has expired` }, { status: 400 })
    discountAmountCents = discount.kind === 'percent'
      ? Math.round(amountNum * (discount.amount / 100))
      : Math.round(discount.amount * 100)
    discountAmountCents = Math.min(discountAmountCents, amountNum)
  }

  const userName = user.user_metadata?.full_name || user.email || 'Unknown'
  const row = {
    property_id: propertyId, amount_cents: amountNum, method: method || null, status: finalStatus,
    discount_code: normalizedCode, discount_amount_cents: discountAmountCents, notes: notes?.trim() || null,
    created_by: user.id, created_by_name: userName,
  }
  if (finalStatus === 'paid') row.paid_at = new Date().toISOString()

  const { data, error } = await supabaseAdmin.from('crm_payments').insert(row).select(SELECT).single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ payment: data })
}
