import { readFile } from 'fs/promises'
import path from 'path'
import { getAuthedUser } from '@/lib/auth-server'

// Serves business/business-plan.md straight from the repo (source of truth
// is the git-tracked file, not a database copy) so /business/plan always
// shows exactly what's committed — no separate content to keep in sync.
// Read-only for now: this is "so I can review it," not editing/commenting/
// version control, which would need its own design pass (see README.md's
// note on why git was chosen over a DB-backed doc in the first place).
const PLAN_PATH = path.join(process.cwd(), 'business', 'business-plan.md')

export async function GET(request) {
  const { user, profile } = await getAuthedUser(request)
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })
  if (profile.role !== 'employee') return Response.json({ error: 'Inspector account required' }, { status: 403 })

  try {
    const [content, stat] = await Promise.all([
      readFile(PLAN_PATH, 'utf8'),
      import('fs/promises').then(fs => fs.stat(PLAN_PATH)),
    ])
    return Response.json({ content, updatedAt: stat.mtime })
  } catch (err) {
    console.error('[business-plan] read failed:', err.message)
    return Response.json({ error: 'Could not read business-plan.md — has it moved or been renamed?' }, { status: 500 })
  }
}
