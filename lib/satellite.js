// Shared helpers for reading properties.satellite_analysis — used by both
// GuidedEntry.js (client, shows it per-segment during the walkthrough) and
// report-draft/route.js (server, folds it into report generation context).
// Kept dependency-free so it works in both environments.

export function parseSatellite(raw) {
  if (!raw) return null
  if (typeof raw === 'object') return raw
  try { return JSON.parse(raw) } catch { return { overview: raw } }
}

// Segment values are usually plain strings, but a couple of earlier
// formats stored { text, x, y } objects — handle both so old saved
// analyses still read correctly.
export function getAreaText(satellite, key) {
  const v = satellite?.[key]
  if (!v) return ''
  return typeof v === 'string' ? v : (v.text || '')
}
