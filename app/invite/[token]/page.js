'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import ThemeToggle from '@/components/ThemeToggle'

export default function InviteRedeemPage() {
  const { token } = useParams()
  const router = useRouter()
  const [checking,  setChecking]  = useState(true)
  const [invite,    setInvite]    = useState(null) // { email, propertyAddress }
  const [inviteError, setInviteError] = useState(null)
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)

  useEffect(() => {
    fetch(`/api/invite-info?token=${encodeURIComponent(token)}`)
      .then(res => res.json())
      .then(data => {
        if (!data.valid) setInviteError(data.reason || 'This invite link is not valid')
        else setInvite({ email: data.email, propertyAddress: data.propertyAddress })
      })
      .catch(() => setInviteError('Could not check this invite link'))
      .finally(() => setChecking(false))
  }, [token])

  async function handleSubmit() {
    setError(null)
    if (!password) { setError('Password is required'); return }
    if (password !== confirm) { setError("Passwords don't match"); return }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }

    setLoading(true)
    try {
      const res = await fetch('/api/homeowner-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email: invite.email, password, fullName: fullName.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not create account')

      const { error: signInError } = await supabase.auth.signInWithPassword({ email: invite.email, password })
      if (signInError) throw signInError

      router.push('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <span style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--accent)', fontFamily: 'monospace', display: 'block', marginBottom: 4 }}>
              Field Notes · Wildfire Inspection
            </span>
            <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.02em', textTransform: 'uppercase', margin: 0, color: 'var(--text)' }}>
              Set Up Your Account
            </h1>
          </div>
          <ThemeToggle />
        </div>

        {checking && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Checking your invite…</p>
        )}

        {!checking && inviteError && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--warn)', borderRadius: 6, padding: 20 }}>
            <p style={{ fontSize: 14, color: 'var(--warn)', margin: 0 }}>{inviteError}</p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 10, marginBottom: 0 }}>Ask your inspector to send you a new invite link.</p>
          </div>
        )}

        {!checking && invite && (
          <>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 20 }}>
              {invite.propertyAddress
                ? <>Your inspector invited you to document <strong style={{ color: 'var(--text)' }}>{invite.propertyAddress}</strong>.</>
                : 'Your inspector invited you to document your property.'} Create a password to get started — you'll be able to add photos and notes about your home, no compliance jargon required.
            </p>

            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 6, padding: 20 }}>
              <div style={{ marginBottom: 14 }}>
                <Label>Your Name</Label>
                <Input type="text" placeholder="Full name" value={fullName} onChange={e => setFullName(e.target.value)} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <Label>Email</Label>
                <Input type="email" value={invite.email} disabled className="opacity-70" />
              </div>
              <div style={{ marginBottom: 14 }}>
                <Label>Password</Label>
                <Input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <Label>Confirm Password</Label>
                <Input type="password" placeholder="••••••••" value={confirm} onChange={e => setConfirm(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
              </div>

              {error && <p style={{ fontSize: 13, color: 'var(--warn)', margin: '0 0 12px' }}>{error}</p>}

              <Button onClick={handleSubmit} disabled={loading} className="w-full text-[13px] font-bold uppercase tracking-wide py-3 h-auto">
                {loading ? 'Creating account…' : 'Create Account'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
