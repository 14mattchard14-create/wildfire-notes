'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

const c = {
  bg:      '#1b1917',
  surface: '#242220',
  line:    '#3a352f',
  accent:  '#be5b1d',
  text:    '#ece6db',
  muted:   '#9a9285',
  ok:      '#6b8e63',
}

const input = {
  width: '100%', background: c.surface, border: `1px solid ${c.line}`,
  borderRadius: 4, color: c.text, fontSize: 15, padding: '10px 12px',
  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
}

export default function LoginPage() {
  const [mode,     setMode]     = useState('password') // 'password' | 'magic' | 'reset'
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [name,     setName]     = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [message,  setMessage]  = useState(null)
  const [error,    setError]    = useState(null)

  async function handleSubmit() {
    setLoading(true)
    setError(null)
    setMessage(null)

    if (mode === 'magic') {
      const { error } = await supabase.auth.signInWithOtp({ email })
      if (error) setError(error.message)
      else setMessage('Check your email for a login link.')
      setLoading(false)
      return
    }

    if (mode === 'reset') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) setError(error.message)
      else setMessage('Password reset email sent — check your inbox.')
      setLoading(false)
      return
    }

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: name } }
      })
      if (error) setError(error.message)
      else setMessage('Account created! Check your email to confirm.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    }
    setLoading(false)
  }

  const title = mode === 'reset' ? 'Reset Password' : isSignUp ? 'Create Account' : 'Sign In'

  return (
    <div style={{ minHeight: '100vh', background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <span style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: c.accent, fontFamily: 'monospace', display: 'block', marginBottom: 4 }}>
            Field Notes · Wildfire Inspection
          </span>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.02em', textTransform: 'uppercase', margin: 0, color: c.text }}>
            {title}
          </h1>
        </div>

        {/* Mode toggle — only show when not in reset mode */}
        {mode !== 'reset' && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
            {['password', 'magic'].map(m => (
              <button key={m} onClick={() => setMode(m)} style={{
                flex: 1, padding: '8px', border: `1px solid ${mode === m ? c.accent : c.line}`,
                borderRadius: 4, background: 'transparent', color: mode === m ? c.accent : c.muted,
                fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.06em',
                textTransform: 'uppercase', cursor: 'pointer',
              }}>
                {m === 'password' ? 'Password' : 'Magic Link'}
              </button>
            ))}
          </div>
        )}

        <div style={{ background: c.surface, border: `1px solid ${c.line}`, borderRadius: 6, padding: 20 }}>
          {/* Name field for signup */}
          {mode === 'password' && isSignUp && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 10.5, fontFamily: 'monospace', letterSpacing: '0.08em', textTransform: 'uppercase', color: c.muted, marginBottom: 6 }}>Full Name</label>
              <input style={input} type="text" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} />
            </div>
          )}

          {/* Email */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 10.5, fontFamily: 'monospace', letterSpacing: '0.08em', textTransform: 'uppercase', color: c.muted, marginBottom: 6 }}>Email</label>
            <input style={input} type="email" placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>

          {/* Password */}
          {mode === 'password' && mode !== 'reset' && (
            <div style={{ marginBottom: 8 }}>
              <label style={{ display: 'block', fontSize: 10.5, fontFamily: 'monospace', letterSpacing: '0.08em', textTransform: 'uppercase', color: c.muted, marginBottom: 6 }}>Password</label>
              <input style={input} type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
              {/* Forgot password link */}
              {!isSignUp && (
                <button onClick={() => { setMode('reset'); setError(null); setMessage(null) }} style={{
                  background: 'none', border: 'none', color: c.muted, fontSize: 11,
                  fontFamily: 'monospace', cursor: 'pointer', padding: '6px 0', textAlign: 'right', width: '100%',
                }}>
                  Forgot password?
                </button>
              )}
            </div>
          )}

          {/* Error / success */}
          {error   && <p style={{ fontSize: 13, color: '#b5483a', margin: '0 0 12px' }}>{error}</p>}
          {message && <p style={{ fontSize: 13, color: c.ok,      margin: '0 0 12px' }}>{message}</p>}

          {/* Submit */}
          <button onClick={handleSubmit} disabled={loading} style={{
            width: '100%', background: c.accent, color: '#1b1917', border: 'none',
            borderRadius: 4, fontSize: 13, fontWeight: 700, letterSpacing: '0.04em',
            textTransform: 'uppercase', padding: 13, cursor: 'pointer', opacity: loading ? 0.5 : 1, marginTop: 8,
          }}>
            {loading ? 'Please wait…' : mode === 'reset' ? 'Send Reset Email' : mode === 'magic' ? 'Send Magic Link' : isSignUp ? 'Create Account' : 'Sign In'}
          </button>

          {/* Back / toggle links */}
          {mode === 'reset' ? (
            <button onClick={() => { setMode('password'); setError(null); setMessage(null) }} style={{
              width: '100%', background: 'transparent', border: 'none', color: c.muted,
              fontSize: 12, fontFamily: 'monospace', marginTop: 12, cursor: 'pointer', textAlign: 'center',
            }}>
              ← Back to sign in
            </button>
          ) : mode === 'password' && (
            <button onClick={() => { setIsSignUp(s => !s); setError(null); setMessage(null) }} style={{
              width: '100%', background: 'transparent', border: 'none', color: c.muted,
              fontSize: 12, fontFamily: 'monospace', marginTop: 12, cursor: 'pointer', textAlign: 'center',
            }}>
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
