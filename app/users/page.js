'use client'

import { useState, useEffect } from 'react'
import { authFetch } from '@/lib/authFetch'
import { useAuth } from '@/components/AuthProvider'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'

// Roles per PORTALS_AND_ROLES_PLAN.md. 'employee' is kept as a legacy
// option (existing accounts default to it) rather than hidden, so an
// admin can still see/select it while working through reassignment —
// it's not meant to be anyone's permanent end state going forward.
const ROLE_META = {
  admin:           { label: 'Admin',           color: 'var(--accent)' },
  partner:         { label: 'Partner',         color: 'var(--ok)' },
  field_inspector: { label: 'Field Inspector', color: '#a78bfa' },
  manager:         { label: 'Manager / Dev',   color: '#38bdf8' },
  homeowner:       { label: 'Homeowner',       color: 'var(--text-muted)' },
  employee:        { label: 'Employee (legacy)', color: 'var(--warn)' },
}
const ROLE_ORDER = ['admin', 'partner', 'field_inspector', 'manager', 'employee', 'homeowner']

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function UsersPage() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [savingId, setSavingId] = useState(null)

  async function load() {
    setLoading(true)
    try {
      const res = await authFetch('/api/admin/users')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not load users')
      setUsers(data.users || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function changeRole(id, role) {
    setSavingId(id)
    try {
      const res = await authFetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Update failed')
      setUsers(prev => prev.map(u => (u.id === id ? { ...u, role } : u)))
    } catch (err) {
      alert('Could not update role: ' + err.message)
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 20 }}>
        Every account and its current role. Existing accounts default to <strong>Employee (legacy)</strong> until
        reassigned here — nothing is auto-migrated. See the Documentation tab for the full portal/role plan.
      </p>

      {error && <p style={{ fontSize: 13, color: 'var(--warn)', marginBottom: 16 }}>{error}</p>}
      {loading && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading…</p>}

      {!loading && users.length > 0 && (
        <div style={{ border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 200px 100px 100px', gap: 8, padding: '8px 14px', background: 'var(--surface-2)', fontSize: 11, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
            <span>Account</span>
            <span>Role</span>
            <span>Assigned Properties</span>
            <span>Joined</span>
            <span>Last Sign-in</span>
          </div>
          {users.map(u => {
            const meta = ROLE_META[u.role] || ROLE_META.employee
            const isSelf = u.id === currentUser?.id
            return (
              <div key={u.id} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 200px 100px 100px', gap: 8, alignItems: 'center', padding: '10px 14px', borderTop: '1px solid var(--line)', background: 'var(--surface)' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {u.fullName || u.email}{isSelf && <span style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 500 }}> (you)</span>}
                  </div>
                  {u.fullName && <div style={{ fontSize: 11.5, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>}
                </div>

                <Select value={u.role} onValueChange={val => changeRole(u.id, val)} disabled={savingId === u.id}>
                  <SelectTrigger className="w-full" style={{ fontSize: 12, height: 30 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: meta.color, flexShrink: 0 }} />
                      <SelectValue />
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_ORDER.map(r => (
                      <SelectItem key={r} value={r}>{ROLE_META[r].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                  {u.assignedProperties.length === 0 ? '—' : u.assignedProperties.map(p => p.address).join(', ')}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{fmtDate(u.createdAt)}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{fmtDate(u.lastSignInAt)}</div>
              </div>
            )
          })}
        </div>
      )}

      {!loading && users.length === 0 && !error && (
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No accounts found.</p>
      )}
    </div>
  )
}
