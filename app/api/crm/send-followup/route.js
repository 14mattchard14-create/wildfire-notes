import { getAuthedUser, supabaseAdmin } from '@/lib/auth-server'
import { sendEmail } from '@/lib/email'

// Manual "Send" action on the CRM tab — sends a follow-up email to the
// customer on file for a property, using either a saved template
// (templateId, with {{address}}/{{name}} substituted) or a custom message,
// via the existing Resend pipeline. Deliberately manual (not rule-triggered)
// for now: automatic, scheduled sends are a later phase, once there's been
// a security review of running unattended sends with the service-role key
// (see NEXT_STEPS.md).
//
// Every send leaves a crm_followups history row — updates the linked one
// if followupId was passed, otherwise inserts a new "already done" row so
// ad-hoc sends still show up in that customer's history.

function fillTemplate(text, { address, name }) {
  return (text || '')
    .replace(/\{\{address\}\}/g, address || 'your property')
    .replace(/\{\{name\}\}/g, name || 'there')
}

export async function POST(request) {
  const { user, profile } = await getAuthedUser(request)
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })
  if (profile.role !== 'employee') return Response.json({ error: 'Inspector account required' }, { status: 403 })

  const { propertyId, followupId, templateId, message } = await request.json()
  if (!propertyId) return Response.json({ error: 'propertyId is required' }, { status: 400 })

  const { data: property } = await supabaseAdmin
    .from('properties')
    .select('id, address, customer_name, customer_email, unsubscribed, unsubscribe_token')
    .eq('id', propertyId)
    .maybeSingle()

  if (!property) return Response.json({ error: 'Property not found' }, { status: 404 })
  const customerEmail = property.customer_email?.trim()
  if (!customerEmail) return Response.json({ error: 'No customer email on file for this property — add one first' }, { status: 400 })
  if (property.unsubscribed) return Response.json({ error: 'This customer has unsubscribed from follow-up emails' }, { status: 400 })

  const tokens = { address: property.address, name: property.customer_name }
  let subject = `Following up — ${property.address}`
  let bodyText = message?.trim() || `Just checking in about your property at ${property.address}. Let us know if you have any questions or if it's time to schedule your next wildfire risk assessment.`

  if (templateId) {
    const { data: template } = await supabaseAdmin
      .from('crm_message_templates')
      .select('subject, body')
      .eq('id', templateId)
      .maybeSingle()
    if (template) {
      subject = fillTemplate(template.subject, tokens)
      bodyText = message?.trim() || fillTemplate(template.body, tokens)
    }
  }

  const origin = new URL(request.url).origin
  const unsubscribeUrl = `${origin}/api/crm/unsubscribe?token=${property.unsubscribe_token}`
  const html = `
    <p>${bodyText.replace(/\n/g, '<br>')}</p>
    <p style="color:#666;font-size:13px;">— Field Notes Wildfire Inspection</p>
    <p style="color:#999;font-size:11px;margin-top:24px;">
      Don't want to hear from us again? <a href="${unsubscribeUrl}" style="color:#999;">Unsubscribe</a>.
    </p>
  `

  const result = await sendEmail({ to: customerEmail, subject, html })

  if (result?.error) return Response.json({ error: 'Email send failed: ' + result.error }, { status: 500 })
  if (result?.skipped) return Response.json({ error: 'RESEND_API_KEY not set — email skipped' }, { status: 500 })

  const now = new Date().toISOString()
  if (followupId) {
    await supabaseAdmin
      .from('crm_followups')
      .update({ sent_at: now, status: 'done', completed_at: now, channel: 'email', template_id: templateId || null })
      .eq('id', followupId)
  } else {
    await supabaseAdmin
      .from('crm_followups')
      .insert({
        property_id: propertyId, note: bodyText, channel: 'email', status: 'done',
        sent_at: now, completed_at: now, template_id: templateId || null,
        created_by: user.id, created_by_name: user.user_metadata?.full_name || user.email || 'Unknown',
      })
  }

  return Response.json({ sent: true, to: customerEmail })
}
