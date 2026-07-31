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
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
      loadProfile(session?.user ?? null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setProfileReady(false)
      loadProfile(session?.user ?? null)
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
