import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { randomBytes } from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function generateToken() { return randomBytes(16).toString('hex'); }
function generateAccessCode() { return Math.floor(100000 + Math.random() * 900000).toString(); }

const ZONE_GUIDE = [
  { title: 'Overall Site', body: 'A whole-property view of wildfire exposure, factoring in slope, prevailing wind, fuel load, and how neighboring properties could contribute to fire spread toward or away from the home.' },
  { title: '0-5 FT. Noncombustible Zone', body: 'The most critical area around the home. The first five feet surrounding the home and attached features must be completely noncombustible — bare mineral soil or hardscape only, with no vegetation, mulch, or combustible items.' },
  { title: '5-30 FT. Defensible Space - Vegetation', body: 'A fuel-reduction zone that slows fire spread before it reaches the home. Trees and shrubs must be properly spaced and pruned, grass kept short, dead vegetation removed, and firewood stored well away from the structure.' },
  { title: '10-30 FT. Defensible Space - Detached Structures & Other Large Items', body: 'Sheds, pergolas, hot tubs, outdoor kitchens, and fuel/water storage tanks within 30 ft of the home each carry their own placement, spacing, and material requirements to prevent them from acting as fire bridges to the structure.' },
  { title: 'Roof', body: 'The roof covering must be Class A fire-rated and kept free of debris — wood roofs and plastic corrugated panels are never permitted, since the roof is one of the most common paths for ember ignition.' },
  { title: 'Gutters', body: 'Gutters and downspouts must be noncombustible and kept clear of debris, since dry leaves and needles trapped in gutters are a common ember ignition point.' },
  { title: '6-Inch Noncombustible Wall Clearance', body: 'A 6-inch noncombustible buffer at the base of exterior walls, deck posts, and stairs prevents ground-level embers and flames from reaching combustible wall materials.' },
  { title: 'Vents', body: 'Roof, attic, eave, and under-home vents are major ember entry points and require flame/ember-resistant construction or 1/8-inch corrosion-resistant mesh. Dryer vents need a functional flap instead, since mesh traps lint.' },
  { title: 'Eaves & Soffits', body: 'The exposed underside of roof eaves can trap rising embers and heat; enclosing or protecting this area with noncombustible material is a key upgrade for ember resistance.' },
  { title: 'Skylights', body: 'Plastic dome skylights are vulnerable to radiant heat; flat, multi-pane tempered-glass skylights with mesh-protected operable vents are far more fire-resistant.' },
  { title: 'Exterior Wall Coverings / Siding', body: 'Full noncombustible siding (brick, stucco, fiber-cement, metal) provides much stronger protection against direct flame contact and radiant heat.' },
  { title: 'Exterior Windows', body: 'Tempered double-pane glass resists breaking under radiant heat — broken windows are a common way embers and flame enter a home\'s interior during a wildfire.' },
  { title: 'Exterior Doors', body: 'Solid-core or noncombustible doors with tempered glass panes and noncombustible thresholds resist ignition better than hollow or thin wood doors.' },
  { title: 'Decks, Patios & Overhead Structures', body: 'Decks and patios near the home need their own ember-resistant zone, noncombustible bases at posts/stairs, and (for Plus) fully noncombustible walking surfaces and railings.' },
  { title: 'Access & Address', body: 'Ensures fire crews can find and reach the property quickly — visible address numbers and a clear, navigable driveway/access route are essential during an active wildfire response.' },
];

export async function POST(request) {
  try {
    const { fieldNotes, property, inspectorName, entries, siteNotes } = await request.json();

    if (!property || !fieldNotes) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const entriesList = (entries || []).map(e =>
      `- [${e.zone}] ${e.status}: ${e.note || ''}${e.detail ? ' — ' + e.detail : ''}${e.photo_url ? ' [HAS_PHOTO]' : ''}`
    ).join('\n');

    // Call 1: Generate AI photo captions
    let captionMap = {};
    const entriesWithPhotos = (entries || []).filter(e => e.photo_url);
    if (entriesWithPhotos.length > 0) {
      const captionPrompt = `You are a wildfire inspector writing professional photo captions for a client report.
For each photo entry below, write a single concise caption (1 sentence, max 15 words) describing what the photo shows and why it matters for wildfire risk.
Return ONLY a JSON object mapping the entry id to the caption. Example: {"id1": "caption here", "id2": "caption here"}

Entries with photos:
${entriesWithPhotos.map(e => `id: ${e.id}\nzone: ${e.zone}\nstatus: ${e.status}\nnote: ${e.note || ''}\ndetail: ${e.detail || ''}`).join('\n---\n')}`;

      try {
        const captionResp = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 1000,
          messages: [{ role: 'user', content: captionPrompt }],
        });
        const raw = captionResp.content[0].text.replace(/```json|```/g, '').trim();
        captionMap = JSON.parse(raw);
      } catch (e) {
        console.error('Caption generation failed:', e);
      }
    }

    // Attach captions to entries
    const enrichedEntries = (entries || []).map(e => ({
      ...e,
      ai_caption: captionMap[e.id] || e.note || '',
    }));

    // Call 2: Generate full structured report
    const prompt = `You are an expert wildfire risk assessor writing a formal client-facing report. Use ONLY the field notes provided. Do not invent data.

Property: ${property.address}
Inspector: ${inspectorName || 'Inspector'}
Visit Date: ${property.visit_date || 'Not recorded'}
FHSZ: ${property.fhsz || 'Not determined'}

FIELD NOTES:
${fieldNotes}

ENTRIES (${(entries||[]).length} logged):
${entriesList}

Generate a complete report in this EXACT markdown structure. Do not add extra sections or change headings.

## EXECUTIVE SUMMARY

### Overall Risk Rating
[Single word or phrase: Low / Moderate / High / Very High]

### Summary Narrative
[2-4 sentences: biggest risks, notable strengths, overall assessment]

### Top Priorities
1. [Most urgent action]
2. [Second priority]
3. [Third priority]

### WPH Designation Snapshot
- Base (Essential): [X of Y assessed categories meet Base requirements. List non-compliant categories.]
- Plus (Enhanced): [X categories meet Plus Compliant status. Note if Base must be met first.]

## SITE & ENVIRONMENTAL OVERVIEW
[3-5 sentences covering: location context, FHSZ status, surrounding fuel load, primary ignition pathways, local fire agency if mentioned in notes]

## FINDINGS BY CATEGORY

For each zone that has entries, use this format:

### [Zone Name]

| Category | Finding | Status |
|---|---|---|
[One row per entry in this zone]

**Recommendations:**
- [Actionable recommendation based on non-compliant/verify findings]

## PRIORITIZED ACTION PLAN

| # | Action | Zone | Priority |
|---|---|---|---|
[All recommendations ranked by urgency, non-compliant first]

## DISCLAIMER
This report reflects conditions observed on the date of assessment and is intended to provide risk-reduction guidance. It is not a guarantee against wildfire damage or loss, nor an official Wildfire Prepared Home designation. This report is intended to give homeowners a clear picture of their wildfire risk, while also outlining the gaps that would need to be addressed before the property could successfully obtain Wildfire Prepared Home certification (https://wildfireprepared.org/), should the owner wish to pursue certification; compliance and non-compliance determinations throughout this report are based on the Wildfire Prepared Home criteria, as outlined in the official checklist (https://wildfireprepared.org/wp-content/uploads/WPH-How-To-Prepare-My-Home-Checklist.pdf).`;

    const aiResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    });

    const reportMarkdown = aiResponse.content[0].text;
    const token = generateToken();
    const accessCode = generateAccessCode();

    const { error } = await supabase
      .from('shared_reports')
      .insert({
        property_id: property.id || null,
        token,
        access_code: accessCode,
        report_markdown: reportMarkdown,
        inspector_name: inspectorName || null,
        property_address: property.address,
        visit_date: property.visit_date || null,
        entries_snapshot: enrichedEntries,
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

