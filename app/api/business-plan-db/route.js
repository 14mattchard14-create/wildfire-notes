import { getAuthedUser, supabaseAdmin } from '@/lib/auth-server'
import { replaceSection } from '@/lib/planSchema'

// DB-backed CRUD for the editable business plan — see migration 027 for why
// this exists separately from app/api/business-plan/route.js (which just
// reads the git-tracked file, used only for the one-time "Import from
// business-plan.md" seed action). Everything editable goes through here.

export async function GET(request) {
  const { user, profile } = await getAuthedUser(request)
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })
  if (profile.role !== 'employee') return Response.json({ error: 'Inspector account required' }, { status: 403 })

  const { data: plan, error: planError } = await supabaseAdmin
    .from('business_plan').select('*').order('updated_at', { ascending: false }).limit(1).maybeSingle()
  if (planError) return Response.json({ error: planError.message }, { status: 500 })

  const { data: versions, error: versionsError } = await supabaseAdmin
    .from('business_plan_versions').select('*').order('created_at', { ascending: false }).limit(100)
  if (versionsError) return Response.json({ error: versionsError.message }, { status: 500 })

  return Response.json({ plan: plan || null, versions: versions || [] })
}

export async function POST(request) {
  const { user, profile } = await getAuthedUser(request)
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })
  if (profile.role !== 'employee') return Response.json({ error: 'Inspector account required' }, { status: 403 })

  const body = await request.json()

  if (body.action === 'seed') {
    const { data: existing } = await supabaseAdmin.from('business_plan').select('id').limit(1).maybeSingle()
    if (existing) return Response.json({ error: 'A plan already exists in the database — seeding would overwrite edits. Delete it first if you really want to re-import.' }, { status: 409 })
    if (!body.content) return Response.json({ error: 'content is required' }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from('business_plan').insert({ content: body.content, updated_by: user.id }).select().single()
    if (error) return Response.json({ error: error.message }, { status: 500 })

    await supabaseAdmin.from('business_plan_versions').insert({
      content: body.content, section: null, section_before: null, section_after: null, created_by: user.id,
    })
    return Response.json({ plan: data })
  }

  if (body.action === 'edit') {
    const { heading, newBody } = body
    if (!heading || newBody == null) return Response.json({ error: 'heading and newBody are required' }, { status: 400 })

    const { data: current, error: currentError } = await supabaseAdmin
      .from('business_plan').select('*').order('updated_at', { ascending: false }).limit(1).maybeSingle()
    if (currentError) return Response.json({ error: currentError.message }, { status: 500 })
    if (!current) return Response.json({ error: 'No plan exists yet — import from the file first.' }, { status: 404 })

    let result
    try {
      result = replaceSection(current.content, heading, newBody)
    } catch (err) {
      return Response.json({ error: err.message }, { status: 400 })
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('business_plan').update({ content: result.document, updated_at: new Date().toISOString(), updated_by: user.id }).eq('id', current.id).select().single()
    if (updateError) return Response.json({ error: updateError.message }, { status: 500 })

    const { error: versionError } = await supabaseAdmin.from('business_plan_versions').insert({
      content: result.document, section: heading, section_before: result.before, section_after: result.after, created_by: user.id,
    })
    if (versionError) return Response.json({ error: versionError.message }, { status: 500 })

    return Response.json({ plan: updated })
  }

  return Response.json({ error: `Unknown action "${body.action}"` }, { status: 400 })
}
