'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,        setUser]        = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [role,        setRole]        = useState(null)        // 'employee' | 'homeowner' | null
  const [propertyId,  setPropertyId]  = useState(null)         // homeowner's fixed property, if any
  const [profileReady, setProfileReady] = useState(false)

  async function loadProfile(u) {
    if (!u) { setRole(null); setPropertyId(null); setProfileReady(true); return }
    const { data, error } = await supabase
      .from('profiles')
      .select('role, property_id')
      .eq('id', u.id)
      .maybeSingle()
    // Default to 'employee' if the profile row is missing (e.g. migration
    // hasn't been run yet) so existing accounts never get locked out.
    setRole(error || !data ? 'employee' : data.role)
    setPropertyId(data?.property_id ?? null)
    setProfileReady(true)
  }

  useEffect(() => {
    // Deliberately *not* also calling supabase.auth.getSession() here.
    // onAuthStateChange fires immediately on subscribe with the resolved
    // current session (event 'INITIAL_SESSION'), so it's already the
    // single source of truth — pairing it with a separate getSession()
    // call created two independent async reads of the same state that
    // could resolve in either order. When getSession() finished first
    // and happened to see a not-yet-hydrated session, it set user=null
    // and loading=false, which was enough for the "Inspector account
    // required" guard on every admin page to render before the second
    // (correct) update from onAuthStateChange arrived — intermittent,
    // more likely on Vercel than localhost since it's a timing race, not
    // a logic bug. One listener, one update per real change, no race.
    let sawFirstEvent = false
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setProfileReady(false)
      loadProfile(session?.user ?? null)
      if (!sawFirstEvent) {
        sawFirstEvent = true
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, role, propertyId, profileReady, isHomeowner: role === 'homeowner' }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
