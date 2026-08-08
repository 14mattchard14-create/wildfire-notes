import { getAuthedUser, supabaseAdmin } from '@/lib/auth-server'

// Comments on the business plan (migration 027 for the table, migration
// 028 for the `quote` column). Every comment belongs to a section
// (heading string); most also carry `quote` — the exact plain text the
// user had selected when they left it, captured client-side from
// window.getSelection(). The Plan page re-finds that text inside the
// section's current rendered HTML to draw a clickable highlight, Word/
// Google-Docs style. `quote` is nullable so old section-level comments
// (predating that feature) still work, just without a highlight.

export async function GET(request) {
  const { user, profile } = await getAuthedUser(request)
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })
  if (profile.role !== 'employee') return Response.json({ error: 'Inspector account required' }, { status: 403 })

  const { data, error } = await supabaseAdmin
    .from('business_plan_comments').select('*').order('created_at', { ascending: true })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ comments: data || [] })
}

export async function POST(request) {
  const { user, profile } = await getAuthedUser(request)
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })
  if (profile.role !== 'employee') return Response.json({ error: 'Inspector account required' }, { status: 403 })

  const { section, body: commentBody, quote } = await request.json()
  if (!section) return Response.json({ error: 'section is required' }, { status: 400 })
  if (!commentBody || !commentBody.trim()) return Response.json({ error: 'body is required' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('business_plan_comments')
    .insert({ section, body: commentBody.trim(), quote: quote?.trim() || null, created_by: user.id })
    .select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ comment: data })
}

export async function PATCH(request) {
  const { user, profile } = await getAuthedUser(request)
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })
  if (profile.role !== 'employee') return Response.json({ error: 'Inspector account required' }, { status: 403 })

  const { id, resolved } = await request.json()
  if (!id) return Response.json({ error: 'id is required' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('business_plan_comments').update({ resolved: !!resolved }).eq('id', id).select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ comment: data })
}

export async function DELETE(request) {
  const { user, profile } = await getAuthedUser(request)
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })
  if (profile.role !== 'employee') return Response.json({ error: 'Inspector account required' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return Response.json({ error: 'id is required' }, { status: 400 })

  const { error } = await supabaseAdmin.from('business_plan_comments').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
