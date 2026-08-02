import { getAuthedUser, supabaseAdmin } from '@/lib/auth-server'
import { sendEmail, parseRecipients } from '@/lib/email'

export async function POST(request) {
  const { user, profile } = await getAuthedUser(request)
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })
  if (profile.role !== 'homeowner') return Response.json({ error: 'Homeowner account required' }, { status: 403 })
  if (!profile.property_id) return Response.json({ error: 'No property linked to this account' }, { status: 400 })

  const { data: property, error } = await supabaseAdmin
    .from('properties')
    .update({ homeowner_status: 'submitted', homeowner_submitted_at: new Date().toISOString() })
    .eq('id', profile.property_id)
    .select('id, address, created_by')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Notify the fixed business inbox rather than whichever individual
  // inspector's login created the property — matches Resend's sandbox
  // restriction (only delivers to the account's own verified address)
  // and avoids needing domain verification for this.
  const notifyEmail = parseRecipients(process.env.NOTIFY_EMAIL)
  if (notifyEmail) {
    await sendEmail({
      to: notifyEmail,
      subject: `Homeowner finished their walkthrough — ${property.address}`,
      html: `
        <p>The homeowner at <strong>${property.address}</strong> has finished adding their photos and notes.</p>
        <p>Open Field Notes to review everything and generate the report.</p>
      `,
    })
  } else {
    console.warn('[homeowner/finish] NOTIFY_EMAIL not set — skipping notification email')
  }

  return Response.json({ ok: true })
}
