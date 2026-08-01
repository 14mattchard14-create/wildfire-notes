import { getAuthedUser, supabaseAdmin } from '@/lib/auth-server'

// Saves/reads report_versions rows — the history behind the review page's
// per-section edit tracking, the "Final Report" checkpoint, and the Report
// Quality portal's A/B export (see supabase/migrations/010_report_versions.sql
// for the shape and what each `source` value means).

export async function POST(request) {
  const { user, profile } = await getAuthedUser(request)
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })
  if (profile.role !== 'employee') return Response.json({ error: 'Inspector account required' }, { status: 403 })

  const { propertyId, reportData, source, section } = await request.json()
  if (!propertyId) return Response.json({ error: 'propertyId is required' }, { status: 400 })
  if (!reportData) return Response.json({ error: 'reportData is required' }, { status: 400 })
  if (!['ai_draft', 'edit', 'final'].includes(source)) return Response.json({ error: 'invalid source' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('report_versions')
    .insert({ property_id: propertyId, report_data: reportData, source, section: section || null, created_by: user.id })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ version: data })
}

export async function GET(request) {
  const { user, profile } = await getAuthedUser(request)
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })
  if (profile.role !== 'employee') return Response.json({ error: 'Inspector account required' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const propertyId = searchParams.get('propertyId')
  const scope = searchParams.get('scope') // 'all' — every source, for the /insights activity log

  // No propertyId — this is either the Report Quality portal asking for
  // every property's A/B-relevant snapshots (the untouched AI draft and any
  // "Final Report" checkpoints), or (with ?scope=all) the /insights
  // activity log asking for the full history including in-between edits —
  // joined with the property address either way so the caller can list
  // them without a second query.
  if (!propertyId) {
    let query = supabaseAdmin
      .from('report_versions')
      .select('id, property_id, report_data, source, section, created_at, properties(address)')
      .order('created_at', { ascending: true })
    if (scope !== 'all') query = query.in('source', ['ai_draft', 'final'])
    const { data, error } = await query
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ versions: data || [] })
  }

  // Single property — full history (every source, every section) for the
  // review page's per-section history popups.
  const { data, error } = await supabaseAdmin
    .from('report_versions')
    .select('id, property_id, report_data, source, section, created_at')
    .eq('property_id', propertyId)
    .order('created_at', { ascending: true })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ versions: data || [] })
}
