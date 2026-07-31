import { supabaseAdmin } from '@/lib/auth-server'
import { sendEmail } from '@/lib/email'

// Shared by /api/report-publish (auto-send on first publish) and
// /api/notify-customer (manual resend button) so both paths look up the
// customer's email and format the email identically.
//
// The email comes from properties.customer_email first — set directly on
// the property, independent of whether a homeowner ever self-served
// through the invite flow (most inspections are done by the inspector in
// person with no homeowner account at all). Falls back to the most recent
// *used* homeowner invite for properties where that's the only email on
// file, so nothing already working breaks.

export async function notifyCustomerReportReady({ propertyId, origin }) {
  const { data: property } = await supabaseAdmin
    .from('properties')
    .select('id, address, visit_date, shared_report_token, customer_email')
    .eq('id', propertyId)
    .maybeSingle()

  if (!property) return { sent: false, reason: 'Property not found' }
  if (!property.shared_report_token) return { sent: false, reason: 'Report has not been published yet' }

  const { data: shared } = await supabaseAdmin
    .from('shared_reports')
    .select('token, access_code')
    .eq('token', property.shared_report_token)
    .maybeSingle()

  if (!shared) return { sent: false, reason: 'Published report record not found' }

  let customerEmail = property.customer_email?.trim() || null
  if (!customerEmail) {
    const { data: invite } = await supabaseAdmin
      .from('homeowner_invites')
      .select('email')
      .eq('property_id', propertyId)
      .eq('used', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    customerEmail = invite?.email || null
  }

  if (!customerEmail) return { sent: false, reason: 'No customer email on file for this property — add one on the property page first' }

  const reportUrl = `${origin || ''}/report/${shared.token}`

  const html = `
    <p>Hi,</p>
    <p>Your wildfire risk assessment report for <strong>${property.address}</strong> is ready to view.</p>
    <p>
      <a href="${reportUrl}" style="display:inline-block;background:#BE5B1D;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:700;">View Your Report</a>
    </p>
    <p>Access code: <strong style="font-size:18px;letter-spacing:2px;">${shared.access_code}</strong></p>
    <p style="color:#666;font-size:13px;">You'll need this code the first time you open the report on a new device — it keeps your report private.</p>
  `

  const result = await sendEmail({
    to: customerEmail,
    subject: `Your Wildfire Risk Assessment Report — ${property.address}`,
    html,
  })

  if (result?.error) return { sent: false, reason: 'Email send failed: ' + result.error }
  if (result?.skipped) return { sent: false, reason: 'RESEND_API_KEY not set — email skipped' }

  await supabaseAdmin
    .from('properties')
    .update({ customer_notified_at: new Date().toISOString() })
    .eq('id', propertyId)

  return { sent: true, to: customerEmail }
}
