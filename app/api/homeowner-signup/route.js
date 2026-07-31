import { supabaseAdmin } from '@/lib/auth-server'

export async function POST(request) {
  try {
    const { token, email, password, fullName } = await request.json()
    if (!token || !email || !password) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (password.length < 6) {
      return Response.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    const { data: invite, error: inviteError } = await supabaseAdmin
      .from('homeowner_invites')
      .select('*')
      .eq('token', token)
      .maybeSingle()

    if (inviteError || !invite) return Response.json({ error: 'Invalid invite link' }, { status: 404 })
    if (invite.used) return Response.json({ error: 'This invite has already been used' }, { status: 410 })
    if (new Date(invite.expires_at) < new Date()) return Response.json({ error: 'This invite has expired' }, { status: 410 })

    // Defense in depth — the redemption page locks the email field to
    // invite.email, but this route can be called directly, so re-check
    // server-side that whoever's signing up is using the email this
    // invite was actually generated for.
    if (invite.email && invite.email.trim().toLowerCase() !== email.trim().toLowerCase()) {
      return Response.json({ error: 'This invite was sent to a different email address' }, { status: 403 })
    }

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { full_name: fullName || null },
    })
    if (createError) return Response.json({ error: createError.message }, { status: 400 })

    const userId = created.user.id

    // Overwrite the default 'employee' profile row the signup trigger just
    // created — this is the only place a profile is ever assigned
    // 'homeowner' + a property_id, and it only runs after validating the
    // invite token above.
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({ id: userId, role: 'homeowner', property_id: invite.property_id }, { onConflict: 'id' })
    if (profileError) return Response.json({ error: profileError.message }, { status: 500 })

    await supabaseAdmin
      .from('homeowner_invites')
      .update({ used: true, used_by: userId })
      .eq('id', invite.id)

    return Response.json({ ok: true })
  } catch (err) {
    console.error('homeowner-signup error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
