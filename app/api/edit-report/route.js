import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// POST /api/edit-report
// action: 'republish' — save updated markdown to existing token
// action: 'rewrite-section' — ask Claude to rewrite one section, return new markdown
export async function POST(request) {
  try {
    const { action, token, markdown, sectionTitle, instructions } = await request.json();

    if (action === 'republish') {
      if (!token || !markdown) return Response.json({ error: 'Missing token or markdown' }, { status: 400 });

      const { error } = await supabase
        .from('shared_reports')
        .update({ report_markdown: markdown })
        .eq('token', token);

      if (error) return Response.json({ error: 'Failed to update report' }, { status: 500 });
      return Response.json({ ok: true });
    }

    if (action === 'rewrite-section') {
      if (!markdown || !sectionTitle || !instructions) {
        return Response.json({ error: 'Missing required fields' }, { status: 400 });
      }

      // Extract the section from the markdown
      const lines = markdown.split('\n');
      let sectionStart = -1;
      let sectionEnd = lines.length;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if ((line.startsWith('## ') || line.startsWith('### ')) && line.includes(sectionTitle)) {
          sectionStart = i;
        } else if (sectionStart !== -1 && i > sectionStart && (line.startsWith('## ') || line.startsWith('### '))) {
          sectionEnd = i;
          break;
        }
      }

      if (sectionStart === -1) {
        return Response.json({ error: `Section "${sectionTitle}" not found in report` }, { status: 400 });
      }

      const sectionContent = lines.slice(sectionStart, sectionEnd).join('\n');
      const heading = lines[sectionStart];

      const prompt = `You are an expert wildfire risk assessor editing a section of a client-facing inspection report.

Here is the current section:
---
${sectionContent}
---

Rewrite this section based on the following instructions from the inspector:
"${instructions}"

Rules:
- Keep the same markdown heading (${heading})
- Keep the same overall structure (tables, bullet lists, etc.) unless the instructions say to change it
- Only rewrite the content, not the format
- Be professional and specific
- Do not add a preamble or explanation — return only the rewritten section content

Return ONLY the rewritten section, starting with the heading.`;

      const aiResponse = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      });

      const rewrittenSection = aiResponse.content[0].text.trim();

      // Replace the section in the full markdown
      const newLines = [
        ...lines.slice(0, sectionStart),
        ...rewrittenSection.split('\n'),
        ...lines.slice(sectionEnd),
      ];

      return Response.json({ markdown: newLines.join('\n') });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('Edit report error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

