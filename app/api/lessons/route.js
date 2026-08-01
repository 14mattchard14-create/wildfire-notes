import { getAuthedUser, supabaseAdmin } from '@/lib/auth-server'

// Reads/writes report_lessons — the freeform "lessons learned" notes
// browsable on the /quality page's Lessons Learned tab (see
// supabase/migrations/011_report_lessons.sql).

export async function GET(request) {
  const { user, profile } = await getAuthedUser(request)
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })
  if (profile.role !== 'employee') return Response.json({ error: 'Inspector account required' }, { status: 403 })

  const { data, error } = await supabaseAdmin
    .from('report_lessons')
    .select('id, property_id, note, created_by_name, applied, applied_at, created_at, properties(address)')
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ lessons: data || [] })
}

export async function POST(request) {
  const { user, profile } = await getAuthedUser(request)
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })
  if (profile.role !== 'employee') return Response.json({ error: 'Inspector account required' }, { status: 403 })

  const { note, propertyId } = await request.json()
  if (!note?.trim()) return Response.json({ error: 'note is required' }, { status: 400 })

  const userName = user.user_metadata?.full_name || user.email || 'Unknown'
  const { data, error } = await supabaseAdmin
    .from('report_lessons')
    .insert({ note: note.trim(), property_id: propertyId || null, created_by: user.id, created_by_name: userName })
    .select('id, property_id, note, created_by_name, applied, applied_at, created_at')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ lesson: data })
}
