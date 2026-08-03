'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import PasswordInput from '@/components/PasswordInput'

// Draft v1 of account settings — profile info (read-only for now) and a
// change-password form. This is the sitewide "Settings" entry point
// pinned at the bottom of AdminSidebar for every admin page, not just
// /insights, even though the route still lives at /insights/settings.
// Candidates for a later round: editable display name, notification
// preferences, default report settings.

const input = {
  width: '100%', background: 'var(--surface)', border: '1px solid var(--line)',
  borderRadius: 4, color: 'var(--text)', fontSize: 14, padding: '9px 11px',
  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
}

const label = { display: 'block', fontSize: 10.5, fontFamily: 'monospace', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }

function ProfileSection({ user, role }) {
  const name = user?.user_metadata?.full_name || '—'
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 16, marginBottom: 20, maxWidth: 440 }}>
      <h2 style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', margin: '0 0 14px' }}>Profile</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <span style={label}>Name</span>
          <div style={{ fontSize: 14, color: 'var(--text)' }}>{name}</div>
        </div>
        <div>
          <span style={label}>Email</span>
          <div style={{ fontSize: 14, color: 'var(--text)' }}>{user?.email}</div>
        </div>
        <div>
          <span style={label}>Account Type</span>
          <div style={{ fontSize: 14, color: 'var(--text)', textTransform: 'capitalize' }}>{role || '—'}</div>
        </div>
      </div>
      <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '12px 0 0', lineHeight: 1.5 }}>
        Editing name/email isn't wired up yet — ask if you need that.
      </p>
    </div>
  )
}

function PasswordSection() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  async function save() {
    setError(null); setMessage(null)
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (password !== confirm) { setError("Passwords don't match."); return }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (error) { setError(error.message); return }
    setMessage('Password updated.')
    setPassword(''); setConfirm('')
  }

  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 16, maxWidth: 440 }}>
      <h2 style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>Change Password</h2>
      <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '0 0 14px', lineHeight: 1.5 }}>
        You're already signed in, so this updates your password directly — no email link needed. Use "Forgot password?" on the sign-in page instead if you're locked out.
      </p>
      <div style={{ marginBottom: 12 }}>
        <span style={label}>New Password</span>
        <PasswordInput style={input} value={password} onChange={e => setPassword(e.target.value)} />
      </div>
      <div style={{ marginBottom: 14 }}>
        <span style={label}>Confirm New Password</span>
        <PasswordInput style={input} value={confirm} onChange={e => setConfirm(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()} />
      </div>
      {error && <p style={{ fontSize: 12.5, color: 'var(--warn)', margin: '0 0 12px' }}>{error}</p>}
      {message && <p style={{ fontSize: 12.5, color: 'var(--ok)', margin: '0 0 12px' }}>{message}</p>}
      <button
        onClick={save}
        disabled={saving || !password || !confirm}
        style={{
          background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 4,
          fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
          padding: '10px 16px', cursor: 'pointer', opacity: (saving || !password || !confirm) ? 0.5 : 1,
        }}
      >
        {saving ? 'Saving…' : 'Update Password'}
      </button>
    </div>
  )
}

export default function AccountSettingsPage() {
  const { user, role } = useAuth()
  return (
    <div>
      <ProfileSection user={user} role={role} />
      <PasswordSection />
    </div>
  )
}
