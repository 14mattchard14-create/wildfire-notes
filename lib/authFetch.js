import { supabase } from '@/lib/supabase'

// fetch() wrapper for client components calling our own API routes that
// need to know who's asking (homeowner-safe endpoints, invite generation).
// Attaches the current session's access token as a Bearer header so the
// server can verify identity via supabase.auth.getUser(token).
export async function authFetch(url, options = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const headers = {
    ...(options.headers || {}),
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
  }
  return fetch(url, { ...options, headers })
}
