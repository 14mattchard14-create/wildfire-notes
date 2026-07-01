// ============================================================
// PATCH FOR ExportPanel.js
// Add this to your existing ExportPanel component.
// Do NOT replace the file — add these pieces alongside what's there.
// ============================================================

// 1. ADD these state variables near your other useState declarations:
const [shareLoading, setShareLoading] = useState(false);
const [shareResult, setShareResult] = useState(null); // { token, accessCode }
const [shareError, setShareError] = useState('');
const [copyLabel, setCopyLabel] = useState('Copy Link');

// 2. ADD this function alongside your existing handleExport/handleDocx function:
async function handleGenerateShareLink() {
  setShareLoading(true);
  setShareError('');
  setShareResult(null);

  try {
    const res = await fetch('/api/share-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fieldNotes,        // same fieldNotes you pass to the DOCX route
        property,          // the current property object
        inspectorName,     // inspector name string
        entries,           // entries array
        siteNotes,         // site notes object (if available)
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to generate link');
    }

    const data = await res.json();
    setShareResult(data);
  } catch (err) {
    setShareError(err.message);
  } finally {
    setShareLoading(false);
  }
}

function handleCopyLink() {
  const url = `${window.location.origin}/report/${shareResult.token}`;
  navigator.clipboard.writeText(url);
  setCopyLabel('Copied!');
  setTimeout(() => setCopyLabel('Copy Link'), 2000);
}

// 3. ADD this JSX block in your return statement, 
//    right below (or above) your existing DOCX export button section:

// ----- PASTE THIS JSX -----
/*
<div style={{
  borderTop: '1px solid #3a352f',
  marginTop: 24,
  paddingTop: 24,
}}>
  <div style={{ fontSize: 13, fontWeight: 700, color: '#ece6db', marginBottom: 6 }}>
    Shareable Web Report
  </div>
  <div style={{ fontSize: 12, color: '#9a9285', marginBottom: 16, lineHeight: 1.5 }}>
    Generate a private link + 6-digit access code to share a live web report with your client.
  </div>

  <button
    onClick={handleGenerateShareLink}
    disabled={shareLoading || !property}
    style={{
      width: '100%',
      padding: '11px 16px',
      background: shareLoading ? '#3a352f' : '#be5b1d',
      color: '#ece6db',
      border: 'none',
      borderRadius: 8,
      fontSize: 13,
      fontWeight: 700,
      cursor: shareLoading || !property ? 'not-allowed' : 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      opacity: !property ? 0.5 : 1,
    }}
  >
    {shareLoading ? (
      <>
        <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid #9a9285', borderTop: '2px solid #ece6db', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        Generating…
      </>
    ) : '🔗 Generate Shareable Link'}
  </button>

  {shareError && (
    <div style={{ marginTop: 10, padding: '10px 14px', background: '#2c1a18', border: '1px solid #b5483a', borderRadius: 8, fontSize: 12, color: '#e07060' }}>
      {shareError}
    </div>
  )}

  {shareResult && (
    <div style={{ marginTop: 16, background: '#1e2820', border: '1px solid #3a5e42', borderRadius: 10, padding: '16px 18px' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#8ec99a', marginBottom: 12, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        ✓ Report Ready
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: '#9a9285', marginBottom: 4 }}>Access Code (share separately)</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#ece6db', letterSpacing: '0.2em', fontVariantNumeric: 'tabular-nums' }}>
          {shareResult.accessCode}
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: '#9a9285', marginBottom: 6 }}>Report Link</div>
        <div style={{
          background: '#242220',
          border: '1px solid #3a352f',
          borderRadius: 6,
          padding: '8px 12px',
          fontSize: 12,
          color: '#9a9285',
          wordBreak: 'break-all',
          fontFamily: 'monospace',
        }}>
          {typeof window !== 'undefined' ? `${window.location.origin}/report/${shareResult.token}` : `/report/${shareResult.token}`}
        </div>
      </div>

      <button
        onClick={handleCopyLink}
        style={{
          width: '100%',
          padding: '9px',
          background: copyLabel === 'Copied!' ? '#3a5e42' : '#3a352f',
          color: '#ece6db',
          border: '1px solid #4a453f',
          borderRadius: 7,
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        {copyLabel}
      </button>
    </div>
  )}
</div>
*/
// ----- END JSX -----
