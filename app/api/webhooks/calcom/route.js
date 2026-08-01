import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/auth-server'

// Public, unauthenticated — Cal.com calls this directly, there's no user
// session. See BOOKING_PAYMENTS_PLAN.md for the full design and the exact
// Cal.com setup checklist (required custom questions, webhook config) this
// depends on. Every request is signature-verified against
// CAL_COM_WEBHOOK_SECRET; without that, this URL would let anyone forge
// fake bookings straight into the CRM.
//
// Only handles BOOKING_CREATED for now. Other events (cancelled,
// rescheduled) are accepted and ignored rather than erroring, since
// Cal.com may be configured to send more than we currently act on.

function verifySignature(rawBody, signature, secret) {
  if (!signature || !secret) return false
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  // timingSafeEqual requires equal-length buffers, so length-check first —
  // a plain !== comparison here would leak timing information.
  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

// Custom booking questions come back keyed by whatever identifier was set
// up in Cal.com, with a {label, value} shape. We look for the identifier
// documented in the setup checklist ("address") rather than guessing from
// the label, since labels are freeform text the label author could reword.
function extractResponse(responses, key) {
  const entry = responses?.[key]
  if (!entry) return null
  const value = entry.value
  if (typeof value === 'string') return value.trim() || null
  return null
}

export async function POST(request) {
  const secret = process.env.CAL_COM_WEBHOOK_SECRET
  const rawBody = await request.text()
  const signature = request.headers.get('x-cal-signature-256')

  if (!verifySignature(rawBody, signature, secret)) {
    return Response.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let event
  try {
    event = JSON.parse(rawBody)
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (event.triggerEvent !== 'BOOKING_CREATED') {
    // Acknowledge (2xx) so Cal.com doesn't retry — we just don't act on it.
    return Response.json({ ok: true, ignored: event.triggerEvent })
  }

  const payload = event.payload || {}
  const uid = payload.uid
  if (!uid) return Response.json({ error: 'Missing booking uid' }, { status: 400 })

  // Idempotent: Cal.com can retry a delivery, or this could be a
  // reschedule of a booking we've already seen.
  const { data: existing } = await supabaseAdmin
    .from('properties')
    .select('id')
    .eq('booking_event_uid', uid)
    .maybeSingle()
  if (existing) return Response.json({ ok: true, propertyId: existing.id, alreadyExists: true })

  const attendee = (payload.attendees || [])[0] || {}
  const address = extractResponse(payload.responses, 'address')
  const phone = extractResponse(payload.responses, 'attendeePhoneNumber') || attendee.phoneNumber || null

  if (!address) {
    // The setup checklist requires this as a required booking question, so
    // this shouldn't happen in practice — but fail loudly rather than
    // silently creating an address-less property if the question ever gets
    // made optional or renamed in Cal.com's dashboard.
    return Response.json({ error: 'Booking has no "address" response — check the Cal.com event type\'s required questions' }, { status: 422 })
  }

  const { data: property, error } = await supabaseAdmin
    .from('properties')
    .insert({
      address,
      customer_name: attendee.name || null,
      customer_email: attendee.email || null,
      customer_phone: phone,
      lead_source: 'cal.com',
      booking_status: 'call_scheduled',
      booking_event_uid: uid,
      intro_call_at: payload.startTime || null,
    })
    .select('id')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, propertyId: property.id })
}
