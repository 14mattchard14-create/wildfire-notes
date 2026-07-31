import { randomBytes } from 'crypto'
import { getAuthedUser, supabaseAdmin } from '@/lib/auth-server'
import { notifyCustomerReportReady } from '@/lib/customerNotify'

function generateToken() { return randomBytes(16).toString('hex') }
function generateAccessCode() { return Math.floor(100000 + Math.random() * 900000).toString() }

// Publishes properties.report_draft_markdown to the public shared_reports
// table (same one that powers /report/[token]). First publish creates a
// new token/access code; subsequent publishes update the same row in
// place so the link the homeowner/client has stays valid.

export async function POST(request) {
  const { user, profile } = await getAuthedUser(request)
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })
  if (profile.role !== 'employee') return Response.json({ error: 'Inspector account required' }, { status: 403 })

  const { propertyId } = await request.json()
  if (!propertyId) return Response.json({ error: 'propertyId is required' }, { status: 400 })

  const { data: property } = await supabaseAdmin.from('properties').select('*').eq('id', propertyId).maybeSingle()
  if (!property) return Response.json({ error: 'Property not found' }, { status: 404 })
  if (!property.report_draft_markdown?.trim()) return Response.json({ error: 'No draft to publish — generate a report first' }, { status: 400 })

  const inspectorName = user.user_metadata?.full_name || user.email || 'Inspector'

  if (property.shared_report_token) {
    const { error } = await supabaseAdmin
      .from('shared_reports')
      .update({ report_markdown: property.report_draft_markdown })
      .eq('token', property.shared_report_token)
    if (error) return Response.json({ error: error.message }, { status: 500 })

    await supabaseAdmin.from('properties').update({ report_status: 'published' }).eq('id', propertyId)
    return Response.json({ token: property.shared_report_token, accessCode: null, updated: true })
  }

  const { data: entries } = await supabaseAdmin.from('entries').select('*').eq('property_id', propertyId)
  const token = generateToken()
  const accessCode = generateAccessCode()

  const { error } = await supabaseAdmin.from('shared_reports').insert({
    property_id: propertyId,
    token,
    access_code: accessCode,
    report_markdown: property.report_draft_markdown,
    inspector_name: inspectorName,
    property_address: property.address,
    visit_date: property.visit_date || null,
    entries_snapshot: entries || [],
  })
  if (error) return Response.json({ error: error.message }, { status: 500 })

  await supabaseAdmin
    .from('properties')
    .update({ report_status: 'published', shared_report_token: token })
    .eq('id', propertyId)

  // First publish only — republishing updates the same live link, so the
  // homeowner doesn't need a fresh email every time the report is edited.
  // Not fatal if this fails (e.g. no homeowner invited yet, or Resend not
  // configured) — the inspector can still send it manually afterward.
  let customerNotify = { sent: false, reason: 'not attempted' }
  try {
    const origin = new URL(request.url).origin
    customerNotify = await notifyCustomerReportReady({ propertyId, origin })
  } catch (err) {
    console.error('report-publish customer notify error:', err)
    customerNotify = { sent: false, reason: err.message }
  }

  return Response.json({ token, accessCode, updated: false, customerNotify })
}
