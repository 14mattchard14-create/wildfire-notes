'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

const STATUS_BORDER = {
  'Compliant':          'border-l-green-600',
  'Non-Compliant':      'border-l-red-600',
  'Needs Verification': 'border-l-blue-600',
  'Not Applicable':     'border-l-stone-600',
}

const STATUS_TEXT = {
  'Compliant':          'text-green-400',
  'Non-Compliant':      'text-red-400',
  'Needs Verification': 'text-blue-400',
  'Not Applicable':     'text-stone-400',
}

export default function EntriesList({ entries, onDeleted }) {
  const [expanded, setExpanded] = useState(null)

  async function deleteEntry(id) {
    if (!confirm('Delete this entry?')) return
    await supabase.from('entries').delete().eq('id', id)
    onDeleted()
  }

  if (!entries.length) {
    return <p className="text-stone-600 text-sm text-center py-8 italic">No entries logged yet.</p>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-[10px] font-mono text-stone-500 tracking-widest uppercase">Logged Entries</h2>
        <span className="text-[10px] font-mono text-stone-600">{entries.length}</span>
      </div>

      <div className="space-y-3">
        {entries.map(entry => (
          <div
            key={entry.id}
            className={`bg-stone-900 border border-stone-800 border-l-4 rounded-lg p-3 ${STATUS_BORDER[entry.status] ?? 'border-l-stone-700'}`}
          >
            {/* Top row */}
            <div className="flex justify-between items-start mb-1">
              <span className="text-[10px] font-mono text-orange-600 tracking-wide uppercase">{entry.zone}</span>
              <span className={`text-[10px] font-mono tracking-wide uppercase ${STATUS_TEXT[entry.status] ?? 'text-stone-400'}`}>
                {entry.status}
              </span>
            </div>

            {/* Category */}
            <p className="font-semibold text-sm mb-1">{entry.category}</p>

            {/* Distance */}
            {entry.distance && (
              <p className="text-[11px] font-mono text-stone-500 mb-1">{entry.distance}</p>
            )}

            {/* Note */}
            <p className="text-sm text-stone-200">{entry.note}</p>

            {/* Detail (expandable) */}
            {entry.detail && (
              <button
                onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                className="mt-1 text-[11px] font-mono text-orange-500 tracking-wide"
              >
                {expanded === entry.id ? '− Hide details' : '+ Show details'}
              </button>
            )}
            {expanded === entry.id && entry.detail && (
              <p className="mt-2 text-sm text-stone-400 border-t border-dashed border-stone-800 pt-2">
                {entry.detail}
              </p>
            )}

            {/* Photo */}
            {entry.photo_url && (
              <img
                src={entry.photo_url}
                alt="Entry photo"
                className="mt-3 rounded border border-stone-700 max-h-52 w-auto cursor-zoom-in"
                onClick={() => window.open(entry.photo_url, '_blank')}
              />
            )}

            {/* Actions */}
            <div className="mt-3 flex gap-4">
              <button
                onClick={() => deleteEntry(entry.id)}
                className="text-[10px] font-mono text-stone-600 tracking-wide uppercase hover:text-red-500"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
