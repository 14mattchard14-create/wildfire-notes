import { supabaseAdmin } from '@/lib/auth-server'
import { sendEmail } from '@/lib/email'

// Shared by /api/notify-customer-preview (review-before-send modal) and
// /api/notify-customer (the actual send, fired only after the inspector
// confirms in that modal) so both paths look up the customer's email and
// format the email identically — the preview is guaranteed to be exactly
// what goes out.
//
// The email comes from properties.customer_email first — set directly on
// the property, independent of whether a homeowner ever self-served
// through the invite flow (most inspections are done by the inspector in
// person with no homeowner account at all). Falls back to the most recent
// *used* homeowner invite for properties where that's the only email on
// file, so nothing already working breaks.

export async function buildCustomerNotifyPreview({ propertyId, origin }) {
  const { data: property } = await supabaseAdmin
    .from('properties')
    .select('id, address, visit_date, shared_report_token, customer_email')
    .eq('id', propertyId)
    .maybeSingle()

  if (!property) return { ok: false, reason: 'Property not found' }
  if (!property.shared_report_token) return { ok: false, reason: 'Report has not been published yet' }

  const { data: shared } = await supabaseAdmin
    .from('shared_reports')
    .select('token, access_code')
    .eq('token', property.shared_report_token)
    .maybeSingle()

  if (!shared) return { ok: false, reason: 'Published report record not found' }

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

  if (!customerEmail) return { ok: false, reason: 'No customer email on file for this property — add one on the property page first' }

  const reportUrl = `${origin || ''}/report/${shared.token}`
  const subject = `Your Wildfire Risk Assessment Report — ${property.address}`

  // Optional "schedule a review call" CTA — only appears once a real
  // Cal.com event is set up and CAL_COM_REVIEW_LINK is set in Vercel; the
  // section is simply omitted otherwise so nothing links out to a
  // nonexistent booking page.
  const reviewCallLink = process.env.CAL_COM_REVIEW_LINK?.trim() || null

  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #D6DDE3; border-radius: 12px; overflow: hidden;">
  <div style="background: #172431; padding: 26px 32px;">
    <div style="color: #C1502E; font-size: 11.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 8px;">🔥 Wildfire Risk Assessment</div>
    <div style="color: #ffffff; font-size: 20px; font-weight: 700; line-height: 1.3;">Your report is ready</div>
  </div>
  <div style="padding: 32px;">
    <p style="margin: 0 0 16px; font-size: 15px; color: #1A2632; line-height: 1.6;">Hi,</p>
    <p style="margin: 0 0 26px; font-size: 15px; color: #1A2632; line-height: 1.6;">
      Your wildfire risk assessment report for <strong>${property.address}</strong> is ready to view online.
    </p>
    <div style="text-align: center; margin: 0 0 26px;">
      <a href="${reportUrl}" style="display:inline-block;background:#C1502E;color:#ffffff;padding:14px 30px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">View Your Report</a>
    </div>
    <div style="background: #F3F6F8; border-radius: 8px; padding: 18px 20px; margin: 0 0 ${reviewCallLink ? 28 : 4}px; text-align: center;">
      <div style="font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #6B7A8D; margin-bottom: 8px;">Access Code</div>
      <div style="font-size: 26px; font-weight: 700; letter-spacing: 5px; color: #172431;">${shared.access_code}</div>
      <div style="font-size: 12px; color: #6B7A8D; margin-top: 8px; line-height: 1.5;">You'll need this the first time you open the report on a new device — it keeps your report private.</div>
    </div>
    ${reviewCallLink ? `
    <div style="border-top: 1px solid #D6DDE3; padding-top: 26px; text-align: center;">
      <p style="margin: 0 0 6px; font-size: 15px; font-weight: 700; color: #172431;">Want to walk through it together?</p>
      <p style="margin: 0 0 18px; font-size: 13.5px; color: #6B7A8D; line-height: 1.6;">
        Schedule a free 30-minute call to review your report together — we'll go through the findings, answer any questions you have, and discuss options for next steps if you'd like to move forward on any recommended work.
      </p>
      <a href="${reviewCallLink}" style="display:inline-block;background:#ffffff;color:#172431;border:1.5px solid #172431;padding:11px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13.5px;">Schedule a Review Call</a>
    </div>` : ''}
  </div>
</div>
  `.trim()

  return { ok: true, to: customerEmail, subject, html, reportUrl, accessCode: shared.access_code, address: property.address, reviewCallLink }
}

export async function notifyCustomerReportReady({ propertyId, origin }) {
  const preview = await buildCustomerNotifyPreview({ propertyId, origin })
  if (!preview.ok) return { sent: false, reason: preview.reason }

  const result = await sendEmail({ to: preview.to, subject: preview.subject, html: preview.html })

  if (result?.error) return { sent: false, reason: 'Email send failed: ' + result.error }
  if (result?.skipped) return { sent: false, reason: 'RESEND_API_KEY not set — email skipped' }

  await supabaseAdmin
    .from('properties')
    .update({ customer_notified_at: new Date().toISOString() })
    .eq('id', propertyId)

  return { sent: true, to: preview.to }
}
