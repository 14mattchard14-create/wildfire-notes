'use client'

import { useState, useRef, useEffect } from 'react'
import { zonePhotoItems, photoTransformStyle } from '@/lib/reportSchema'

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

export function StatusPill({ status, editable, onChange, small }) {
  const s = STATUS_STYLE[status] || { bg: '#F0F3F6', color: c.muted, label: status };
  const fontSize = small ? 10 : 11;
  if (editable) {
    return (
      <select
        value={status}
        onChange={e => onChange(e.target.value)}
        style={{
          background: s.bg, color: s.color, fontSize, fontWeight: 700,
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
  return <span style={{ background: s.bg, color: s.color, fontSize, fontWeight: 700, padding: small ? '2px 8px' : '3px 10px', borderRadius: 20, whiteSpace: 'nowrap' }}>{s.label}</span>;
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

// Generic large pop-up used by both FindingView and ZonePhotoGrid so
// clicking a photo or a finding on the customer-facing report opens a
// roomier, enlarged view instead of the compact card. Click-outside and
// Escape both close it; scroll is locked on the body while open so the
// report underneath doesn't scroll along with it.
export function Modal({ onClose, maxWidth = 640, children }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(23,36,49,0.72)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: c.surface, borderRadius: 14, maxWidth, width: '100%', maxHeight: '86vh', overflowY: 'auto', position: 'relative', boxShadow: '0 12px 48px rgba(0,0,0,0.35)' }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          style={{ position: 'absolute', top: 12, right: 12, width: 32, height: 32, borderRadius: '50%', background: 'rgba(23,36,49,0.08)', border: 'none', color: c.navy, fontSize: 17, cursor: 'pointer', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}

// Read-only finding card — the exact markup the customer sees on the
// published report. Shared by /report/[token] and the review page's
// read-mode rendering (see components below) so "looks exactly like the
// report" is guaranteed rather than approximated with a second copy.
function FindingDetail({ f, large }) {
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: large ? 16 : 0 }}>
        <div style={{ fontWeight: 700, color: c.navy, fontSize: large ? 19 : 14.5 }}>{f.category}</div>
        <StatusPill status={f.status} />
      </div>
      {large && f.finding && <div style={{ marginBottom: f.rationale ? 12 : 16, fontSize: 15, color: c.text, lineHeight: 1.7 }}>{f.finding}</div>}
      {large && f.rationale && <div style={{ marginBottom: 16, fontSize: 14, color: c.muted, fontStyle: 'italic', lineHeight: 1.7 }}>{f.rationale}</div>}
      {f.recommendation && (
        <div style={{ background: c.surfaceAlt, borderRadius: 6, padding: large ? '14px 16px' : '9px 13px', fontSize: large ? 15 : 13.5, color: c.text, lineHeight: 1.6 }}>
          <strong style={{ color: c.navy }}>Recommendation:</strong> {f.recommendation}
        </div>
      )}
    </>
  );
}

// Read-only finding card — the exact markup the customer sees on the
// published report. Shared by /report/[token] and the review page's
// read-mode rendering (see components below) so "looks exactly like the
// report" is guaranteed rather than approximated with a second copy.
// Clicking anywhere on the card (other than the inline "Learn more"
// toggle, which keeps its own quick-peek behavior) opens the same content
// in a much larger pop-up via Modal.
export function FindingView({ f }) {
  const [expanded, setExpanded] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const isNC = /non-compliant/i.test(f.status || '');
  const isOK = /^(base|plus) compliant/i.test(f.status || '');
  const hasDetails = !!(f.finding || f.rationale);
  return (
    <>
      <div
        onClick={() => setZoomed(true)}
        style={{ background: c.surface, border: `1px solid ${c.border}`, borderLeft: `4px solid ${isNC ? c.warn : isOK ? c.ok : c.border}`, borderRadius: 8, padding: '14px 16px', marginBottom: 12, cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: hasDetails || f.recommendation ? 8 : 0 }}>
          <div style={{ fontWeight: 700, color: c.navy, fontSize: 14.5 }}>{f.category}</div>
          <StatusPill status={f.status} />
        </div>

        {hasDetails && (
          <button
            onClick={e => { e.stopPropagation(); setExpanded(x => !x); }}
            style={{ background: 'none', border: 'none', padding: 0, margin: '0 0 8px', color: c.slate, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            {expanded ? '▾ Hide details' : '▸ Learn more about this finding'}
          </button>
        )}
        {expanded && (
          <div style={{ marginBottom: 10, fontSize: 13.5, color: c.text, lineHeight: 1.6 }}>
            {f.finding && <div style={{ marginBottom: f.rationale ? 6 : 0 }}>{f.finding}</div>}
            {f.rationale && <div style={{ color: c.muted, fontStyle: 'italic' }}>{f.rationale}</div>}
          </div>
        )}

        {f.recommendation && (
          <div style={{ background: c.surfaceAlt, borderRadius: 6, padding: '9px 13px', fontSize: 13.5, color: c.text, lineHeight: 1.6 }}>
            <strong style={{ color: c.navy }}>Recommendation:</strong> {f.recommendation}
          </div>
        )}
      </div>

      {zoomed && (
        <Modal onClose={() => setZoomed(false)} maxWidth={640}>
          <div style={{ padding: '28px 28px 24px', borderTop: `4px solid ${isNC ? c.warn : isOK ? c.ok : c.border}`, borderRadius: '14px 14px 0 0' }}>
            <FindingDetail f={f} large />
          </div>
        </Modal>
      )}
    </>
  );
}

// Read-only action plan table — shared between the customer report and the
// review page's read mode.
export function ActionPlanTable({ items }) {
  if (!items?.length) return <p style={{ color: c.muted, fontSize: 14 }}>No outstanding actions.</p>;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr>
            {['#', 'Action', 'Zone', 'Priority'].map(h => (
              <th key={h} style={{ background: c.navy, color: '#fff', padding: '10px 14px', textAlign: 'left', fontWeight: 700, fontSize: 12, letterSpacing: '0.04em' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((a, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? c.surface : c.surfaceAlt }}>
              <td style={{ padding: '10px 14px', borderBottom: `1px solid ${c.border}`, color: c.muted }}>{i + 1}</td>
              <td style={{ padding: '10px 14px', borderBottom: `1px solid ${c.border}`, color: c.text }}>{a.action}</td>
              <td style={{ padding: '10px 14px', borderBottom: `1px solid ${c.border}`, color: c.text }}>{a.zone}</td>
              <td style={{ padding: '10px 14px', borderBottom: `1px solid ${c.border}` }}>
                <span style={{ color: priorityColor(a.priority), fontWeight: 700, fontSize: 12.5 }}>{a.priority}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const carouselArrowStyle = {
  width: 22, height: 22, borderRadius: '50%', border: `1px solid ${c.border}`,
  background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', padding: 0, color: c.navy, fontSize: 13, flexShrink: 0,
};

// Horizontal scroll-snap carousel — used for per-zone photo strips so a
// zone with several photos takes up a fixed strip of vertical space instead
// of growing a tall multi-row grid. A live "X / Y" counter tracks scroll
// position; left/right buttons sit in that same counter row (normal
// document flow, not overlaid on the tiles) — they used to be absolutely
// positioned over the strip and, across several attempts, kept ending up on
// top of tile content one way or another. Putting them in their own row
// above the strip means there's no tile content there for them to ever
// overlap, full stop.
export function PhotoCarousel({ items, tileWidth = 200, renderItem, countOverride }) {
  const scrollRef = useRef(null);
  const [index, setIndex] = useState(0);
  const total = countOverride ?? items.length;

  function step() { return tileWidth + 12; }

  function updateIndex() {
    const el = scrollRef.current;
    if (!el) return;
    setIndex(Math.min(items.length - 1, Math.max(0, Math.round(el.scrollLeft / step()))));
  }

  function scroll(dir) {
    scrollRef.current?.scrollBy({ left: dir * step(), behavior: 'smooth' });
  }

  if (!items.length) return null;

  return (
    <div style={{ marginTop: 16 }}>
      {items.length > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: c.muted, fontFamily: 'monospace' }}>{Math.min(index + 1, total)} / {total}</span>
          <button onClick={() => scroll(-1)} aria-label="Scroll photos left" style={carouselArrowStyle}>‹</button>
          <button onClick={() => scroll(1)} aria-label="Scroll photos right" style={carouselArrowStyle}>›</button>
        </div>
      )}
      <div
        ref={scrollRef}
        onScroll={updateIndex}
        style={{ display: 'flex', alignItems: 'stretch', gap: 12, overflowX: 'auto', scrollSnapType: 'x mandatory', padding: '4px 0 8px', scrollbarWidth: 'none' }}
      >
        {items.map((item, i) => (
          <div key={item.id ?? i} style={{ scrollSnapAlign: 'start', flex: `0 0 ${tileWidth}px`, width: tileWidth }}>
            {renderItem(item, i)}
          </div>
        ))}
      </div>
    </div>
  );
}

// Read-only per-zone photo carousel — shared between the customer report
// and the review page's read mode. `zone` is the full zone object (so
// zonePhotoItems can see extraPhotos/photoOrder), not just its name.
// Clicking a tile opens the photo full-size in a Modal, with prev/next
// arrows to step through the rest of this zone's photos without closing
// and reopening. The lightbox shows the original image (no zoom/pan
// adjustment) since that framing was calibrated for the small cropped
// tile, not for seeing the whole photo up close.
export function ZonePhotoGrid({ zone, entries, reportData }) {
  const items = zonePhotoItems(zone, entries, reportData);
  const [openIndex, setOpenIndex] = useState(null);
  const openItem = openIndex != null ? items[openIndex] : null;

  return (
    <>
      <PhotoCarousel
        items={items}
        renderItem={(item, i) => (
          <div
            onClick={() => setOpenIndex(i)}
            style={{ border: `1px solid ${c.border}`, borderRadius: 8, overflow: 'hidden', background: c.surfaceAlt, height: '100%', cursor: 'pointer' }}
          >
            <div style={{ position: 'relative', width: '100%', height: 150, overflow: 'hidden' }}>
              <img src={item.url} alt={item.caption} style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover', ...photoTransformStyle(item.adjustment) }} />
              {item.status && (
                <div style={{ position: 'absolute', top: 0, left: 0, filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.35))' }}>
                  <StatusPill status={item.status} small />
                </div>
              )}
            </div>
            <div style={{ padding: '10px 12px' }}>
              <div style={{ fontSize: 12, color: c.text, lineHeight: 1.5, fontStyle: 'italic' }}>{item.caption}</div>
            </div>
          </div>
        )}
      />

      {openItem && (
        <Modal onClose={() => setOpenIndex(null)} maxWidth={880}>
          <div style={{ position: 'relative', background: '#000', borderRadius: '14px 14px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
            <img src={openItem.url} alt={openItem.caption} style={{ maxWidth: '100%', maxHeight: '68vh', display: 'block', objectFit: 'contain' }} />
            {openItem.status && (
              <div style={{ position: 'absolute', top: 0, left: 0, filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))' }}>
                <StatusPill status={openItem.status} />
              </div>
            )}
            {items.length > 1 && (
              <>
                <button
                  onClick={e => { e.stopPropagation(); setOpenIndex((openIndex - 1 + items.length) % items.length); }}
                  aria-label="Previous photo"
                  style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.9)', border: 'none', color: c.navy, fontSize: 18, cursor: 'pointer' }}
                >‹</button>
                <button
                  onClick={e => { e.stopPropagation(); setOpenIndex((openIndex + 1) % items.length); }}
                  aria-label="Next photo"
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.9)', border: 'none', color: c.navy, fontSize: 18, cursor: 'pointer' }}
                >›</button>
              </>
            )}
          </div>
          <div style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: 14.5, color: c.text, lineHeight: 1.6, fontStyle: 'italic', marginBottom: items.length > 1 ? 8 : 0 }}>{openItem.caption}</div>
            {items.length > 1 && <div style={{ fontSize: 11, color: c.muted, fontFamily: 'monospace' }}>{openIndex + 1} / {items.length}</div>}
          </div>
        </Modal>
      )}
    </>
  );
}
