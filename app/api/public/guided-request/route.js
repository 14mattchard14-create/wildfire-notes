import { supabaseAdmin } from '@/lib/auth-server'
import { createInviteRecord, inviteLinkFor, sendInviteEmail } from '@/lib/homeownerInvite'

// Public, unauthenticated — the marketing site (charred-guard-site) calls
// this server-side (never from the browser) when a customer requests a
// Guided Photo Assessment. Unlike On-Site Inspection, this path needs no
// scheduling: it creates/updates the property, generates a homeowner
// invite, and emails the customer a link to start their own walkthrough.
//
// Protected by a shared secret (WEBSITE_API_SECRET, matching env var on
// both projects) rather than the Cal.com webhook's HMAC signature — this
// is our own site calling our own backend with a fixed payload shape, not
// a third party forwarding arbitrary webhook bodies, so a shared secret
// header is sufficient and matches the pattern used for CRON_SECRET.

export async function POST(request) {
  const secret = process.env.WEBSITE_API_SECRET
  if (!secret) return Response.json({ error: 'WEBSITE_API_SECRET is not configured' }, { status: 500 })
  const provided = request.headers.get('x-website-secret')
  if (provided !== secret) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body) return Response.json({ error: 'Invalid JSON' }, { status: 400 })

  const address = (body.address || '').trim()
  const email = (body.email || '').trim().toLowerCase()
  const name = (body.name || '').trim() || null
  const phone = (body.phone || '').trim() || null
  const leadNotes = (body.leadNotes || '').trim() || null

  if (!address) return Response.json({ error: 'address is required' }, { status: 400 })
  if (!email || !email.includes('@')) return Response.json({ error: 'A valid email is required' }, { status: 400 })

  // Match to an existing lead (e.g. they already did the intro call)
  // rather than creating a duplicate — same pattern as the inspection
  // booking webhook.
  const { data: matched } = await supabaseAdmin
    .from('properties')
    .select('id, address, customer_phone, lead_notes')
    .ilike('customer_email', email)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let propertyId
  if (matched) {
    propertyId = matched.id
    const updates = {}
    if (!matched.address && address) updates.address = address
    if (!matched.customer_phone && phone) updates.customer_phone = phone
    if (!matched.lead_notes && leadNotes) updates.lead_notes = leadNotes
    if (Object.keys(updates).length) {
      await supabaseAdmin.from('properties').update(updates).eq('id', propertyId)
    }
  } else {
    const { data: created, error } = await supabaseAdmin
      .from('properties')
      .insert({
        address,
        customer_name: name,
        customer_email: email,
        customer_phone: phone,
        lead_notes: leadNotes,
        lead_source: 'website-guided',
      })
      .select('id')
      .single()
    if (error) return Response.json({ error: error.message }, { status: 500 })
    propertyId = created.id
  }

  // Reuse an existing unused, unexpired invite for this property+email if
  // one's already outstanding, rather than minting (and emailing) a new
  // one on every accidental double-submit.
  const { data: existingInvite } = await supabaseAdmin
    .from('homeowner_invites')
    .select('token, expires_at, used')
    .eq('property_id', propertyId)
    .eq('email', email)
    .eq('used', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const origin = new URL(request.url).origin
  let token
  if (existingInvite && new Date(existingInvite.expires_at) > new Date()) {
    token = existingInvite.token
  } else {
    try {
      token = await createInviteRecord({ propertyId, email })
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500 })
    }
  }

  const inviteLink = inviteLinkFor(origin, token)
  const emailResult = await sendInviteEmail({ to: email, address, inviteLink })

  return Response.json({
    ok: true,
    propertyId,
    inviteLink,
    emailSent: !emailResult?.error && !emailResult?.skipped,
  })
}
