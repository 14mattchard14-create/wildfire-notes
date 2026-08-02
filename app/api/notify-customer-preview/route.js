import { getAuthedUser } from '@/lib/auth-server'
import { buildCustomerNotifyPreview } from '@/lib/customerNotify'

// Read-only companion to /api/notify-customer — builds the exact email
// (subject, HTML body, recipient, report link, access code) without
// sending it or touching the DB, so the review page can show the
// inspector precisely what's about to go out before they confirm.

export async function POST(request) {
  const { user, profile } = await getAuthedUser(request)
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })
  if (profile.role !== 'employee') return Response.json({ error: 'Inspector account required' }, { status: 403 })

  const { propertyId } = await request.json()
  if (!propertyId) return Response.json({ error: 'propertyId is required' }, { status: 400 })

  const origin = new URL(request.url).origin
  const preview = await buildCustomerNotifyPreview({ propertyId, origin })

  if (!preview.ok) return Response.json({ error: preview.reason }, { status: 400 })
  return Response.json(preview)
}
