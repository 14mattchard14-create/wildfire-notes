'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function PropertySelector({ selected, onSelect }) {
  const [properties, setProperties] = useState([])
  const [creating,   setCreating]   = useState(false)
  const [address,    setAddress]    = useState('')
  const [visitDate,  setVisitDate]  = useState('')
  const [loading,    setLoading]    = useState(false)

  useEffect(() => {
    supabase
      .from('properties')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => setProperties(data ?? []))
  }, [])

  async function createProperty() {
    if (!address.trim()) return
    setLoading(true)
    const { data, error } = await supabase
      .from('properties')
      .insert({ address: address.trim(), visit_date: visitDate || null })
      .select()
      .single()
    setLoading(false)
    if (error) { alert('Could not create property: ' + error.message); return }
    setProperties(prev => [data, ...prev])
    onSelect(data)
    setCreating(false)
    setAddress('')
    setVisitDate('')
  }

  if (creating) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            className="flex-1 bg-stone-900 border border-stone-700 rounded px-3 py-2 text-sm text-stone-100 placeholder-stone-500"
            placeholder="Property address"
            value={address}
            onChange={e => setAddress(e.target.value)}
            autoFocus
          />
          <input
            type="date"
            className="bg-stone-900 border border-stone-700 rounded px-3 py-2 text-sm text-stone-100 w-36"
            value={visitDate}
            onChange={e => setVisitDate(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={createProperty}
            disabled={loading}
            className="flex-1 bg-orange-700 text-stone-950 font-bold text-sm py-2 rounded uppercase tracking-wide disabled:opacity-50"
          >
            {loading ? 'Saving…' : 'Create'}
          </button>
          <button
            onClick={() => setCreating(false)}
            className="px-4 bg-stone-800 text-stone-400 text-sm rounded"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-2">
      <select
        className="flex-1 bg-stone-900 border border-stone-700 rounded px-3 py-2 text-sm text-stone-100"
        value={selected?.id ?? ''}
        onChange={e => {
          const prop = properties.find(p => p.id === e.target.value)
          onSelect(prop ?? null)
        }}
      >
        <option value="">— Select a property —</option>
        {properties.map(p => (
          <option key={p.id} value={p.id}>
            {p.address}{p.visit_date ? ` (${p.visit_date})` : ''}
          </option>
        ))}
      </select>
      <button
        onClick={() => setCreating(true)}
        className="px-3 bg-stone-800 border border-stone-700 text-orange-500 text-lg rounded"
        title="New property"
      >
        +
      </button>
    </div>
  )
}
