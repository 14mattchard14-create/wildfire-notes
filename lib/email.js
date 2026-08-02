// Thin wrapper around Resend's REST API — no SDK needed, just fetch().
// If RESEND_API_KEY isn't set yet, sends are skipped (logged, not thrown)
// so the rest of the app keeps working while email is being set up.

// Splits a comma-separated env var (e.g. NOTIFY_EMAIL="matt@x.com,
// johnny@x.com") into the array form Resend's `to` field accepts, so both
// inspectors get internal alerts from one env var instead of needing a
// second notification path. A single address still works unchanged.
export function parseRecipients(value) {
  if (!value) return null
  const list = value.split(',').map((s) => s.trim()).filter(Boolean)
  return list.length ? list : null
}

export async function sendEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set — skipping email:', subject, '→', to)
    return { skipped: true }
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || 'Field Notes <onboarding@resend.dev>',
        to,
        subject,
        html,
      }),
    })
    if (!res.ok) {
      const body = await res.text()
      console.error('[email] Resend send failed:', res.status, body)
      return { error: body }
    }
    return await res.json()
  } catch (err) {
    console.error('[email] Resend request failed:', err.message)
    return { error: err.message }
  }
}
