'use client'

import { CRITERIA_INFO, WPH_SOURCE_URL } from '@/lib/criteria'

const c = {
  surface: '#242220',
  surface2: '#1b1917',
  line:    '#3a352f',
  accent:  '#be5b1d',
  text:    '#ece6db',
  muted:   '#9a9285',
  warn:    '#b5483a',
}

export default function InfoModal({ category, onClose }) {
  if (!category) return null
  const info = CRITERIA_INFO[category]
  if (!info) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        padding: '0 12px 20px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: c.surface,
          border: `1px solid ${c.line}`,
          borderRadius: 14,
          width: '100%', maxWidth: 600,
          maxHeight: '80vh',
          overflowY: 'auto',
          padding: '24px 24px 36px',
          boxShadow: '0 8px 48px rgba(0,0,0,0.7)',
          scrollbarWidth: 'thin',
          scrollbarColor: `${c.line} transparent`,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <div>
            <p style={{ fontSize: 9.5, fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase', color: c.muted, marginBottom: 4 }}>
              WPH Criteria Guidance
            </p>
            <h3 style={{ fontSize: 17, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: c.text, margin: 0 }}>
              {category}
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 30, height: 30, borderRadius: '50%',
              border: `1px solid ${c.line}`,
              background: 'transparent',
              color: c.muted, fontSize: 13,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        {/* Base */}
        <p style={{ fontSize: 9.5, fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase', color: c.accent, marginBottom: 8 }}>
          WPH Base (Essential)
        </p>
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px' }}>
          {info.base.map((item, i) => (
            <li key={i} style={{
              fontSize: 13.5, color: c.text, lineHeight: 1.55,
              borderBottom: `1px solid ${c.line}`, padding: '8px 0',
            }}>
              {item}
            </li>
          ))}
        </ul>

        {/* Plus */}
        <p style={{ fontSize: 9.5, fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase', color: c.warn, marginBottom: 8 }}>
          WPH Plus (Enhanced)
        </p>
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px' }}>
          {info.plus.map((item, i) => (
            <li key={i} style={{
              fontSize: 13.5, color: c.text, lineHeight: 1.55,
              borderBottom: `1px solid ${c.line}`, padding: '8px 0',
            }}>
              {item}
            </li>
          ))}
        </ul>

        {/* Source link */}
        <a
          href={WPH_SOURCE_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-block', fontSize: 12, fontFamily: 'monospace', color: c.accent,
            textDecoration: 'underline', marginBottom: 16,
          }}
        >
          ↗ View official WPH How-To Prepare Checklist (PDF)
        </a>

        {/* Footnote */}
        <p style={{
          fontSize: 11.5, color: c.muted,
          borderTop: `1px dashed ${c.line}`, paddingTop: 12, margin: 0, lineHeight: 1.5,
        }}>
          Summarized for field reference from the official WPH checklist. Confirm exact measurements
          against the source document before relying on this for certification language.
        </p>
      </div>
    </div>
  )
}
