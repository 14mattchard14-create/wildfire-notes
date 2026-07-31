import { randomBytes } from 'crypto'
import { getAuthedUser, supabaseAdmin } from '@/lib/auth-server'

function generateToken() { return randomBytes(20).toString('hex') }

export async function POST(request) {
  try {
    const { user, profile } = await getAuthedUser(request)
    if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })
    if (profile.role !== 'employee') return Response.json({ error: 'Only inspectors can invite homeowners' }, { status: 403 })

    const { propertyId, email } = await request.json()
    if (!propertyId) return Response.json({ error: 'propertyId is required' }, { status: 400 })
    const normalizedEmail = (email || '').trim().toLowerCase()
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      return Response.json({ error: 'A valid homeowner email is required' }, { status: 400 })
    }

    const { data: property } = await supabaseAdmin.from('properties').select('id').eq('id', propertyId).maybeSingle()
    if (!property) return Response.json({ error: 'Property not found' }, { status: 404 })

    const token = generateToken()
    const { error } = await supabaseAdmin.from('homeowner_invites').insert({
      token, property_id: propertyId, created_by: user.id, email: normalizedEmail,
    })
    if (error) return Response.json({ error: error.message }, { status: 500 })

    // Only move to 'invited' if this property hasn't already progressed
    // further (e.g. re-sending an invite shouldn't reset an in-progress
    // or submitted walkthrough back to square one).
    await supabaseAdmin
      .from('properties')
      .update({ homeowner_status: 'invited' })
      .eq('id', propertyId)
      .is('homeowner_status', null)

    return Response.json({ token })
  } catch (err) {
    console.error('homeowner-invite error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
