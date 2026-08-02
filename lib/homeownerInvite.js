import { randomBytes } from 'crypto'
import { supabaseAdmin } from './auth-server'
import { sendEmail } from './email'

// Shared by the employee-facing /api/homeowner-invite route and the public
// /api/public/guided-request route (website self-serve signups). Both need
// the same token + DB-row + status-bump logic; only the public route also
// emails the link automatically, since an employee generating an invite
// from /manage still hands it off manually today (unchanged behavior).

export function generateInviteToken() {
  return randomBytes(20).toString('hex')
}

// Creates the invite row and bumps homeowner_status to 'invited' — but
// only if the property hasn't already progressed further (re-inviting
// shouldn't reset an in-progress or submitted walkthrough).
export async function createInviteRecord({ propertyId, email, createdBy }) {
  const token = generateInviteToken()
  const { error } = await supabaseAdmin.from('homeowner_invites').insert({
    token, property_id: propertyId, created_by: createdBy || null, email,
  })
  if (error) throw new Error(error.message)

  await supabaseAdmin
    .from('properties')
    .update({ homeowner_status: 'invited' })
    .eq('id', propertyId)
    .is('homeowner_status', null)

  return token
}

export function inviteLinkFor(origin, token) {
  return `${origin}/invite/${token}`
}

export async function sendInviteEmail({ to, address, inviteLink }) {
  const html = `
    <p>Hi,</p>
    <p>Thanks for requesting a Guided Photo Assessment${address ? ` for <strong>${address}</strong>` : ''} with Charred Guard.</p>
    <p>You'll complete this yourself, at your own pace, using your phone — no need to schedule a visit.</p>
    <p>
      <a href="${inviteLink}" style="display:inline-block;background:#BE5B1D;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:700;">Start Your Assessment</a>
    </p>
    <p style="color:#666;font-size:13px;">This link sets up your account (using this email address) and walks you through what to photograph, room by room.</p>
  `
  return sendEmail({
    to,
    subject: 'Your Guided Photo Assessment — start here',
    html,
  })
}
