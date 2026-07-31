import { getAuthedUser, supabaseAdmin } from '@/lib/auth-server'
import { sendEmail } from '@/lib/email'

// Employee-only: manually (re)send the "homeowner finished" notification
// for a property, without touching its homeowner_status. Useful when the
// automatic send at Finish-time failed (misconfigured email, bounce, etc.)
// and you don't want to reset the homeowner's submitted status just to
// get another email out.

export async function POST(request) {
  const { user, profile } = await getAuthedUser(request)
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })
  if (profile.role !== 'employee') return Response.json({ error: 'Inspector account required' }, { status: 403 })

  const { propertyId } = await request.json()
  if (!propertyId) return Response.json({ error: 'propertyId is required' }, { status: 400 })

  const { data: property, error } = await supabaseAdmin
    .from('properties')
    .select('id, address')
    .eq('id', propertyId)
    .maybeSingle()
  if (error || !property) return Response.json({ error: 'Property not found' }, { status: 404 })

  const notifyEmail = process.env.NOTIFY_EMAIL
  if (!notifyEmail) return Response.json({ error: 'NOTIFY_EMAIL is not configured' }, { status: 500 })

  const result = await sendEmail({
    to: notifyEmail,
    subject: `Homeowner finished their walkthrough — ${property.address}`,
    html: `
      <p>The homeowner at <strong>${property.address}</strong> has finished adding their photos and notes.</p>
      <p>Open Field Notes to review everything and generate the report.</p>
    `,
  })

  if (result?.error) return Response.json({ error: result.error }, { status: 502 })
  return Response.json({ ok: true })
}
