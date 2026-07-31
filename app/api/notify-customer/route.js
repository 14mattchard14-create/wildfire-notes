import { getAuthedUser } from '@/lib/auth-server'
import { notifyCustomerReportReady } from '@/lib/customerNotify'

// Manual "Send / Resend to Customer" button in the Report tab — same
// underlying send as the automatic first-publish email, callable anytime
// (e.g. the auto-send failed, or the inspector wants to remind the
// homeowner the report is available).

export async function POST(request) {
  const { user, profile } = await getAuthedUser(request)
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })
  if (profile.role !== 'employee') return Response.json({ error: 'Inspector account required' }, { status: 403 })

  const { propertyId } = await request.json()
  if (!propertyId) return Response.json({ error: 'propertyId is required' }, { status: 400 })

  const origin = new URL(request.url).origin
  const result = await notifyCustomerReportReady({ propertyId, origin })

  if (!result.sent) return Response.json({ error: result.reason || 'Send failed' }, { status: 400 })
  return Response.json(result)
}
