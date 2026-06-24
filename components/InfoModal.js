'use client'

import { CRITERIA_INFO } from '@/lib/criteria'

export default function InfoModal({ category, onClose }) {
  if (!category) return null
  const info = CRITERIA_INFO[category]
  if (!info) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center"
      onClick={onClose}
    >
      <div
        className="bg-stone-900 border-t border-stone-700 rounded-t-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto p-5"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-[10px] font-mono text-stone-500 tracking-widest uppercase mb-1">
              WPH Criteria Guidance
            </p>
            <h3 className="text-lg font-bold uppercase tracking-wide">{category}</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-stone-700 text-stone-500 text-sm flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        {/* Base */}
        <p className="text-[10px] font-mono text-orange-600 tracking-widest uppercase mb-2">
          WPH Base (Essential)
        </p>
        <ul className="space-y-2 mb-5">
          {info.base.map((item, i) => (
            <li key={i} className="text-sm text-stone-200 leading-relaxed border-b border-stone-800 pb-2 last:border-0">
              {item}
            </li>
          ))}
        </ul>

        {/* Plus */}
        <p className="text-[10px] font-mono text-red-500 tracking-widest uppercase mb-2">
          WPH Plus (Enhanced)
        </p>
        <ul className="space-y-2 mb-5">
          {info.plus.map((item, i) => (
            <li key={i} className="text-sm text-stone-200 leading-relaxed border-b border-stone-800 pb-2 last:border-0">
              {item}
            </li>
          ))}
        </ul>

        {/* Footnote */}
        <p className="text-xs text-stone-600 border-t border-dashed border-stone-800 pt-3">
          Summarized for field reference from the official WPH checklist. Confirm exact measurements
          against the source document before relying on this for certification language.
        </p>
      </div>
    </div>
  )
}
