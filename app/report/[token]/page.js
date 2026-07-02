'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const c = {
  bg: '#E8EDF1',
  surface: '#FFFFFF',
  surfaceAlt: '#F3F6F8',
  navy: '#2C4257',
  slate: '#5C6685',
  tan: '#A8876D',
  border: '#D6DDE3',
  text: '#1A2632',
  muted: '#6B7A8D',
  ok: '#3A7D44',
  warn: '#B5483A',
  info: '#5C6685',
  verify: '#8A6D3B',
};

function RiskBadge({ markdown }) {
  let level = 'Moderate';
  let color = '#E8A020';
  const lower = markdown.toLowerCase();
  if (lower.includes('very high risk') || lower.includes('very high')) { level = 'Very High'; color = c.warn; }
  else if (lower.includes('high risk') || lower.includes('high')) { level = 'High'; color = '#C0552A'; }
  else if (lower.includes('low risk') || lower.includes('low')) { level = c.ok; color = c.ok; level = 'Low'; }
  else if (lower.includes('moderate risk') || lower.includes('moderate')) { level = 'Moderate'; color = '#E8A020'; }

  const levels = ['Low', 'Moderate', 'High', 'Very High'];
  const idx = levels.indexOf(level);

  return (
    <div style={{
      background: c.surface,
      border: `2px solid ${c.border}`,
      borderLeft: `5px solid ${color}`,
      borderRadius: 12,
      padding: '20px 28px',
      display: 'flex',
      alignItems: 'center',
      gap: 24,
      marginBottom: 32,
    }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: c.muted, textTransform: 'uppercase', marginBottom: 4 }}>Fire Risk Rating</div>
        <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{level}</div>
      </div>
      <div style={{ flex: 1, display: 'flex', gap: 6, alignItems: 'center' }}>
        {levels.map((l, i) => (
          <div key={l} style={{ flex: 1 }}>
            <div style={{
              height: 8,
              borderRadius: 4,
              background: i <= idx ? color : c.border,
              opacity: i <= idx ? (0.4 + (i / levels.length) * 0.6) : 1,
              transition: 'background 0.3s',
            }} />
            <div style={{ fontSize: 9, color: c.muted, textAlign: 'center', marginTop: 4, fontWeight: i === idx ? 700 : 400 }}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    'Base Compliant': { bg: '#EAF4EB', color: c.ok, label: '✓ Base Compliant' },
    'Plus Compliant': { bg: '#E8F4EA', color: '#2D6E3A', label: '✓✓ Plus Compliant' },
    'Non-Compliant': { bg: '#FDECEA', color: c.warn, label: '✗ Non-Compliant' },
    'Needs Verification': { bg: '#FDF6E8', color: '#8A6D3B', label: '? Needs Verification' },
    'Not Applicable': { bg: '#F0F3F6', color: c.muted, label: '— Not Applicable' },
  };
  const s = map[status] || { bg: '#F0F3F6', color: c.muted, label: status };
  return (
    <span style={{
      background: s.bg,
      color: s.color,
      fontSize: 11,
      fontWeight: 700,
      padding: '3px 10px',
      borderRadius: 20,
      letterSpacing: '0.03em',
      whiteSpace: 'nowrap',
    }}>{s.label}</span>
  );
}

function parseMarkdown(md) {
  if (!md) return [];
  const sections = [];
  let current = null;
  const lines = md.split('\n');

  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (current) sections.push(current);
      current = { type: 'h2', title: line.replace('## ', ''), content: [] };
    } else if (line.startsWith('### ')) {
      if (current) sections.push(current);
      current = { type: 'h3', title: line.replace('### ', ''), content: [] };
    } else if (current) {
      current.content.push(line);
    } else {
      if (!sections.length || sections[sections.length - 1].type !== 'intro') {
        sections.push({ type: 'intro', content: [] });
      }
      sections[sections.length - 1].content.push(line);
    }
  }
  if (current) sections.push(current);
  return sections;
}

function renderContent(lines) {
  const elements = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    if (/^\d+\.\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ''));
        i++;
      }
      elements.push(
        <ol key={i} style={{ margin: '8px 0 16px 0', paddingLeft: 24 }}>
          {items.map((item, j) => (
            <li key={j} style={{ marginBottom: 8, color: c.text, lineHeight: 1.65, fontSize: 15 }}
              dangerouslySetInnerHTML={{ __html: formatInline(item) }} />
          ))}
        </ol>
      );
    } else if (/^[-*]\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s/, ''));
        i++;
      }
      elements.push(
        <ul key={i} style={{ margin: '8px 0 16px 0', paddingLeft: 24 }}>
          {items.map((item, j) => (
            <li key={j} style={{ marginBottom: 6, color: c.text, lineHeight: 1.65, fontSize: 15 }}
              dangerouslySetInnerHTML={{ __html: formatInline(item) }} />
          ))}
        </ul>
      );
    } else {
      elements.push(
        <p key={i} style={{ margin: '0 0 14px 0', color: c.text, lineHeight: 1.75, fontSize: 15 }}
          dangerouslySetInnerHTML={{ __html: formatInline(line) }} />
      );
      i++;
    }
  }
  return elements;
}

function formatInline(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, `<strong style="color:${c.navy};font-weight:700">$1</strong>`)
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}

function ReportSection({ section, entries }) {
  const [open, setOpen] = useState(true);
  const zoneEntries = entries?.filter(e =>
    e.zone?.toLowerCase().replace(/[^a-z0-9]/g, '') ===
    section.title?.toLowerCase().replace(/[^a-z0-9]/g, '')
  ) || [];

  if (section.type === 'intro') {
    return (
      <div style={{ marginBottom: 28 }}>
        {renderContent(section.content)}
      </div>
    );
  }

  const isH2 = section.type === 'h2';

  return (
    <div style={{ marginBottom: isH2 ? 32 : 20 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: isH2 ? c.navy : c.surfaceAlt,
          color: isH2 ? '#fff' : c.navy,
          border: 'none',
          borderRadius: isH2 ? 10 : 8,
          padding: isH2 ? '14px 20px' : '10px 16px',
          cursor: 'pointer',
          textAlign: 'left',
          marginBottom: open ? 0 : 0,
        }}
      >
        <span style={{ fontWeight: 700, fontSize: isH2 ? 17 : 15 }}>{section.title}</span>
        <span style={{ fontSize: 18, opacity: 0.7, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>›</span>
      </button>

      {open && (
        <div style={{
          background: c.surface,
          border: `1px solid ${c.border}`,
          borderTop: 'none',
          borderRadius: '0 0 10px 10px',
          padding: '18px 20px',
        }}>
          {renderContent(section.content)}

          {zoneEntries.length > 0 && (
            <div style={{ marginTop: 16 }}>
              {zoneEntries.map((entry, i) => (
                <div key={i} style={{
                  background: c.surfaceAlt,
                  border: `1px solid ${c.border}`,
                  borderLeft: `4px solid ${entry.status === 'Non-Compliant' ? c.warn : entry.status?.includes('Compliant') ? c.ok : c.slate}`,
                  borderRadius: 8,
                  padding: '12px 16px',
                  marginBottom: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, color: c.text, lineHeight: 1.5 }}>{entry.note}</div>
                      {entry.detail && <div style={{ fontSize: 13, color: c.muted, marginTop: 4 }}>{entry.detail}</div>}
                    </div>
                    <StatusPill status={entry.status} />
                  </div>
                  {entry.photo_url && (
                    <img
                      src={entry.photo_url}
                      alt="Inspection photo"
                      style={{ width: '100%', maxWidth: 480, borderRadius: 8, marginTop: 4, border: `1px solid ${c.border}` }}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ReportPage({ params }) {
  const { token } = params;
  const [stage, setStage] = useState('code'); // 'code' | 'loading' | 'report' | 'error'
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);

  useEffect(() => {
    const saved = sessionStorage.getItem(`report_access_${token}`);
    if (saved === 'granted') fetchReport();
  }, [token]);

  async function fetchReport() {
    setStage('loading');
    const { data, error } = await supabase
      .from('shared_reports')
      .select('*')
      .eq('token', token)
      .single();

    if (error || !data) {
      setStage('error');
      setError('Report not found. The link may be invalid or expired.');
      return;
    }
    setReport(data);
    setStage('report');
  }

  async function handleSubmitCode(e) {
    e.preventDefault();
    setError('');
    setStage('loading');

    const { data, error: dbErr } = await supabase
      .from('shared_reports')
      .select('access_code')
      .eq('token', token)
      .single();

    if (dbErr || !data) {
      setStage('code');
      setError('Report not found. Check your link.');
      return;
    }

    if (code.trim() !== data.access_code) {
      setStage('code');
      setError('Incorrect access code. Please try again.');
      return;
    }

    sessionStorage.setItem(`report_access_${token}`, 'granted');
    fetchReport();
  }

  const sections = report ? parseMarkdown(report.report_markdown) : [];
  const entries = report?.entries_snapshot || [];

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
          <div style={{ width: 40, height: 40, background: c.navy, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 20 }}>🔥</span>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: c.muted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Wildfire Inspection</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: c.navy }}>Your Property Report</div>
          </div>
        </div>

        <p style={{ color: c.muted, fontSize: 14, lineHeight: 1.6, marginBottom: 28 }}>
          Your inspector shared this report with you privately. Enter the 6-digit access code they provided to view it.
        </p>

        <form onSubmit={handleSubmitCode}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: c.slate, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
            Access Code
          </label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
            style={{
              width: '100%',
              padding: '14px 16px',
              fontSize: 24,
              letterSpacing: '0.3em',
              textAlign: 'center',
              border: `2px solid ${error ? c.warn : c.border}`,
              borderRadius: 10,
              outline: 'none',
              color: c.navy,
              fontWeight: 700,
              background: c.bg,
              boxSizing: 'border-box',
              marginBottom: error ? 8 : 20,
            }}
            autoFocus
          />
          {error && <div style={{ color: c.warn, fontSize: 13, marginBottom: 16 }}>{error}</div>}
          <button
            type="submit"
            disabled={code.length !== 6}
            style={{
              width: '100%',
              padding: '14px',
              background: code.length === 6 ? c.navy : c.border,
              color: code.length === 6 ? '#fff' : c.muted,
              border: 'none',
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 700,
              cursor: code.length === 6 ? 'pointer' : 'not-allowed',
              transition: 'background 0.2s',
            }}
          >
            View Report
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: c.bg, fontFamily: 'system-ui, -apple-system, sans-serif', color: c.text }}>
      {/* Header */}
      <div style={{ background: c.navy, color: '#fff', padding: '0' }}>
        <div style={{ maxWidth: 780, margin: '0 auto', padding: '24px 24px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <span style={{ fontSize: 22 }}>🔥</span>
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.7 }}>Wildfire Inspection Report</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: '0 0 6px', lineHeight: 1.2 }}>
            {report?.property_address}
          </h1>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', paddingBottom: 24, borderBottom: `1px solid rgba(255,255,255,0.15)` }}>
            {report?.visit_date && (
              <div style={{ fontSize: 13, opacity: 0.75 }}>
                <span style={{ opacity: 0.6 }}>Inspection Date </span>{report.visit_date}
              </div>
            )}
            {report?.inspector_name && (
              <div style={{ fontSize: 13, opacity: 0.75 }}>
                <span style={{ opacity: 0.6 }}>Inspector </span>{report.inspector_name}
              </div>
            )}
          </div>
        </div>

        {/* Tan accent strip */}
        <div style={{ height: 5, background: `linear-gradient(90deg, ${c.tan}, ${c.slate})` }} />
      </div>

      {/* Body */}
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '32px 24px 64px' }}>
        <RiskBadge markdown={report?.report_markdown || ''} />

        {sections.map((section, i) => (
          <ReportSection key={i} section={section} entries={entries} />
        ))}

        {/* Footer */}
        <div style={{
          marginTop: 48,
          padding: '20px 24px',
          background: c.surface,
          border: `1px solid ${c.border}`,
          borderLeft: `4px solid ${c.tan}`,
          borderRadius: 10,
          fontSize: 13,
          color: c.muted,
          lineHeight: 1.6,
        }}>
          This report was prepared by a certified wildfire home hardening inspector and reflects conditions observed at the time of inspection. It is intended for informational purposes only and does not constitute a guarantee of fire safety.
        </div>
      </div>
    </div>
  );
}

