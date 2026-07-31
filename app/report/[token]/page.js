'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { parseReportData, getPhotoCaption } from '@/lib/reportSchema';
import { reportColors, StatusPill, RiskBadge, CollapsibleCard, priorityColor } from '@/components/ReportView';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const c = reportColors;

const ZONE_GUIDE = [
  { title: 'Overall Site', body: 'A whole-property view of wildfire exposure, factoring in slope, prevailing wind, fuel load, and how neighboring properties could contribute to fire spread toward or away from the home.' },
  { title: '0-5 FT. Noncombustible Zone', body: 'The most critical area around the home. The first five feet must be completely noncombustible — bare mineral soil or hardscape only, with no vegetation, mulch, or combustible items.' },
  { title: '5-30 FT. Defensible Space - Vegetation', body: 'A fuel-reduction zone that slows fire spread before it reaches the home. Trees and shrubs must be properly spaced and pruned, grass kept short, and dead vegetation removed.' },
  { title: '10-30 FT. Defensible Space - Detached Structures & Other Large Items', body: 'Sheds, pergolas, hot tubs, and storage tanks within 30 ft carry their own placement and material requirements to prevent them acting as fire bridges to the structure.' },
  { title: 'Roof', body: 'The roof covering must be Class A fire-rated and kept free of debris — wood roofs and plastic corrugated panels are never permitted.' },
  { title: 'Gutters', body: 'Gutters and downspouts must be noncombustible and kept clear of debris, since dry leaves and needles trapped in gutters are a common ember ignition point.' },
  { title: '6-Inch Noncombustible Wall Clearance', body: 'A 6-inch noncombustible buffer at the base of exterior walls prevents ground-level embers and flames from reaching combustible wall materials.' },
  { title: 'Vents', body: 'Roof, attic, eave, and under-home vents are major ember entry points and require 1/8-inch corrosion-resistant mesh. Dryer vents need a functional flap instead.' },
  { title: 'Eaves & Soffits', body: 'The exposed underside of roof eaves can trap rising embers and heat; enclosing or protecting this area with noncombustible material is a key upgrade.' },
  { title: 'Skylights', body: 'Plastic dome skylights are vulnerable to radiant heat; flat, multi-pane tempered-glass skylights with mesh-protected vents are far more fire-resistant.' },
  { title: 'Exterior Wall Coverings / Siding', body: 'Full noncombustible siding (brick, stucco, fiber-cement, metal) provides strong protection against direct flame contact and radiant heat.' },
  { title: 'Exterior Windows', body: 'Tempered double-pane glass resists breaking under radiant heat — broken windows are a common way embers and flame enter a home during a wildfire.' },
  { title: 'Exterior Doors', body: 'Solid-core or noncombustible doors with tempered glass panes and noncombustible thresholds resist ignition better than hollow or thin wood doors.' },
  { title: 'Decks, Patios & Overhead Structures', body: 'Decks and patios need their own ember-resistant zone, noncombustible bases at posts/stairs, and (for Plus) fully noncombustible walking surfaces and railings.' },
  { title: 'Access & Address', body: 'Ensures fire crews can find and reach the property quickly — visible address numbers and a clear, navigable driveway are essential during an active wildfire response.' },
];

function zoneKey(s) { return (s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }

// The recommendation is the one thing every homeowner needs to see; the
// finding description and the "why" behind the status are supporting
// detail, folded together behind one "Learn more" toggle instead of a
// separate paragraph plus a tooltip icon that said much the same thing
// twice.
function FindingCard({ f }) {
  const [expanded, setExpanded] = useState(false);
  const isNC = /non-compliant/i.test(f.status || '');
  const isOK = /^(base|plus) compliant/i.test(f.status || '');
  const hasDetails = !!(f.finding || f.rationale);
  return (
    <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderLeft: `4px solid ${isNC ? c.warn : isOK ? c.ok : c.border}`, borderRadius: 8, padding: '14px 16px', marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: hasDetails || f.recommendation ? 8 : 0 }}>
        <div style={{ fontWeight: 700, color: c.navy, fontSize: 14.5 }}>{f.category}</div>
        <StatusPill status={f.status} />
      </div>

      {hasDetails && (
        <button
          onClick={() => setExpanded(x => !x)}
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
  );
}

function ZoneSection({ zone, entries, reportData, id }) {
  const zonePhotos = (entries || []).filter(e => e.photo_url && zoneKey(e.zone) === zoneKey(zone.zone));
  return (
    <CollapsibleCard title={zone.zone} id={id} isH2>
      {(zone.findings || []).map((f, i) => <FindingCard key={i} f={f} />)}
      {zonePhotos.length > 0 && (
        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
          {zonePhotos.map((e, i) => (
            <div key={i} style={{ border: `1px solid ${c.border}`, borderRadius: 8, overflow: 'hidden', background: c.surfaceAlt }}>
              <img src={e.photo_url} alt={getPhotoCaption(reportData, e)} style={{ width: '100%', display: 'block', maxHeight: 200, objectFit: 'cover' }} />
              <div style={{ padding: '10px 12px' }}>
                <div style={{ fontSize: 12, color: c.text, lineHeight: 1.5, marginBottom: 6, fontStyle: 'italic' }}>{getPhotoCaption(reportData, e)}</div>
                <StatusPill status={e.status} />
              </div>
            </div>
          ))}
        </div>
      )}
    </CollapsibleCard>
  );
}

const SIDEBAR_WIDTH = 280;

// Table of contents as a collapsible left panel instead of an inline card —
// fixed-position so it never affects document flow itself; the caller
// shifts the rest of the page over with a matching margin-left when it's
// open on desktop. On mobile it behaves as a full-height overlay drawer
// (with a backdrop to dismiss) instead of pushing content, since there's
// no room to spare on a phone screen.
//
// The toggle button is `position: fixed` (so it's reachable no matter how
// far down the page you've scrolled) but pinned below `topOffset` — the
// measured height of the navy header above it — so it can never land on top
// of the header's own title text, and the panel itself only ever occupies
// the space below the header rather than competing with it for the same row.
function ReportSidebar({ items, query, onQueryChange, open, onToggle, isMobile, topOffset }) {
  const q = query.trim().toLowerCase();
  const filtered = q
    ? items.filter(item => item.title.toLowerCase().includes(q) || item.content.includes(q))
    : items;
  const width = isMobile ? 'min(300px, 85vw)' : SIDEBAR_WIDTH;

  return (
    <>
      <button
        onClick={onToggle}
        aria-label={open ? 'Collapse table of contents' : 'Expand table of contents'}
        title="Table of contents"
        style={{
          position: 'fixed', top: topOffset + 10, left: open ? width : 0, zIndex: 41,
          background: c.navy, color: '#fff', border: 'none',
          borderRadius: '0 8px 8px 0', width: 30, height: 42,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', transition: 'left 0.22s ease', boxShadow: '2px 0 8px rgba(0,0,0,0.18)',
          fontSize: 15,
        }}
      >
        {open ? '‹' : '☰'}
      </button>

      {isMobile && open && (
        <div onClick={onToggle} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 39 }} />
      )}

      <div style={{
        position: 'fixed', top: topOffset, left: 0, height: `calc(100vh - ${topOffset}px)`,
        width,
        background: c.bg, borderRight: `1px solid ${c.border}`, zIndex: 40, overflowY: 'auto', boxSizing: 'border-box',
        padding: '20px 18px', transform: open ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.22s ease', boxShadow: open ? '4px 0 24px rgba(44,66,87,0.14)' : 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: c.muted }}>
            Table of Contents
          </div>
          <button
            onClick={onToggle}
            aria-label="Collapse table of contents"
            style={{ background: 'none', border: 'none', color: c.muted, fontSize: 16, cursor: 'pointer', padding: 4, lineHeight: 1 }}
          >
            ✕
          </button>
        </div>
        <input
          type="text"
          value={query}
          onChange={e => onQueryChange(e.target.value)}
          placeholder="Search the report…"
          style={{ width: '100%', boxSizing: 'border-box', background: c.surface, border: `1px solid ${c.border}`, borderRadius: 8, color: c.text, fontSize: 13.5, padding: '9px 12px', outline: 'none', marginBottom: 14 }}
        />
        <ol style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {filtered.map((item, i) => (
            <li key={i}>
              <a
                href={`#${item.id}`}
                onClick={e => {
                  e.preventDefault();
                  document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  if (isMobile) onToggle();
                }}
                style={{ display: 'block', color: c.text, fontSize: 14, fontWeight: 500, textDecoration: 'none', padding: '9px 10px', borderRadius: 6 }}
                onMouseEnter={e => { e.currentTarget.style.background = c.surfaceAlt; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                {item.title}
              </a>
            </li>
          ))}
          {filtered.length === 0 && (
            <li style={{ color: c.muted, fontSize: 13, padding: '8px 10px' }}>No matches in the report</li>
          )}
        </ol>
      </div>
    </>
  );
}

function ZoneGuide() {
  const [open, setOpen] = useState(false);
  return (
    <div id="zone-guide" style={{ marginBottom: 32 }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: c.navy, color: '#fff', border: 'none', borderRadius: open ? '10px 10px 0 0' : 10, padding: '14px 20px', cursor: 'pointer', textAlign: 'left' }}>
        <span style={{ fontWeight: 700, fontSize: 16 }}>Understanding the Zones</span>
        <span style={{ fontSize: 18, opacity: 0.6, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>›</span>
      </button>
      {open && (
        <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderTop: 'none', borderRadius: '0 0 10px 10px', padding: '20px 24px' }}>
          {ZONE_GUIDE.map((z, i) => (
            <div key={i} style={{ marginBottom: 18, paddingBottom: 18, borderBottom: i < ZONE_GUIDE.length - 1 ? `1px solid ${c.border}` : 'none' }}>
              <div style={{ fontWeight: 700, color: c.navy, fontSize: 14, marginBottom: 4 }}>{z.title}</div>
              <div style={{ fontSize: 14, color: c.text, lineHeight: 1.65 }}>{z.body}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ActionPlanTable({ items }) {
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

// --- Legacy fallback: reports published before the structured JSON format
// existed still have a freeform markdown blob in report_markdown. Rather
// than lose access to those links, fall back to the original markdown
// renderer for anything that doesn't parse as the new shape.

function legacyRiskLevel(md) {
  const t = (md || '').toLowerCase();
  if (/overall risk rating\s*\n+\*{0,2}very high/m.test(t)) return 'Very High';
  if (/overall risk rating\s*\n+\*{0,2}severe/m.test(t)) return 'Severe';
  if (/overall risk rating\s*\n+\*{0,2}high/m.test(t)) return 'High';
  if (/overall risk rating\s*\n+\*{0,2}low/m.test(t)) return 'Low';
  return 'Moderate';
}

function fi(text) {
  return (text || '')
    .replace(/\*\*(.+?)\*\*/g, `<strong style="color:${c.navy};font-weight:700">$1</strong>`)
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, `<a href="$2" target="_blank" rel="noopener" style="color:${c.slate};text-decoration:underline">$1</a>`);
}

function renderLegacyLines(lines) {
  const els = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) { i++; continue; }
    if (/^\d+\.\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) { items.push(lines[i].trim().replace(/^\d+\.\s/, '')); i++; }
      els.push(<ol key={`ol${i}`} style={{ margin: '8px 0 16px 20px', padding: 0 }}>{items.map((item, j) => <li key={j} style={{ marginBottom: 8, color: c.text, lineHeight: 1.7, fontSize: 15 }} dangerouslySetInnerHTML={{ __html: fi(item) }} />)}</ol>);
    } else if (/^[-•]\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^[-•]\s/.test(lines[i].trim())) { items.push(lines[i].trim().replace(/^[-•]\s/, '')); i++; }
      els.push(<ul key={`ul${i}`} style={{ margin: '8px 0 16px 20px', padding: 0 }}>{items.map((item, j) => <li key={j} style={{ marginBottom: 6, color: c.text, lineHeight: 1.7, fontSize: 15 }} dangerouslySetInnerHTML={{ __html: fi(item) }} />)}</ul>);
    } else if (/^\|/.test(line)) {
      const tls = [];
      while (i < lines.length && /^\|/.test(lines[i].trim())) { tls.push(lines[i].trim()); i++; }
      const rows = tls.filter(l => !/^\|[-:\s|]+\|$/.test(l));
      const pr = r => r.split('|').slice(1, -1).map(cell => cell.trim());
      const hdrs = pr(rows[0] || '');
      els.push(
        <div key={`tbl${i}`} style={{ overflowX: 'auto', marginBottom: 20 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead><tr>{hdrs.map((h, j) => <th key={j} style={{ background: c.navy, color: '#fff', padding: '10px 14px', textAlign: 'left', fontWeight: 700, fontSize: 12, letterSpacing: '0.04em' }}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.slice(1).map((row, ri) => {
                const cells = pr(row);
                const isNC = cells.some(cell => /non-compliant/i.test(cell));
                const isOK = cells.some(cell => /compliant/i.test(cell) && !/non-compliant/i.test(cell));
                return (
                  <tr key={ri} style={{ background: ri % 2 === 0 ? c.surface : c.surfaceAlt, borderLeft: `3px solid ${isNC ? c.warn : isOK ? c.ok : 'transparent'}` }}>
                    {cells.map((cell, ci) => <td key={ci} style={{ padding: '10px 14px', borderBottom: `1px solid ${c.border}`, color: c.text, verticalAlign: 'top', lineHeight: 1.5 }} dangerouslySetInnerHTML={{ __html: fi(cell) }} />)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    } else {
      els.push(<p key={`p${i}`} style={{ margin: '0 0 14px 0', color: c.text, lineHeight: 1.75, fontSize: 15 }} dangerouslySetInnerHTML={{ __html: fi(line) }} />);
      i++;
    }
  }
  return els;
}

function parseLegacyReport(md) {
  if (!md) return [];
  const sections = [];
  let cur = null;
  for (const line of md.split('\n')) {
    if (line.startsWith('## ')) { if (cur) sections.push(cur); cur = { type: 'h2', title: line.replace(/^## /, '').trim(), lines: [] }; }
    else if (line.startsWith('### ')) { if (cur) sections.push(cur); cur = { type: 'h3', title: line.replace(/^### /, '').trim(), lines: [] }; }
    else if (cur) cur.lines.push(line);
  }
  if (cur) sections.push(cur);
  return sections;
}

function LegacySection({ section, entries, id }) {
  const isH2 = section.type === 'h2';
  const zonePhotos = (entries || []).filter(e => e.photo_url && zoneKey(e.zone) === zoneKey(section.title));
  return (
    <CollapsibleCard title={section.title} id={id} isH2={isH2}>
      {renderLegacyLines(section.lines)}
      {zonePhotos.length > 0 && (
        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
          {zonePhotos.map((e, i) => (
            <div key={i} style={{ border: `1px solid ${c.border}`, borderRadius: 8, overflow: 'hidden', background: c.surfaceAlt }}>
              <img src={e.photo_url} alt={e.ai_caption || e.note} style={{ width: '100%', display: 'block', maxHeight: 200, objectFit: 'cover' }} />
              <div style={{ padding: '10px 12px' }}>
                <div style={{ fontSize: 12, color: c.text, lineHeight: 1.5, marginBottom: 6, fontStyle: 'italic' }}>{e.ai_caption || e.note}</div>
                <StatusPill status={e.status} />
              </div>
            </div>
          ))}
        </div>
      )}
    </CollapsibleCard>
  );
}

export default function ReportPage({ params }) {
  const { token } = React.use(params);
  const [stage, setStage] = useState('code');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);
  // Default to the "mobile, closed" state so the very first client render
  // matches what the server rendered (no window to check yet) — the effect
  // below corrects it immediately after mount, before the user notices.
  const [isMobile, setIsMobile] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarQuery, setSidebarQuery] = useState('');
  // Measured height of the navy header banner, so the sidebar (and its
  // toggle) can be pinned to start exactly where the header ends instead of
  // guessing a fixed pixel value — the header's real height varies with how
  // many of the date/inspector/report-date fields are present.
  const headerRef = useRef(null);
  const [headerHeight, setHeaderHeight] = useState(96);

  useEffect(() => {
    function measure() {
      if (headerRef.current) setHeaderHeight(headerRef.current.getBoundingClientRect().height);
    }
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [report]);

  useEffect(() => {
    const saved = sessionStorage.getItem(`report_access_${token}`);
    if (saved === 'granted') fetchReport();
  }, [token]);

  useEffect(() => {
    function updateForWidth() {
      const mobile = window.innerWidth < 860;
      setIsMobile(mobile);
      setSidebarOpen(!mobile);
    }
    updateForWidth();
    window.addEventListener('resize', updateForWidth);
    return () => window.removeEventListener('resize', updateForWidth);
  }, []);

  async function fetchReport() {
    setStage('loading');
    const { data, error } = await supabase.from('shared_reports').select('*').eq('token', token).single();
    if (error || !data) { setStage('error'); setError('Report not found. The link may be invalid or expired.'); return; }
    setReport(data);
    setStage('report');
  }

  async function handleSubmitCode(e) {
    e.preventDefault(); setError(''); setStage('loading');
    const { data, error: dbErr } = await supabase.from('shared_reports').select('access_code').eq('token', token).single();
    if (dbErr || !data) { setStage('code'); setError('Report not found. Check your link.'); return; }
    if (code.trim() !== data.access_code) { setStage('code'); setError('Incorrect access code. Please try again.'); return; }
    sessionStorage.setItem(`report_access_${token}`, 'granted');
    fetchReport();
  }

  const reportData = report ? parseReportData(report.report_markdown) : null;
  const legacy = !!report && !reportData;
  const legacySections = legacy ? parseLegacyReport(report.report_markdown) : [];
  const entries = report?.entries_snapshot || [];

  const riskLevel = reportData ? reportData.overallRiskRating : (legacy ? legacyRiskLevel(report.report_markdown) : null);

  // Each item carries a lowercased `content` blob of everything in that
  // section (finding text, recommendations, rationale, photo captions, even
  // the header/disclaimer copy) so the sidebar search matches anything in
  // the report, not just section titles.
  const headerAndDisclaimerText = [
    report?.property_address, report?.inspector_name, report?.visit_date,
    'wildfire prepared home certification official wph checklist',
    'this report reflects conditions observed at the time of inspection and is not a guarantee against wildfire damage or loss',
  ].filter(Boolean).join(' ').toLowerCase();

  const tocItems = reportData
    ? [
        { id: 'toc-exec', title: 'Executive Summary', content: [headerAndDisclaimerText, reportData.summaryNarrative, ...(reportData.topPriorities || []), reportData.wphBase, reportData.wphPlus, reportData.overallRiskRating].filter(Boolean).join(' ').toLowerCase() },
        { id: 'toc-overview', title: 'Site & Environmental Overview', content: (reportData.siteOverview || '').toLowerCase() },
        ...reportData.zones.map((z, i) => ({
          id: `toc-zone-${i}`,
          title: z.zone,
          content: [z.zone, ...(z.findings || []).map(f => [f.category, f.finding, f.status, f.recommendation, f.rationale].filter(Boolean).join(' ')), ...entries.filter(e => e.zone === z.zone).map(e => getPhotoCaption(reportData, e))].join(' ').toLowerCase(),
        })),
        { id: 'toc-action', title: 'Prioritized Action Plan', content: (reportData.actionPlan || []).map(a => [a.action, a.zone, a.priority].filter(Boolean).join(' ')).join(' ').toLowerCase() },
        { id: 'zone-guide', title: 'Understanding the Zones', content: ZONE_GUIDE.map(z => `${z.title} ${z.body}`).join(' ').toLowerCase() },
      ]
    : legacySections.filter(s => s.type === 'h2').map((s, i) => ({ id: `toc-${i}`, title: s.title, content: [headerAndDisclaimerText, ...(s.lines || [])].join(' ').toLowerCase() }))
        .concat([{ id: 'zone-guide', title: 'Understanding the Zones', content: ZONE_GUIDE.map(z => `${z.title} ${z.body}`).join(' ').toLowerCase() }]);

  if (stage === 'loading') return (
    <div style={{ minHeight: '100vh', background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', colorScheme: 'light' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, border: `3px solid ${c.border}`, borderTop: `3px solid ${c.navy}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
        <div style={{ color: c.slate, fontSize: 14 }}>Loading your report…</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );

  if (stage === 'error') return (
    <div style={{ minHeight: '100vh', background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, colorScheme: 'light' }}>
      <div style={{ background: c.surface, borderRadius: 16, padding: 40, maxWidth: 400, textAlign: 'center', border: `1px solid ${c.border}` }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
        <div style={{ color: c.navy, fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Report Unavailable</div>
        <div style={{ color: c.muted, fontSize: 14 }}>{error}</div>
      </div>
    </div>
  );

  if (stage === 'code') return (
    <div style={{ minHeight: '100vh', background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'system-ui, -apple-system, sans-serif', colorScheme: 'light' }}>
      <div style={{ background: c.surface, borderRadius: 20, padding: '48px 40px', maxWidth: 420, width: '100%', boxShadow: '0 4px 32px rgba(44,66,87,0.10)', border: `1px solid ${c.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <div style={{ width: 40, height: 40, background: c.navy, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 20 }}>🔥</span></div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: c.muted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Wildfire Inspection</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: c.navy }}>Your Property Report</div>
          </div>
        </div>
        <p style={{ color: c.muted, fontSize: 14, lineHeight: 1.6, marginBottom: 28 }}>Your inspector shared this report with you privately. Enter the 6-digit access code they provided to view it.</p>
        <form onSubmit={handleSubmitCode}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: c.slate, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Access Code</label>
          <input type="text" inputMode="numeric" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} placeholder="000000"
            style={{ width: '100%', padding: '14px 16px', fontSize: 24, letterSpacing: '0.3em', textAlign: 'center', border: `2px solid ${error ? c.warn : c.border}`, borderRadius: 10, outline: 'none', color: c.navy, fontWeight: 700, background: c.bg, boxSizing: 'border-box', marginBottom: error ? 8 : 20 }} autoFocus />
          {error && <div style={{ color: c.warn, fontSize: 13, marginBottom: 16 }}>{error}</div>}
          <button type="submit" disabled={code.length !== 6} style={{ width: '100%', padding: '14px', background: code.length === 6 ? c.navy : c.border, color: code.length === 6 ? '#fff' : c.muted, border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: code.length === 6 ? 'pointer' : 'not-allowed' }}>View Report</button>
        </form>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: c.bg, fontFamily: 'system-ui, -apple-system, sans-serif', color: c.text, colorScheme: 'light' }}>
      <ReportSidebar items={tocItems} query={sidebarQuery} onQueryChange={setSidebarQuery} open={sidebarOpen} onToggle={() => setSidebarOpen(o => !o)} isMobile={isMobile} topOffset={headerHeight} />

      {/* Header is always full-width and unshifted — the sidebar starts
          below it (using the measured height above) rather than sharing its
          row, so it can never overlap the header's own title/info. */}
      <div ref={headerRef} style={{ background: c.navy, color: '#fff' }}>
        <div style={{ maxWidth: 820, margin: '0 auto', padding: '28px 24px 24px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.6, marginBottom: 10 }}>🔥 Wildfire Risk Reduction Assessment</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 20px', lineHeight: 1.2 }}>{report?.property_address}</h1>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16, paddingBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
            {[['Date of Assessment', report?.visit_date], ['Inspector', report?.inspector_name], ['Report Date', report?.created_at ? new Date(report.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null]].filter(([, v]) => v).map(([label, val]) => (
              <div key={label}>
                <div style={{ fontSize: 10, opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{val}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ height: 5, background: `linear-gradient(90deg, ${c.tan}, ${c.slate})` }} />
      </div>

      <div style={{ marginLeft: !isMobile && sidebarOpen ? SIDEBAR_WIDTH : 0, transition: 'margin-left 0.22s ease' }}>

      <div style={{ maxWidth: 820, margin: '0 auto', padding: '32px 24px 80px' }}>
        <div style={{ background: '#FFF8F0', border: `1px solid ${c.tan}`, borderLeft: `4px solid ${c.tan}`, borderRadius: 10, padding: '14px 18px', marginBottom: 28, fontSize: 13, color: c.text, lineHeight: 1.7 }}>
          This report is intended to give homeowners a clear picture of their wildfire risk, while also outlining the gaps that would need to be addressed before the property could successfully obtain{' '}
          <a href="https://wildfireprepared.org/" target="_blank" rel="noopener" style={{ color: c.slate }}>Wildfire Prepared Home certification</a>.
          {' '}Compliance determinations are based on the{' '}
          <a href="https://wildfireprepared.org/wp-content/uploads/WPH-How-To-Prepare-My-Home-Checklist.pdf" target="_blank" rel="noopener" style={{ color: c.slate }}>official WPH checklist</a>.
        </div>

        <RiskBadge level={riskLevel} />

        {reportData ? (
          <>
            <CollapsibleCard title="Executive Summary" id="toc-exec" isH2>
              {reportData.summaryNarrative && <p style={{ margin: '0 0 16px', color: c.text, lineHeight: 1.75, fontSize: 15 }}>{reportData.summaryNarrative}</p>}
              {reportData.topPriorities?.filter(Boolean).length > 0 && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 700, color: c.navy, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Top Priorities</div>
                  <ol style={{ margin: '0 0 16px 20px', padding: 0 }}>
                    {reportData.topPriorities.filter(Boolean).map((p, i) => <li key={i} style={{ marginBottom: 8, color: c.text, lineHeight: 1.7, fontSize: 15 }}>{p}</li>)}
                  </ol>
                </>
              )}
              {(reportData.wphBase || reportData.wphPlus) && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 700, color: c.navy, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>WPH Designation Snapshot</div>
                  <ul style={{ margin: 0, padding: '0 0 0 20px' }}>
                    {reportData.wphBase && <li style={{ marginBottom: 6, color: c.text, lineHeight: 1.7, fontSize: 15 }}><strong style={{ color: c.navy }}>Base (Essential):</strong> {reportData.wphBase}</li>}
                    {reportData.wphPlus && <li style={{ color: c.text, lineHeight: 1.7, fontSize: 15 }}><strong style={{ color: c.navy }}>Plus (Enhanced):</strong> {reportData.wphPlus}</li>}
                  </ul>
                </>
              )}
            </CollapsibleCard>

            <CollapsibleCard title="Site & Environmental Overview" id="toc-overview" isH2>
              <p style={{ margin: 0, color: c.text, lineHeight: 1.75, fontSize: 15 }}>{reportData.siteOverview}</p>
            </CollapsibleCard>

            {reportData.zones.map((zone, i) => (
              <ZoneSection key={i} zone={zone} entries={entries} reportData={reportData} id={`toc-zone-${i}`} />
            ))}

            <CollapsibleCard title="Prioritized Action Plan" id="toc-action" isH2>
              <ActionPlanTable items={reportData.actionPlan} />
            </CollapsibleCard>
          </>
        ) : (
          legacySections.map((section, i) => {
            const h2s = legacySections.filter(s => s.type === 'h2');
            const id = section.type === 'h2' ? `toc-${h2s.indexOf(section)}` : undefined;
            return <LegacySection key={i} section={section} entries={entries} id={id} />;
          })
        )}

        <ZoneGuide />

        <div style={{ marginTop: 40, padding: '18px 22px', background: c.surface, border: `1px solid ${c.border}`, borderLeft: `4px solid ${c.tan}`, borderRadius: 10, fontSize: 13, color: c.muted, lineHeight: 1.65 }}>
          This report reflects conditions observed at the time of inspection and is not a guarantee against wildfire damage or loss, nor an official Wildfire Prepared Home designation.
        </div>
      </div>
      </div>
    </div>
  );
}
