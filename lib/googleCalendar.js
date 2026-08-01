// Google Calendar "quick add" link builder — deliberately not the Google
// Calendar API. This opens Google's own pre-filled "add event" page for the
// person to review and save with one click. No OAuth, no token storage, no
// backend integration, and it works for anyone regardless of which Google
// account they're signed into. See BOOKING_PAYMENTS_PLAN.md decision 2 for
// why this was chosen over building real two-way sync.

function two(n) { return String(n).padStart(2, '0') }

// All-day event, for a plain YYYY-MM-DD date (e.g. a follow-up's due_date,
// which has no time component). Google's all-day format needs the end date
// to be exclusive (the day *after*), or a one-day event renders as zero
// days long.
function allDayRange(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`)
  const end = new Date(d)
  end.setDate(end.getDate() + 1)
  const fmt = x => `${x.getFullYear()}${two(x.getMonth() + 1)}${two(x.getDate())}`
  return `${fmt(d)}/${fmt(end)}`
}

// Timed event, for a full ISO datetime (e.g. intro_call_at). Defaults to a
// 30-minute block if no explicit end is given.
function timedRange(startIso, minutes = 30) {
  const start = new Date(startIso)
  const end = new Date(start.getTime() + minutes * 60000)
  const fmt = x => `${x.getUTCFullYear()}${two(x.getUTCMonth() + 1)}${two(x.getUTCDate())}T${two(x.getUTCHours())}${two(x.getUTCMinutes())}00Z`
  return `${fmt(start)}/${fmt(end)}`
}

export function googleCalendarLink({ title, date, datetime, minutes, details, location }) {
  const params = new URLSearchParams({ action: 'TEMPLATE', text: title || 'Reminder' })
  if (datetime) params.set('dates', timedRange(datetime, minutes))
  else if (date) params.set('dates', allDayRange(date))
  if (details) params.set('details', details)
  if (location) params.set('location', location)
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}
