import { supabaseAdmin } from '@/lib/auth-server'
import { sendEmail, parseRecipients } from '@/lib/email'

// Runs once a day via Vercel Cron (see vercel.json). Vercel Hobby plan
// only allows one run per day per cron job, with the exact minute
// approximate within the scheduled hour — fine for a daily digest.
//
// "Newly submitted reports" already get an immediate one-off email at
// submission time (app/api/homeowner/finish/route.js). This is the
// follow-up: a daily nudge for anything still sitting unfinished, so a
// missed/bounced immediate email or a report that just falls through the
// cracks doesn't go unnoticed. Sends one digest listing every currently
// stale property — not a running count per property — so it self-corrects
// as soon as a report is published (it just drops off the next day's
// list) instead of needing its own "reminder sent" tracking.

const DEFAULT_REMINDER_DAYS = 2

export async function GET(request) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const notifyEmail = parseRecipients(process.env.NOTIFY_EMAIL)
  if (!notifyEmail) {
    console.warn('[cron/report-reminders] NOTIFY_EMAIL not set — skipping')
    return Response.json({ ok: true, skipped: 'NOTIFY_EMAIL not configured' })
  }

  const reminderDays = Number(process.env.REPORT_REMINDER_DAYS) || DEFAULT_REMINDER_DAYS
  const cutoff = new Date(Date.now() - reminderDays * 24 * 60 * 60 * 1000).toISOString()

  const { data: stale, error } = await supabaseAdmin
    .from('properties')
    .select('id, address, homeowner_submitted_at')
    .eq('homeowner_status', 'submitted')
    .or('report_status.is.null,report_status.eq.draft')
    .lte('homeowner_submitted_at', cutoff)
    .order('homeowner_submitted_at', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!stale?.length) return Response.json({ ok: true, stale: 0 })

  const rows = stale.map((p) => {
    const days = Math.floor((Date.now() - new Date(p.homeowner_submitted_at).getTime()) / (24 * 60 * 60 * 1000))
    return `<li><strong>${p.address}</strong> — submitted ${days} day${days === 1 ? '' : 's'} ago</li>`
  }).join('')

  const result = await sendEmail({
    to: notifyEmail,
    subject: `${stale.length} report${stale.length === 1 ? '' : 's'} still waiting on you`,
    html: `
      <p>These properties finished their walkthrough ${reminderDays}+ days ago and still don't have a published report:</p>
      <ul>${rows}</ul>
      <p>Open Field Notes to pick them up.</p>
    `,
  })

  if (result?.error) return Response.json({ error: result.error }, { status: 502 })
  return Response.json({ ok: true, stale: stale.length })
}
