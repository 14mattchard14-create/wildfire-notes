import { createClient } from '@supabase/supabase-js'

// Service-role client for server-only routes. Never import this from
// client components — it bypasses RLS entirely.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// Verifies the bearer token on an incoming request and returns the
// authenticated user plus their profiles row (role, property_id).
// This is the ONLY place role/property_id should be trusted from —
// never trust a role or property_id sent in a request body.
export async function getAuthedUser(request) {
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) {
    console.warn('[getAuthedUser] no Authorization header on request')
    return { user: null, profile: null }
  }

  // Verify the token via a direct HTTP call rather than the SDK's
  // auth.getUser(token) — sidesteps SDK-internal session-state handling
  // that can throw "Auth session missing!" even with an explicit token.
  let user = null
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      },
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.warn('[getAuthedUser] token verification failed:', res.status, body)
      return { user: null, profile: null }
    }
    user = await res.json()
  } catch (err) {
    console.warn('[getAuthedUser] token verification request failed:', err.message)
    return { user: null, profile: null }
  }

  if (!user?.id) {
    console.warn('[getAuthedUser] no user id in verification response')
    return { user: null, profile: null }
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role, property_id')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) console.warn('[getAuthedUser] profile lookup error:', profileError.message)
  if (!profile) console.warn('[getAuthedUser] no profile row found for user', user.id, '- defaulting to employee. Did you run the migration?')

  return { user, profile: profile ?? { role: 'employee', property_id: null } }
}
