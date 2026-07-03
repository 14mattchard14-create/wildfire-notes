'use client'

import { CRITERIA_INFO, WPH_SOURCE_URL } from '@/lib/criteria'

export default function InfoModal({ category, onClose }) {
  if (!category) return null
  const info = CRITERIA_INFO[category]
  if (!info) return null

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0 12px 20px' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, width: '100%', maxWidth: 600, maxHeight: '80vh', overflowY: 'auto', padding: '24px 24px 36px', boxShadow: '0 8px 48px rgba(0,0,0,0.5)', scrollbarWidth: 'thin' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <div>
            <p style={{ fontSize: 9.5, fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>WPH Criteria Guidance</p>
            <h3 style={{ fontSize: 17, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text)', margin: 0 }}>{category}</h3>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid var(--line)', background: 'transparent', color: 'var(--text-muted)', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>✕</button>
        </div>

        <p style={{ fontSize: 9.5, fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 8 }}>WPH Base (Essential)</p>
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px' }}>
          {info.base.map((item, i) => <li key={i} style={{ fontSize: 13.5, color: 'var(--text)', lineHeight: 1.55, borderBottom: '1px solid var(--line)', padding: '8px 0' }}>{item}</li>)}
        </ul>

        <p style={{ fontSize: 9.5, fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--warn)', marginBottom: 8 }}>WPH Plus (Enhanced)</p>
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px' }}>
          {info.plus.map((item, i) => <li key={i} style={{ fontSize: 13.5, color: 'var(--text)', lineHeight: 1.55, borderBottom: '1px solid var(--line)', padding: '8px 0' }}>{item}</li>)}
        </ul>

        <a href={WPH_SOURCE_URL} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', fontSize: 12, fontFamily: 'monospace', color: 'var(--accent)', textDecoration: 'underline', marginBottom: 16 }}>↗ View official WPH How-To Prepare Checklist (PDF)</a>
        <p style={{ fontSize: 11.5, color: 'var(--text-muted)', borderTop: '1px dashed var(--line)', paddingTop: 12, margin: 0, lineHeight: 1.5 }}>Summarized for field reference from the official WPH checklist.</p>
      </div>
    </div>
  )
}
