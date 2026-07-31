// Summarized from the official Wildfire Prepared Home How-To Prepare Checklist
// wildfireprepared.org/wp-content/uploads/WPH-How-To-Prepare-My-Home-Checklist.pdf

export const CRITERIA_INFO = {
  'Other': {
    base: [
      'For findings that don\'t fit neatly into another WPH category — note the specific item, material, or condition observed, and reference the closest applicable WPH requirement if known.',
    ],
    plus: [
      'No standalone Plus requirement — use this category only when no other zone applies.',
    ],
  },
  'Roof': {
    base: [
      'Must have a Class A fire-rated covering — asphalt shingles, concrete or clay tile, slate, or metal. Wood roofs and plastic corrugated panels are not allowed.',
      'Barrel tile or corrugated metal roofs with open gaps need noncombustible bird stops at the edges to block ember entry.',
      'Roof must be kept routinely clear of leaves, needles, and other vegetative debris.',
    ],
    plus: [
      'No additional roof-covering requirement at Plus — enhancements at this level focus on eaves/soffits, skylights, and gutters.',
    ],
  },
  'Gutters': {
    base: [
      'Gutters and downspouts must be noncombustible (e.g. metal/aluminum). Plastic downspout extensions are fine for diverting water away from the foundation.',
      'Gutters and downspouts must be kept clear of vegetative debris.',
    ],
    plus: [
      'Noncombustible gutter guards must be installed to prevent debris buildup, on top of the Base material requirement.',
    ],
  },
  'Vents': {
    base: [
      'Roof, attic gable, eave/soffit, and under-home vents need flame- and ember-resistant construction, or a covering of 1/8-inch corrosion-resistant metal mesh.',
      'Mesh openings must be 1/8 inch or smaller — as a rough check, a pencil tip or golf tee shaft should not pass through.',
      'Dryer and other exhaust vents need a functional louver or flap; metal mesh is not permitted on these since it traps lint and creates a hazard.',
    ],
    plus: [
      'Dryer and other exhaust vents must also be made of noncombustible material (e.g. metal), in addition to the Base louver/flap requirement.',
    ],
  },
  'Eaves & Soffits': {
    base: [
      'Not called out as a standalone Base requirement — ember protection at eaves is primarily addressed at the Plus level.',
    ],
    plus: [
      'Exposed undersides of eaves must be enclosed or protected with noncombustible material such as fiber-cement or stucco.',
      'Any soffit vents installed must be flame/ember-resistant, or covered with 1/8-inch corrosion-resistant metal mesh.',
    ],
  },
  'Skylights': {
    base: [
      'Not called out as a standalone Base requirement — addressed at the Plus level.',
    ],
    plus: [
      'Plastic dome skylights must be replaced with flat, multi-pane skylights featuring a tempered glass outer pane and laminated inner pane.',
      'Operable skylights must be protected with 1/8-inch corrosion-resistant metal mesh.',
    ],
  },
  '6-Inch Noncombustible Wall Clearance': {
    base: [
      'At least 6 inches of noncombustible material required at the base of exterior walls, and above any attached deck or patio surface.',
      'Acceptable materials: exposed concrete foundation, fiber-cement siding, brick, stone, stucco, or metal flashing.',
      'Same 6-inch base requirement applies to combustible deck posts and stairs.',
    ],
    plus: [
      'No additional requirement beyond Base — this is fully addressed at the Base level. Siding material itself is upgraded separately under Exterior Wall Coverings.',
    ],
  },
  'Exterior Wall Coverings / Siding': {
    base: [
      'No standalone Base requirement for the full wall surface — only the 6-inch base clearance applies at Base level.',
    ],
    plus: [
      'All exterior wall coverings must be fully noncombustible (brick, concrete, fiber-cement, masonry veneer, metal, or stucco).',
      'Vinyl, wood siding, engineered wood, and similar wood-based products are not allowed, even if treated or coated.',
      'Shutters, decorative or operable, must also be noncombustible.',
      'Underfloor areas and projections (e.g. bay windows, homes on piers) must be enclosed or covered with noncombustible material.',
    ],
  },
  'Exterior Windows': {
    base: [
      'Not called out as a standalone Base requirement — addressed at the Plus level.',
    ],
    plus: [
      'Exterior windows need at least two panes of tempered glass with visible corner etching on both panes, or glass-block construction.',
    ],
  },
  'Exterior Doors': {
    base: [
      'Not called out as a standalone Base requirement — addressed at the Plus level.',
    ],
    plus: [
      'Exterior doors must be noncombustible material or solid-core wood at least 1¾ inches thick, with a noncombustible threshold.',
      'Glass within a door must also be two-pane tempered glass. A noncombustible storm door over an existing door is an accepted alternative.',
    ],
  },
  'Decks, Patios & Overhead Structures': {
    base: [
      'Any structure over 15 sq ft within 30 ft of the home needs its own 0–5 ft noncombustible zone, extending beneath elevated portions.',
      'Walking surfaces must stay clear of debris; combustible furniture must be removed/replaced within 5 ft of the home and on combustible decks generally.',
      'Underneath elevated decks/sheds: no storage, 6-inch noncombustible base at posts, and metal-mesh enclosure for decks 4 ft or less off the ground.',
      'Pergola roofs: combustible slats limited to 15% total coverage. Solid-covered structures need a Class A roof.',
    ],
    plus: [
      'Decks within 30 ft must be either fully noncombustible new construction, or a retrofit with solid noncombustible walking surface, noncombustible railings near the home, 6-inch noncombustible post/stair bases, and solid noncombustible stair treads and risers.',
    ],
  },
  '0-5 FT. Noncombustible Zone': {
    base: [
      'All vegetation removed down to bare mineral soil, no exceptions — applies even to irrigated or fire-resistant-labeled plants. Overhanging branches and trees removed too.',
      'Combustible groundcover (mulch, pine needles, artificial turf) is not allowed — use gravel, pavers, river rock, decomposed granite, or concrete.',
      'Wood or vinyl fencing within 5 ft must be replaced with noncombustible material (e.g. metal). Vehicles, equipment, and combustible items (furniture, firewood, rugs) must be removed.',
      'Extends vertically — no vegetation or combustible materials allowed within or above this zone.',
    ],
    plus: [
      'No additional vegetation requirement at Plus — enhancements at this level focus on structures and building materials within the broader 30 ft area.',
    ],
  },
  '5-30 FT. Defensible Space - Vegetation': {
    base: [
      '6 ft vertical clearance under tree canopies (or 1/3 of tree height for trees under 18 ft), 10 ft horizontal clearance between continuous vegetation and the home.',
      'Grass kept under 4 inches (up to 18 inches on slopes for erosion control); dead/dying vegetation regularly removed.',
      'Shrub clusters capped at 10 ft wide, with spacing based on plant height (minimum 2x the tallest plant\'s height, max 10 ft).',
      'Firewood stored at least 30 ft from the home, unless in an approved accessory structure.',
    ],
    plus: [
      'No additional vegetation requirement at Plus — enhancements at this level focus on structures and building materials.',
    ],
  },
  '10-30 FT. Defensible Space - Detached Structures & Other Large Items': {
    base: [
      'Maximum of 3 detached structures within 30 ft of the home; each must be placed at least 10 ft from the home and other structures.',
      'Each structure over 15 sq ft needs its own 0–5 ft noncombustible zone, including beneath elevated portions.',
      'Hot tubs: at least 10 ft from the home, not under combustible overhead structures, with a noncombustible zone around the installation.',
      'Outdoor kitchens/built-ins: noncombustible countertops; 6-inch noncombustible base where cabinets are combustible.',
      'LPG/fuel tanks: 30 ft from the home, or 10 ft with extended clearance requirements out to 20 ft.',
      'Combustible water storage tanks: at least 5 ft from the home, with a noncombustible zone beneath and around it.',
    ],
    plus: [
      'All detached structures (sheds, pergolas, playsets, garages, ADUs) must be relocated at least 30 ft from the home.',
      'Combustible fences running back-to-back and less than 5 ft apart, within 30 ft of the home, must be removed or have one side replaced with noncombustible material.',
    ],
  },
  'Address Visibility': {
    base: [
      'Not addressed in the WPH checklist — typically governed by local fire code or jurisdiction requirements rather than WPH certification itself.',
    ],
    plus: ['Not addressed in the WPH checklist.'],
  },
  'Driveway / Access': {
    base: [
      'Not addressed in the WPH checklist — typically governed by local fire code or evacuation route requirements.',
    ],
    plus: ['Not addressed in the WPH checklist.'],
  },
}

// Zones map directly to the official WPH report structure:
// Defensible Space (0-5ft, 5-30ft, Structures/Other) -> Building Features (Roof, Vents, Siding, etc.) -> Access
export const ZONES = [
  'Overall Site',
  '0-5 FT. Noncombustible Zone',
  '5-30 FT. Defensible Space - Vegetation',
  '10-30 FT. Defensible Space - Detached Structures & Other Large Items',
  'Roof',
  'Gutters',
  '6-Inch Noncombustible Wall Clearance',
  'Vents',
  'Eaves & Soffits',
  'Skylights',
  'Exterior Wall Coverings / Siding',
  'Exterior Windows',
  'Exterior Doors',
  'Decks, Patios & Overhead Structures',
  'Access & Address',
  'Other',
]

export const CATEGORIES = [
  'Roof',
  'Gutters',
  'Vents',
  'Eaves & Soffits',
  'Skylights',
  '6-Inch Noncombustible Wall Clearance',
  'Exterior Wall Coverings / Siding',
  'Exterior Windows',
  'Exterior Doors',
  'Decks, Patios & Overhead Structures',
  'Fencing',
  '0-5 FT. Noncombustible Zone',
  '5-30 FT. Defensible Space - Vegetation',
  '10-30 FT. Defensible Space - Detached Structures & Other Large Items',
  'Address Visibility',
  'Driveway / Access',
  'Other',
]

export const STATUSES = [
  { value: 'Base Compliant',     label: 'Base ✓',  color: 'green'  },
  { value: 'Plus Compliant',     label: 'Plus ✓',  color: 'green'  },
  { value: 'Non-Compliant',      label: 'Non-Comp.', color: 'red'    },
  { value: 'Needs Verification', label: 'Verify',  color: 'blue'   },
  { value: 'Not Applicable',     label: 'N/A',     color: 'gray'   },
]

export const WPH_SOURCE_URL = 'https://wildfireprepared.org/wp-content/uploads/WPH-How-To-Prepare-My-Home-Checklist.pdf'

// Guided Entry — location-first walkthrough. Organized by physical segment
// (the order a person actually walks a property) rather than by WPH
// category, since a homeowner/inspector can have different findings on
// different sides of the house for the same category. Each item still
// carries a `zone` matching the ZONES list above, so entries created here
// slot into the exact same report-grouping logic as manually-added entries.
//
// Each segment can optionally carry a `wholeSidePhoto: true` flag — those
// segments prompt for one overview photo of the whole side at the end,
// which feeds the per-segment AI gap-analysis call (/api/segment-analysis).
export const GUIDED_SEGMENTS = [
  {
    key: 'front',
    label: 'Front of House',
    instructions: 'Stand at the street and work your way toward the house. Cover the front wall, front entry, street-facing address, and everything at the eave line above this side.',
    wholeSidePhoto: true,
    notePlaceholder: 'Anything on this side that doesn’t fit the checklist above — material notes, conditions, additional context…',
    items: [
      { label: 'Front — 0-5 ft zone', zone: '0-5 FT. Noncombustible Zone', hint: 'Vegetation, mulch, fencing, or combustible items within 5 ft of the front wall.' },
      { label: 'Front — 6" wall clearance', zone: '6-Inch Noncombustible Wall Clearance', hint: 'Material at the base of the front wall.' },
      { label: 'Front — siding', zone: 'Exterior Wall Coverings / Siding', hint: 'Siding material on the front of the home.' },
      { label: 'Front — windows', zone: 'Exterior Windows', hint: 'Look for visible tempered glass etching in the corner.' },
      { label: 'Main entry door', zone: 'Exterior Doors', hint: 'Material and thickness of the front door.' },
      { label: 'Address visibility', zone: 'Access & Address', hint: 'Are the address numbers clearly visible from the street?' },
      { label: 'Front — vents', zone: 'Vents', hint: 'Any roof, gable, eave/soffit, or dryer vents visible on this side — mesh presence/size.' },
      { label: 'Front — gutters & downspouts', zone: 'Gutters', hint: 'Confirm metal vs. plastic/vinyl, and check for debris, along this side.' },
      { label: 'Front — eaves & soffits', zone: 'Eaves & Soffits', hint: 'Enclosed vs. exposed underside condition along this side.' },
      { label: 'Front — decks/patio (if present)', zone: 'Decks, Patios & Overhead Structures', hint: 'Walking surface, railings, and underneath-deck condition, if present on this side.' },
    ],
  },
  {
    key: 'left',
    label: 'Left Side',
    instructions: 'Walk the left exterior wall from front to back, including everything at the eave line above it.',
    wholeSidePhoto: true,
    notePlaceholder: 'Anything on this side that doesn’t fit the checklist above — material notes, conditions, additional context…',
    items: [
      { label: 'Left side — 0-5 ft zone', zone: '0-5 FT. Noncombustible Zone', hint: 'Vegetation, mulch, fencing, or combustible items within 5 ft of the left wall.' },
      { label: 'Left side — 6" wall clearance', zone: '6-Inch Noncombustible Wall Clearance', hint: 'Material at the base of the left wall.' },
      { label: 'Left side — siding', zone: 'Exterior Wall Coverings / Siding', hint: 'Siding material on the left side of the home.' },
      { label: 'Left side — windows', zone: 'Exterior Windows', hint: 'Any windows along this side.' },
      { label: 'Side door (if present)', zone: 'Exterior Doors', hint: 'Material and thickness, if this side has an exterior door.' },
      { label: 'Left side — vents', zone: 'Vents', hint: 'Any roof, gable, eave/soffit, or dryer vents visible on this side — mesh presence/size.' },
      { label: 'Left side — gutters & downspouts', zone: 'Gutters', hint: 'Confirm metal vs. plastic/vinyl, and check for debris, along this side.' },
      { label: 'Left side — eaves & soffits', zone: 'Eaves & Soffits', hint: 'Enclosed vs. exposed underside condition along this side.' },
      { label: 'Left side — decks/patio (if present)', zone: 'Decks, Patios & Overhead Structures', hint: 'Walking surface, railings, and underneath-deck condition, if present on this side.' },
    ],
  },
  {
    key: 'right',
    label: 'Right Side',
    instructions: 'Walk the right exterior wall from front to back, including everything at the eave line above it.',
    wholeSidePhoto: true,
    notePlaceholder: 'Anything on this side that doesn’t fit the checklist above — material notes, conditions, additional context…',
    items: [
      { label: 'Right side — 0-5 ft zone', zone: '0-5 FT. Noncombustible Zone', hint: 'Vegetation, mulch, fencing, or combustible items within 5 ft of the right wall.' },
      { label: 'Right side — 6" wall clearance', zone: '6-Inch Noncombustible Wall Clearance', hint: 'Material at the base of the right wall.' },
      { label: 'Right side — siding', zone: 'Exterior Wall Coverings / Siding', hint: 'Siding material on the right side of the home.' },
      { label: 'Right side — windows', zone: 'Exterior Windows', hint: 'Any windows along this side.' },
      { label: 'Side door (if present)', zone: 'Exterior Doors', hint: 'Material and thickness, if this side has an exterior door.' },
      { label: 'Right side — vents', zone: 'Vents', hint: 'Any roof, gable, eave/soffit, or dryer vents visible on this side — mesh presence/size.' },
      { label: 'Right side — gutters & downspouts', zone: 'Gutters', hint: 'Confirm metal vs. plastic/vinyl, and check for debris, along this side.' },
      { label: 'Right side — eaves & soffits', zone: 'Eaves & Soffits', hint: 'Enclosed vs. exposed underside condition along this side.' },
      { label: 'Right side — decks/patio (if present)', zone: 'Decks, Patios & Overhead Structures', hint: 'Walking surface, railings, and underneath-deck condition, if present on this side.' },
    ],
  },
  {
    key: 'back',
    label: 'Back of House',
    instructions: 'Cover the rear wall, back entry, any decks or patios, and everything at the eave line above this side.',
    wholeSidePhoto: true,
    notePlaceholder: 'Anything on this side that doesn’t fit the checklist above — material notes, conditions, additional context…',
    items: [
      { label: 'Back — 0-5 ft zone', zone: '0-5 FT. Noncombustible Zone', hint: 'Vegetation, mulch, fencing, or combustible items within 5 ft of the back wall.' },
      { label: 'Back — 6" wall clearance', zone: '6-Inch Noncombustible Wall Clearance', hint: 'Material at the base of the back wall, including deck posts/stairs.' },
      { label: 'Back — siding', zone: 'Exterior Wall Coverings / Siding', hint: 'Siding material on the back of the home.' },
      { label: 'Back — windows', zone: 'Exterior Windows', hint: 'Any windows along the back.' },
      { label: 'Back door', zone: 'Exterior Doors', hint: 'Material and thickness of the back/patio door.' },
      { label: 'Back — decks/patio (if present)', zone: 'Decks, Patios & Overhead Structures', hint: 'Walking surface, railings, and underneath-deck condition, if present.' },
      { label: 'Back — vents', zone: 'Vents', hint: 'Any roof, gable, eave/soffit, or dryer vents visible on this side — mesh presence/size.' },
      { label: 'Back — gutters & downspouts', zone: 'Gutters', hint: 'Confirm metal vs. plastic/vinyl, and check for debris, along this side.' },
      { label: 'Back — eaves & soffits', zone: 'Eaves & Soffits', hint: 'Enclosed vs. exposed underside condition along this side.' },
    ],
  },
  {
    key: 'overhead',
    label: 'Overhead',
    instructions: 'What’s left after walking all four sides — the roof itself and any skylights. Gutters, vents, and eaves are now checked per side as you walk, since they can differ from one side to the next.',
    wholeSidePhoto: true,
    notePlaceholder: 'Roof condition, debris buildup, skylight details, or anything else overhead not captured above…',
    items: [
      { label: 'Roof covering', zone: 'Roof', hint: 'Material type — shingle, tile, metal — and overall condition, plus any debris buildup.' },
      { label: 'Skylights (if present)', zone: 'Skylights', hint: 'Dome vs. flat/multi-pane construction.' },
    ],
  },
  {
    key: 'veg_zone',
    label: '5-30 FT Defensible Space — Vegetation',
    instructions: 'Photograph vegetation, tree spacing, and ground cover from 5-30 ft out.',
    wholeSidePhoto: true,
    notePlaceholder: 'Tree spacing/pruning, dead vegetation, firewood storage, or other vegetation notes…',
    items: [
      { label: 'Tree canopy clearance', zone: '5-30 FT. Defensible Space - Vegetation', hint: 'Vertical clearance from ground to lowest branches.' },
      { label: 'Shrub spacing / clusters', zone: '5-30 FT. Defensible Space - Vegetation', hint: 'Spacing between shrub groupings.' },
      { label: 'Grass / groundcover condition', zone: '5-30 FT. Defensible Space - Vegetation', hint: 'Height and dryness of grass or groundcover.' },
      { label: 'Firewood storage (if present)', zone: '5-30 FT. Defensible Space - Vegetation', hint: 'Distance from the home.' },
    ],
  },
  {
    key: 'structures_zone',
    label: '10-30 FT Structures & Other Items',
    instructions: 'Photograph any sheds, pergolas, hot tubs, tanks, or other large items within 30 ft.',
    wholeSidePhoto: true,
    notePlaceholder: 'Placement, materials, spacing from the home, or other notes on detached structures/items…',
    items: [
      { label: 'Each detached structure', zone: '10-30 FT. Defensible Space - Detached Structures & Other Large Items', hint: 'Shed, pergola, garage, ADU — note placement and spacing from the home.' },
      { label: 'Hot tub / outdoor kitchen (if present)', zone: '10-30 FT. Defensible Space - Detached Structures & Other Large Items', hint: 'Distance from home and surrounding materials.' },
      { label: 'LPG/fuel tank or water tank (if present)', zone: '10-30 FT. Defensible Space - Detached Structures & Other Large Items', hint: 'Distance from home and clearance area.' },
    ],
  },
]

// Overall Site is deliberately NOT part of the GUIDED_SEGMENTS walkthrough
// order — it's folded into the Satellite Overview step instead, along with
// Access & Driveway (both happen before you start walking the house, and
// pair naturally with the overhead scan / wide property shots). Exported
// separately so GuidedEntry.js can merge them into that first step, and so
// the satellite-analysis API's per-category prompt doesn't also ask about
// them as distinct categories (the "overview" field already covers this).
export const OVERALL_SITE_SEGMENT = {
  key: 'overall_site',
  label: 'Overall Site',
  instructions: 'Step back and capture the whole property, its surroundings, and the driveway/access route. No whole-property photo/gap-check needed here — the satellite scan above already covers that.',
  wholeSidePhoto: false,
  notePlaceholder: 'Slope/topography, prevailing wind, surrounding vegetation/neighbors, general conflagration risk, driveway/access condition…',
  items: [
    { label: 'Front of property from the street', zone: 'Overall Site', hint: 'Wide shot showing the home, driveway, and street-facing vegetation.' },
    { label: 'Surrounding terrain / slope', zone: 'Overall Site', hint: 'Capture any hillside, slope direction, or notable topography.' },
    { label: 'Neighboring properties', zone: 'Overall Site', hint: 'Any adjacent structures or vegetation that could contribute to fire spread toward this home.' },
    { label: 'Driveway / access route', zone: 'Access & Address', hint: 'Width and condition for emergency vehicle access.' },
    { label: 'Primary siding material', zone: 'Exterior Wall Coverings / Siding', hint: 'One general note on the home’s main siding material/type, before you look at each side up close.' },
  ],
}

// Site Notes used to be a standalone tab with the 15 sections above, saved
// to a `site_notes` table keyed only by property_id. That's now folded into
// Guided Entry as one freeform notes box per segment (see `notePlaceholder`
// on each GUIDED_SEGMENTS entry and OVERALL_SITE_SEGMENT above), saved to
// guided_segments.notes instead — see migration 009.
