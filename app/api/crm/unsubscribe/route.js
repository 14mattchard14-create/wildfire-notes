import { supabaseAdmin } from '@/lib/auth-server'

// Public, unauthenticated — this is the link customers click from inside a
// follow-up email footer. Deliberately keyed off properties.unsubscribe_token
// (a random uuid) rather than the property id, so the link can't be
// guessed/enumerated. Only affects CRM follow-up sends (see
// /api/crm/send-followup) — the one-time "your report is ready" email is
// unaffected, that's transactional, not marketing.

function page(title, message) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
  <style>body{font-family:system-ui,sans-serif;background:#F4EFE6;color:#172431;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;}
  .card{background:#fff;border-radius:12px;padding:32px 28px;max-width:420px;box-shadow:0 4px 24px rgba(0,0,0,0.08);text-align:center;}
  h1{font-size:18px;margin:0 0 10px;}p{font-size:14px;color:#5b6b7a;line-height:1.6;margin:0;}</style>
  </head><body><div class="card"><h1>${title}</h1><p>${message}</p></div></body></html>`
}

export async function GET(request) {
  const token = new URL(request.url).searchParams.get('token')
  if (!token) return new Response(page('Link not valid', 'This unsubscribe link is missing its token.'), { status: 400, headers: { 'Content-Type': 'text/html' } })

  const { data: property } = await supabaseAdmin
    .from('properties')
    .select('id, unsubscribed')
    .eq('unsubscribe_token', token)
    .maybeSingle()

  if (!property) return new Response(page('Link not valid', "We couldn't find a matching subscription for this link."), { status: 404, headers: { 'Content-Type': 'text/html' } })

  if (!property.unsubscribed) {
    await supabaseAdmin
      .from('properties')
      .update({ unsubscribed: true, unsubscribed_at: new Date().toISOString() })
      .eq('id', property.id)
  }

  return new Response(page("You're unsubscribed", "You won't receive any more follow-up emails from us. If this was a mistake, just reply to any previous email or give us a call and we'll add you back."), { headers: { 'Content-Type': 'text/html' } })
}
