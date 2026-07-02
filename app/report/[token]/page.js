'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const c = {
  bg: '#E8EDF1', surface: '#FFFFFF', surfaceAlt: '#F3F6F8',
  navy: '#2C4257', slate: '#5C6685', tan: '#A8876D',
  border: '#D6DDE3', text: '#1A2632', muted: '#6B7A8D',
  ok: '#3A7D44', warn: '#B5483A',
};

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

function getRiskLevel(md) {
  const t = (md || '').toLowerCase();
  if (/overall risk rating\s*\n+\*{0,2}very high/m.test(t)) return { level: 'Very High', color: '#B5483A' };
  if (/overall risk rating\s*\n+\*{0,2}severe/m.test(t)) return { level: 'Severe', color: '#8B1A1A' };
  if (/overall risk rating\s*\n+\*{0,2}high/m.test(t)) return { level: 'High', color: '#C0552A' };
  if (/overall risk rating\s*\n+\*{0,2}low/m.test(t)) return { level: 'Low', color: '#3A7D44' };
  return { level: 'Moderate', color: '#E8A020' };
}

function StatusPill({ status }) {
  const map = {
    'Base Compliant':     { bg: '#EAF4EB', color: c.ok,     label: '✓ Base Compliant' },
    'Plus Compliant':     { bg: '#E8F4EA', color: '#2D6E3A', label: '✓✓ Plus Compliant' },
    'Non-Compliant':      { bg: '#FDECEA', color: c.warn,    label: '✗ Non-Compliant' },
    'Needs Verification': { bg: '#FDF6E8', color: '#8A6D3B', label: '? Needs Verification' },
    'Not Applicable':     { bg: '#F0F3F6', color: c.muted,   label: '— Not Applicable' },
  };
  const s = map[status] || { bg: '#F0F3F6', color: c.muted, label: status };
  return <span style={{ background: s.bg, color: s.color, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap' }}>{s.label}</span>;
}

function RiskBadge({ markdown }) {
  const { level, color } = getRiskLevel(markdown);
  const levels = ['Low', 'Moderate', 'High', 'Very High'];
  const idx = Math.max(0, levels.indexOf(level));
  return (
    <div style={{ background: c.surface, border: `2px solid ${c.border}`, borderLeft: `6px solid ${color}`, borderRadius: 12, padding: '20px 28px', display: 'flex', alignItems: 'center', gap: 24, marginBottom: 32 }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: c.muted, textTransform: 'uppercase', marginBottom: 4 }}>Fire Risk Rating</div>
        <div style={{ fontSize: 32, fontWeight: 800, color, lineHeight: 1 }}>{level}</div>
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

function fi(text) {
  return (text || '')
    .replace(/\*\*(.+?)\*\*/g, `<strong style="color:${c.navy};font-weight:700">$1</strong>`)
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, `<a href="$2" target="_blank" rel="noopener" style="color:${c.slate};text-decoration:underline">$1</a>`);
}

function renderLines(lines) {
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

function parseReport(md) {
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

function Section({ section, entries, id, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen !== false);
  const isH2 = section.type === 'h2';
  const zonePhotos = (entries || []).filter(e =>
    e.photo_url && e.zone?.toLowerCase().replace(/[^a-z0-9]/g, '') === section.title?.toLowerCase().replace(/[^a-z0-9]/g, '')
  );
  return (
    <div id={id} style={{ marginBottom: isH2 ? 28 : 16 }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: isH2 ? c.navy : c.surfaceAlt, color: isH2 ? '#fff' : c.navy, border: 'none', borderRadius: isH2 ? (open ? '10px 10px 0 0' : 10) : (open ? '8px 8px 0 0' : 8), padding: isH2 ? '14px 20px' : '10px 16px', cursor: 'pointer', textAlign: 'left' }}>
        <span style={{ fontWeight: 700, fontSize: isH2 ? 16 : 14 }}>{section.title}</span>
        <span style={{ fontSize: 18, opacity: 0.6, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>›</span>
      </button>
      {open && (
        <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderTop: 'none', borderRadius: '0 0 10px 10px', padding: '18px 20px' }}>
          {renderLines(section.lines)}
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
        </div>
      )}
    </div>
  );
}

function TOC({ sections }) {
  const h2s = sections.filter(s => s.type === 'h2');
  return (
    <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderLeft: `4px solid ${c.navy}`, borderRadius: 10, padding: '20px 24px', marginBottom: 32 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: c.navy, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Table of Contents</div>
      <ol style={{ margin: 0, padding: '0 0 0 20px' }}>
        {h2s.map((s, i) => (
          <li key={i} style={{ marginBottom: 6 }}>
            <a href={`#toc-${i}`} style={{ color: c.slate, fontSize: 14, textDecoration: 'none', fontWeight: 500 }} onClick={e => { e.preventDefault(); document.getElementById(`toc-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>{s.title}</a>
          </li>
        ))}
        <li style={{ marginBottom: 6 }}>
          <a href="#zone-guide" style={{ color: c.slate, fontSize: 14, textDecoration: 'none', fontWeight: 500 }} onClick={e => { e.preventDefault(); document.getElementById('zone-guide')?.scrollIntoView({ behavior: 'smooth' }); }}>Understanding the Zones</a>
        </li>
      </ol>
    </div>
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

export default function ReportPage({ params }) {
  const { token } = React.use(params);
  const [stage, setStage] = useState('code');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);

  useEffect(() => {
    const saved = sessionStorage.getItem(`report_access_${token}`);
    if (saved === 'granted') fetchReport();
  }, [token]);

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

  const sections = report ? parseReport(report.report_markdown) : [];
  const entries = report?.entries_snapshot || [];
  let tocIdx = 0;

  if (stage === 'loading') return (
    <div style={{ minHeight: '100vh', background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, border: `3px solid ${c.border}`, borderTop: `3px solid ${c.navy}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
        <div style={{ color: c.slate, fontSize: 14 }}>Loading your report…</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );

  if (stage === 'error') return (
    <div style={{ minHeight: '100vh', background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: c.surface, borderRadius: 16, padding: 40, maxWidth: 400, textAlign: 'center', border: `1px solid ${c.border}` }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
        <div style={{ color: c.navy, fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Report Unavailable</div>
        <div style={{ color: c.muted, fontSize: 14 }}>{error}</div>
      </div>
    </div>
  );

  if (stage === 'code') return (
    <div style={{ minHeight: '100vh', background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
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
    <div style={{ minHeight: '100vh', background: c.bg, fontFamily: 'system-ui, -apple-system, sans-serif', color: c.text }}>
      <div style={{ background: c.navy, color: '#fff' }}>
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

      <div style={{ maxWidth: 820, margin: '0 auto', padding: '32px 24px 80px' }}>
        <div style={{ background: '#FFF8F0', border: `1px solid ${c.tan}`, borderLeft: `4px solid ${c.tan}`, borderRadius: 10, padding: '14px 18px', marginBottom: 28, fontSize: 13, color: c.text, lineHeight: 1.7 }}>
          This report is intended to give homeowners a clear picture of their wildfire risk, while also outlining the gaps that would need to be addressed before the property could successfully obtain{' '}
          <a href="https://wildfireprepared.org/" target="_blank" rel="noopener" style={{ color: c.slate }}>Wildfire Prepared Home certification</a>.
          {' '}Compliance determinations are based on the{' '}
          <a href="https://wildfireprepared.org/wp-content/uploads/WPH-How-To-Prepare-My-Home-Checklist.pdf" target="_blank" rel="noopener" style={{ color: c.slate }}>official WPH checklist</a>.
        </div>

        <RiskBadge markdown={report?.report_markdown || ''} />
        <TOC sections={sections} />

        {sections.map((section, i) => {
          const id = section.type === 'h2' ? `toc-${tocIdx++}` : undefined;
          return <Section key={i} section={section} entries={entries} id={id} />;
        })}

        <ZoneGuide />

        <div style={{ marginTop: 40, padding: '18px 22px', background: c.surface, border: `1px solid ${c.border}`, borderLeft: `4px solid ${c.tan}`, borderRadius: 10, fontSize: 13, color: c.muted, lineHeight: 1.65 }}>
          This report reflects conditions observed at the time of inspection and is not a guarantee against wildfire damage or loss, nor an official Wildfire Prepared Home designation.
        </div>
      </div>
    </div>
  );
}

