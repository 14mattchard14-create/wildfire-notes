'use client'

import { useState, useEffect } from 'react'
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

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [loading,  setLoading]  = useState(false)
  const [message,  setMessage]  = useState(null)
  const [error,    setError]    = useState(null)

  async function handleReset() {
    if (password !== confirm) { setError("Passwords don't match"); return }
    if (password.length < 6)  { setError("Password must be at least 6 characters"); return }
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) setError(error.message)
    else setMessage('Password updated! You can now sign in.')
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ marginBottom: 32 }}>
          <span style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: c.accent, fontFamily: 'monospace', display: 'block', marginBottom: 4 }}>
            Field Notes · Wildfire Inspection
          </span>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.02em', textTransform: 'uppercase', margin: 0, color: c.text }}>
            Set New Password
          </h1>
        </div>

        <div style={{ background: c.surface, border: `1px solid ${c.line}`, borderRadius: 6, padding: 20 }}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 10.5, fontFamily: 'monospace', letterSpacing: '0.08em', textTransform: 'uppercase', color: c.muted, marginBottom: 6 }}>New Password</label>
            <input style={input} type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 10.5, fontFamily: 'monospace', letterSpacing: '0.08em', textTransform: 'uppercase', color: c.muted, marginBottom: 6 }}>Confirm Password</label>
            <input style={input} type="password" placeholder="••••••••" value={confirm} onChange={e => setConfirm(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleReset()} />
          </div>

          {error   && <p style={{ fontSize: 13, color: '#b5483a', marginBottom: 12 }}>{error}</p>}
          {message && <p style={{ fontSize: 13, color: c.ok,      marginBottom: 12 }}>{message}</p>}

          <button onClick={handleReset} disabled={loading} style={{
            width: '100%', background: c.accent, color: '#1b1917', border: 'none',
            borderRadius: 4, fontSize: 13, fontWeight: 700, letterSpacing: '0.04em',
            textTransform: 'uppercase', padding: 13, cursor: 'pointer', opacity: loading ? 0.5 : 1,
          }}>
            {loading ? 'Updating…' : 'Update Password'}
          </button>
        </div>
      </div>
    </div>
  )
}
