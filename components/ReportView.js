'use client'

import { useState } from 'react'

// Shared visual language between the customer-facing report
// (app/report/[token]) and the inspector's review/edit page
// (app/manage/[id]/review) — so editing genuinely happens "in" the final
// report's look, not a plain form that merely holds the same data.
//
// StatusPill and RiskBadge each take an optional `editable`/`onChange` pair:
// when editable, they render as a native <select> styled to look exactly
// like their read-only counterpart, so the inspector edits by
// clicking-and-choosing directly on the visual element the customer will
// see, rather than a separate labeled dropdown elsewhere on the page.

export const reportColors = {
  bg: '#E8EDF1', surface: '#FFFFFF', surfaceAlt: '#F3F6F8',
  navy: '#172431', slate: '#5C6685', tan: '#C1502E',
  border: '#D6DDE3', text: '#1A2632', muted: '#6B7A8D',
  ok: '#3A7D44', warn: '#B5483A',
};
const c = reportColors;

export const LEVEL_COLORS = { 'Low': '#3A7D44', 'Moderate': '#E8A020', 'High': '#C0552A', 'Very High': '#B5483A', 'Severe': '#8B1A1A' };

const STATUS_STYLE = {
  'Base Compliant':     { bg: '#EAF4EB', color: c.ok,     label: '✓ Base Compliant' },
  'Plus Compliant':     { bg: '#E8F4EA', color: '#2D6E3A', label: '✓✓ Plus Compliant' },
  'Non-Compliant':      { bg: '#FDECEA', color: c.warn,    label: '✗ Non-Compliant' },
  'Needs Verification': { bg: '#FDF6E8', color: '#8A6D3B', label: '? Needs Verification' },
  'Not Applicable':     { bg: '#F0F3F6', color: c.muted,   label: '— Not Applicable' },
  'Pending review':     { bg: '#F0F3F6', color: c.muted,   label: '… Pending Review' },
};
export const STATUS_OPTIONS = Object.keys(STATUS_STYLE);

export function StatusPill({ status, editable, onChange }) {
  const s = STATUS_STYLE[status] || { bg: '#F0F3F6', color: c.muted, label: status };
  if (editable) {
    return (
      <select
        value={status}
        onChange={e => onChange(e.target.value)}
        style={{
          background: s.bg, color: s.color, fontSize: 11, fontWeight: 700,
          padding: '3px 20px 3px 10px', borderRadius: 20, border: 'none',
          appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
          cursor: 'pointer', fontFamily: 'inherit',
          backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='${encodeURIComponent(s.color)}'><path d='M5.5 7.5l4.5 4.5 4.5-4.5z'/></svg>")`,
          backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center', backgroundSize: 12,
        }}
      >
        {STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{STATUS_STYLE[opt].label}</option>)}
      </select>
    );
  }
  return <span style={{ background: s.bg, color: s.color, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap' }}>{s.label}</span>;
}

export function RiskBadge({ level, editable, onChange }) {
  const color = LEVEL_COLORS[level] || LEVEL_COLORS.Moderate;
  const levels = ['Low', 'Moderate', 'High', 'Very High'];
  const idx = Math.max(0, levels.indexOf(level));
  return (
    <div style={{ background: c.surface, border: `2px solid ${c.border}`, borderLeft: `6px solid ${color}`, borderRadius: 12, padding: '20px 28px', display: 'flex', alignItems: 'center', gap: 24, marginBottom: 32 }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: c.muted, textTransform: 'uppercase', marginBottom: 4 }}>Fire Risk Rating</div>
        {editable ? (
          <select value={level} onChange={e => onChange(e.target.value)} style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1, border: 'none', background: 'transparent', appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
            {levels.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        ) : (
          <div style={{ fontSize: 32, fontWeight: 800, color, lineHeight: 1 }}>{level || 'Moderate'}</div>
        )}
      </div>
      <div style={{ flex: 1, display: 'flex', gap: 6, alignItems: 'center' }}>
        {levels.map((l, i) => (
          <div key={l} style={{ flex: 1 }}>
            <div style={{ height: 8, borderRadius: 4, background: i <= idx ? color : c.border, opacity: i <= idx ? (0.3 + (i / levels.length) * 0.7) : 1 }} />
            <div style={{ fontSize: 9, color: c.muted, textAlign: 'center', marginTop: 4, fontWeight: i === idx ? 700 : 400 }}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CollapsibleCard({ title, id, isH2, defaultOpen, headerContent, children }) {
  const [open, setOpen] = useState(defaultOpen !== false);
  return (
    <div id={id} style={{ marginBottom: isH2 ? 28 : 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: isH2 ? c.navy : c.surfaceAlt, color: isH2 ? '#fff' : c.navy, borderRadius: isH2 ? (open ? '10px 10px 0 0' : 10) : (open ? '8px 8px 0 0' : 8), padding: isH2 ? '12px 16px 12px 20px' : '10px 16px' }}>
        <button onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, textAlign: 'left', flex: headerContent ? '0 1 auto' : 1 }}>
          <span style={{ fontSize: 18, opacity: 0.6, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>›</span>
          {title && <span style={{ fontWeight: 700, fontSize: isH2 ? 16 : 14 }}>{title}</span>}
        </button>
        {headerContent && <div style={{ flex: 1, marginLeft: 10 }}>{headerContent}</div>}
      </div>
      {open && (
        <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderTop: 'none', borderRadius: '0 0 10px 10px', padding: '18px 20px' }}>
          {children}
        </div>
      )}
    </div>
  );
}

export function priorityColor(p) {
  if (/high/i.test(p)) return c.warn;
  if (/low/i.test(p)) return c.ok;
  return '#B58A2E';
}
