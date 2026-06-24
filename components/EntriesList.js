'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

const c = {
  surface: '#242220',
  line:    '#3a352f',
  accent:  '#be5b1d',
  text:    '#ece6db',
  muted:   '#9a9285',
  ok:      '#6b8e63',
  warn:    '#b5483a',
  info:    '#7d8fa6',
}

const BORDER = {
  'Compliant':          c.ok,
  'Non-Compliant':      c.warn,
  'Needs Verification': c.info,
  'Not Applicable':     c.muted,
}

const STATUS_COLOR = {
  'Compliant':          c.ok,
  'Non-Compliant':      c.warn,
  'Needs Verification': c.info,
  'Not Applicable':     c.muted,
}

export default function EntriesList({ entries, onDeleted }) {
  const [expanded, setExpanded] = useState(null)

  async function deleteEntry(id) {
    if (!confirm('Delete this entry?')) return
    await supabase.from('entries').delete().eq('id', id)
    onDeleted()
  }

  if (!entries.length) {
    return <p style={{ color: c.muted, fontSize: 13, textAlign: 'center', padding: '32px 0', fontStyle: 'italic' }}>No entries logged yet.</p>
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 10.5, fontFamily: 'monospace', letterSpacing: '0.08em', textTransform: 'uppercase', color: c.muted }}>Logged Entries</span>
        <span style={{ fontSize: 10.5, fontFamily: 'monospace', color: c.muted }}>{entries.length}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {entries.map(entry => (
          <div key={entry.id} style={{
            background: c.surface,
            border: `1px solid ${c.line}`,
            borderLeft: `4px solid ${BORDER[entry.status] ?? c.muted}`,
            borderRadius: 4,
            padding: '12px 13px',
          }}>
            {/* Top row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 10.5, fontFamily: 'monospace', color: c.accent, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{entry.zone}</span>
              <span style={{ fontSize: 10.5, fontFamily: 'monospace', color: STATUS_COLOR[entry.status] ?? c.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{entry.status}</span>
            </div>

            {/* Category */}
            <p style={{ fontWeight: 600, fontSize: 15, margin: '0 0 4px', color: c.text }}>{entry.category}</p>

            {/* Distance */}
            {entry.distance && (
              <p style={{ fontSize: 11, fontFamily: 'monospace', color: c.muted, margin: '0 0 4px' }}>{entry.distance}</p>
            )}

            {/* Note */}
            <p style={{ fontSize: 14, color: c.text, margin: 0 }}>{entry.note}</p>

            {/* Detail toggle */}
            {entry.detail && (
              <button
                onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                style={{ marginTop: 6, fontSize: 11, fontFamily: 'monospace', color: c.accent, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
              >
                {expanded === entry.id ? '− Hide details' : '+ Show details'}
              </button>
            )}
            {expanded === entry.id && entry.detail && (
              <p style={{ marginTop: 8, fontSize: 13, color: c.muted, borderTop: `1px dashed ${c.line}`, paddingTop: 8 }}>{entry.detail}</p>
            )}

            {/* Photo - smaller thumbnail */}
            {entry.photo_url && (
              <img
                src={entry.photo_url}
                alt="Entry photo"
                onClick={() => window.open(entry.photo_url, '_blank')}
                style={{ marginTop: 10, borderRadius: 4, border: `1px solid ${c.line}`, height: 80, width: 'auto', cursor: 'zoom-in', display: 'block' }}
              />
            )}

            {/* Delete */}
            <button
              onClick={() => deleteEntry(entry.id)}
              style={{ marginTop: 10, fontSize: 10.5, fontFamily: 'monospace', color: c.muted, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em' }}
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
