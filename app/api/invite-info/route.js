import { supabaseAdmin } from '@/lib/auth-server'

// Public lookup by token — the token itself (a 40-char random hex string)
// is the actual secret here, so revealing the target email/address to
// whoever holds a valid token is fine. Used by the redemption page to
// lock the email field and show which property the invite is for.

export async function GET(request) {
  const token = new URL(request.url).searchParams.get('token')
  if (!token) return Response.json({ error: 'token is required' }, { status: 400 })

  const { data: invite, error } = await supabaseAdmin
    .from('homeowner_invites')
    .select('email, used, expires_at, property_id')
    .eq('token', token)
    .maybeSingle()

  if (error || !invite) return Response.json({ valid: false, reason: 'Invalid invite link' })
  if (invite.used) return Response.json({ valid: false, reason: 'This invite has already been used' })
  if (new Date(invite.expires_at) < new Date()) return Response.json({ valid: false, reason: 'This invite has expired' })

  const { data: property } = await supabaseAdmin
    .from('properties')
    .select('address')
    .eq('id', invite.property_id)
    .maybeSingle()

  return Response.json({ valid: true, email: invite.email, propertyAddress: property?.address ?? null })
}
