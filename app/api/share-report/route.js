import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { randomBytes } from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function generateToken() {
  return randomBytes(16).toString('hex');
}

function generateAccessCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request) {
  try {
    const { fieldNotes, property, inspectorName, entries, siteNotes } = await request.json();

    if (!property || !fieldNotes) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Build the prompt for the shareable report markdown
    const prompt = `You are a professional wildfire home hardening inspector writing a client-facing report.

Property: ${property.address}
Inspector: ${inspectorName || 'Inspector'}
Visit Date: ${property.visit_date || 'Recent Visit'}
Fire Hazard Severity Zone: ${property.fhsz || 'Not determined'}

Field Notes:
${fieldNotes}

${entries && entries.length > 0 ? `Inspection Entries (${entries.length} items logged):
${entries.map(e => `- [${e.zone}] ${e.status}: ${e.note || ''}${e.detail ? ' — ' + e.detail : ''}`).join('\n')}` : ''}

${siteNotes ? `Site Notes:
${Object.entries(siteNotes).filter(([k, v]) => v && !['id','property_id','updated_at'].includes(k)).map(([k, v]) => `${k.replace(/_/g,' ')}: ${v}`).join('\n')}` : ''}

Write a professional, client-friendly wildfire inspection report in Markdown. Structure it as follows:

1. Start with a brief executive summary paragraph (2-3 sentences, reassuring but honest tone).
2. Add a "## Risk Overview" section with a plain-language risk rating (Low / Moderate / High / Very High) and a 2-3 sentence explanation.
3. Add "## Findings by Zone" — one subsection per zone that had entries, using ### for zone headings. Under each zone, briefly describe what was found and the compliance status. Use **bold** for non-compliant items.
4. Add "## Priority Recommendations" — a numbered list of the top 3-5 action items the homeowner should address, most urgent first.
5. Add "## What Happens Next" — a short friendly paragraph explaining the inspector will follow up and the homeowner can reach out with questions.

Keep the tone professional but warm — this is going directly to the homeowner. Avoid jargon. Use plain language. Do not use the word "utilize". Do not include any preamble before the report.`;

    const aiResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const reportMarkdown = aiResponse.content[0].text;
    const token = generateToken();
    const accessCode = generateAccessCode();

    // Save to Supabase
    const { data, error } = await supabase
      .from('shared_reports')
      .insert({
        property_id: property.id || null,
        token,
        access_code: accessCode,
        report_markdown: reportMarkdown,
        inspector_name: inspectorName || null,
        property_address: property.address,
        visit_date: property.visit_date || null,
        entries_snapshot: entries || [],
      })
      .select('token')
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      return Response.json({ error: 'Failed to save report' }, { status: 500 });
    }

    return Response.json({ token, accessCode });
  } catch (err) {
    console.error('Share report error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
