import Anthropic from '@anthropic-ai/sdk'
import { getAuthedUser } from '@/lib/auth-server'

// Turns a plain-English description of a growth scenario ("P1 works
// evenings at 12 hrs/wk all year on audits, ramps hardening from month 3;
// P2 joins full-time at 40 hrs/wk starting month 6...") into the 12-month
// `monthly` array the Forecast tab's table expects — so filling out a
// scenario doesn't mean hand-typing 7 numbers x 12 months every time.
// Mirrors app/api/report-draft/route.js's model/parsing conventions.

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const FIELDS = ['audits', 'self', 'hardening', 'p1Hours', 'p2Hours', 'ph1Hours', 'ph2Hours']

const SYSTEM_PROMPT = `You turn a plain-English description of a wildfire-inspection business's staffing/growth plan into a 12-month numeric schedule.

Schema per month (all integers, >= 0):
- audits: number of $500 on-site audits completed that month
- self: number of $200 guided self-inspections completed that month
- hardening: number of hardening add-on jobs completed that month
- p1Hours: Person 1's hours/week spent on audits + self-inspections
- p2Hours: Person 2's hours/week spent on audits + self-inspections (0 if Person 2 doesn't exist yet that month)
- ph1Hours: Person 1's hours/week spent specifically on hardening jobs (separate time block from p1Hours — a person's inspection hours and hardening hours don't share one pool)
- ph2Hours: Person 2's hours/week spent specifically on hardening jobs

Two worked examples of the description -> monthly-array mapping this business actually uses:

Example A — description: "Both people part-time (evenings/weekends) through month 5. At month 6, once volume justifies it, P2 quits their job and goes full-time while P1 stays part-time. P1 handles hardening jobs on the side throughout; P2 picks up hardening capacity too once full-time."
-> monthly: [
{"audits":1,"self":1,"hardening":0,"p1Hours":12,"p2Hours":12,"ph1Hours":6,"ph2Hours":0},
{"audits":2,"self":1,"hardening":0,"p1Hours":12,"p2Hours":12,"ph1Hours":6,"ph2Hours":0},
{"audits":2,"self":2,"hardening":1,"p1Hours":12,"p2Hours":12,"ph1Hours":6,"ph2Hours":0},
{"audits":3,"self":2,"hardening":1,"p1Hours":12,"p2Hours":12,"ph1Hours":6,"ph2Hours":0},
{"audits":3,"self":2,"hardening":1,"p1Hours":12,"p2Hours":12,"ph1Hours":6,"ph2Hours":0},
{"audits":6,"self":3,"hardening":2,"p1Hours":12,"p2Hours":40,"ph1Hours":6,"ph2Hours":15},
{"audits":8,"self":4,"hardening":3,"p1Hours":12,"p2Hours":40,"ph1Hours":6,"ph2Hours":15},
{"audits":9,"self":4,"hardening":4,"p1Hours":12,"p2Hours":40,"ph1Hours":6,"ph2Hours":15},
{"audits":10,"self":5,"hardening":4,"p1Hours":12,"p2Hours":40,"ph1Hours":6,"ph2Hours":15},
{"audits":11,"self":5,"hardening":5,"p1Hours":12,"p2Hours":40,"ph1Hours":6,"ph2Hours":15},
{"audits":12,"self":6,"hardening":5,"p1Hours":12,"p2Hours":40,"ph1Hours":6,"ph2Hours":15},
{"audits":13,"self":6,"hardening":6,"p1Hours":12,"p2Hours":40,"ph1Hours":6,"ph2Hours":15}]

Example B — description: "Permanent, P1 only, flat capacity all year — evenings/weekends only, no assumption it ever grows into something bigger. P1 covers hardening jobs out of the same weekend block."
-> monthly: [
{"audits":1,"self":1,"hardening":0,"p1Hours":12,"p2Hours":0,"ph1Hours":6,"ph2Hours":0},
{"audits":1,"self":1,"hardening":0,"p1Hours":12,"p2Hours":0,"ph1Hours":6,"ph2Hours":0},
{"audits":2,"self":1,"hardening":1,"p1Hours":12,"p2Hours":0,"ph1Hours":6,"ph2Hours":0},
{"audits":2,"self":1,"hardening":1,"p1Hours":12,"p2Hours":0,"ph1Hours":6,"ph2Hours":0},
{"audits":2,"self":2,"hardening":1,"p1Hours":12,"p2Hours":0,"ph1Hours":6,"ph2Hours":0},
{"audits":2,"self":2,"hardening":1,"p1Hours":12,"p2Hours":0,"ph1Hours":6,"ph2Hours":0},
{"audits":3,"self":2,"hardening":1,"p1Hours":12,"p2Hours":0,"ph1Hours":6,"ph2Hours":0},
{"audits":3,"self":2,"hardening":1,"p1Hours":12,"p2Hours":0,"ph1Hours":6,"ph2Hours":0},
{"audits":4,"self":2,"hardening":1,"p1Hours":12,"p2Hours":0,"ph1Hours":6,"ph2Hours":0},
{"audits":4,"self":2,"hardening":1,"p1Hours":12,"p2Hours":0,"ph1Hours":6,"ph2Hours":0},
{"audits":4,"self":2,"hardening":1,"p1Hours":12,"p2Hours":0,"ph1Hours":6,"ph2Hours":0},
{"audits":4,"self":3,"hardening":1,"p1Hours":12,"p2Hours":0,"ph1Hours":6,"ph2Hours":0}]

Notice the pattern: job counts (audits/self/hardening) ramp up gradually as a natural consequence of more hours/marketing/word-of-mouth over time — they don't jump straight to a plateau, and they stay realistic relative to the hours available that month (a person working 12 hrs/wk part-time on inspections can't suddenly do 12 audits in a month — each audit takes hoursPerAudit hours, so check the volume is achievable within the stated weekly hours x ~4.33 weeks/month).

You will be given the CURRENT 12-month array (JSON) and the business's assumptions (prices, hours per job type) as context, plus a description of what the user wants. If the description describes the whole year from scratch, replace all 12 months. If it only describes a change to part of the plan (e.g. "just bump P2 to 40 hours starting month 6"), keep every other month's values exactly as given in the CURRENT array and only change what the description implies.

Respond with ONLY a JSON object of the exact shape {"monthly": [ {...} x12 ]} — no prose, no markdown fences, no explanation.`

export async function POST(request) {
  const { user, profile } = await getAuthedUser(request)
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })
  if (profile.role !== 'employee') return Response.json({ error: 'Inspector account required' }, { status: 403 })

  const { description, currentMonthly, assumptions } = await request.json()
  if (!description || !description.trim()) return Response.json({ error: 'description is required' }, { status: 400 })
  if (!Array.isArray(currentMonthly) || currentMonthly.length !== 12) {
    return Response.json({ error: 'currentMonthly must be a 12-month array' }, { status: 400 })
  }

  const userPrompt = `CURRENT 12-month array:\n${JSON.stringify(currentMonthly)}\n\nAssumptions (for realism-checking volume against available hours):\n${JSON.stringify(assumptions)}\n\nDescription of what to set:\n${description.trim()}`

  let aiResponse
  try {
    aiResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    })
  } catch (err) {
    console.error('forecast-fill generation error:', err)
    return Response.json({ error: 'Generation failed: ' + err.message }, { status: 502 })
  }

  const raw = aiResponse.content[0].text
  let parsed
  try {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
    parsed = JSON.parse((fenced ? fenced[1] : raw).trim())
  } catch (err) {
    console.error('forecast-fill JSON parse error:', err, '— raw:', raw)
    return Response.json({ error: "The AI response wasn't valid JSON — try rephrasing or generating again." }, { status: 502 })
  }

  if (!Array.isArray(parsed?.monthly) || parsed.monthly.length !== 12) {
    console.error('forecast-fill: wrong shape from AI:', parsed)
    return Response.json({ error: 'The AI returned the wrong number of months — try again.' }, { status: 502 })
  }

  // Coerce/clamp rather than trust the model's numeric formatting verbatim —
  // same defensive stance as report-draft's positional photo matching.
  const monthly = parsed.monthly.map(m => {
    const clean = {}
    for (const f of FIELDS) {
      const n = Number(m?.[f])
      clean[f] = Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0
    }
    return clean
  })

  return Response.json({ monthly })
}
