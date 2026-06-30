// Summarized from the official Wildfire Prepared Home How-To Prepare Checklist
// wildfireprepared.org/wp-content/uploads/WPH-How-To-Prepare-My-Home-Checklist.pdf

export const CRITERIA_INFO = {
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
  '0–5 Ft Noncombustible Zone': {
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
  '5–30 Ft Defensible Space': {
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
  'Detached Structures & Other Large Items': {
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
  '0–5 Ft Noncombustible Zone',
  '5–30 Ft Defensible Space',
  'Detached Structures & Other Large Items',
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
  '0–5 Ft Noncombustible Zone',
  '5–30 Ft Defensible Space',
  'Detached Structures & Other Large Items',
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

// Site Notes categories — these power the dedicated "Site Notes" tab where the
// inspector records freeform observations per WPH section. The AI then summarizes
// these into polished narrative for the corresponding report section.
export const SITE_NOTE_SECTIONS = [
  {
    key: 'overall_site',
    label: 'Overall Site & Surrounding Environment',
    placeholder: 'Slope/topography, prevailing wind, surrounding vegetation/neighbors within ~1 mile, general conflagration risk…',
  },
  {
    key: 'zone_0',
    label: '0–5 Ft Noncombustible Zone',
    placeholder: 'Vegetation, groundcover, fencing, vehicles/equipment, combustible items observed within 5 ft of the home…',
  },
  {
    key: 'zone_5_30',
    label: '5–30 Ft Defensible Space',
    placeholder: 'Tree spacing/pruning, shrub clusters, grass height, firewood storage, dead vegetation…',
  },
  {
    key: 'detached_structures',
    label: 'Detached Structures & Other Large Items',
    placeholder: 'Sheds, pergolas, hot tubs, outdoor kitchens, LPG tanks, water storage tanks — placement, materials, spacing…',
  },
  {
    key: 'roof',
    label: 'Roof',
    placeholder: 'Roof covering material, condition, debris, bird stops if barrel tile/corrugated metal…',
  },
  {
    key: 'gutters',
    label: 'Gutters & Downspouts',
    placeholder: 'Material, debris buildup, presence/absence of gutter guards…',
  },
  {
    key: 'wall_clearance',
    label: '6-Inch Noncombustible Wall Clearance',
    placeholder: 'Material observed at the base of exterior walls, deck posts, and stairs…',
  },
  {
    key: 'vents',
    label: 'Vents (Roof, Attic, Eave, Under-Home, Dryer)',
    placeholder: 'Mesh presence/size, vent type, dryer vent louver/flap condition…',
  },
  {
    key: 'eaves_soffits',
    label: 'Eaves & Soffits',
    placeholder: 'Exposed underside condition, enclosure material, soffit vent protection…',
  },
  {
    key: 'skylights',
    label: 'Skylights',
    placeholder: 'Skylight type (dome vs. flat/multi-pane), mesh protection if operable…',
  },
  {
    key: 'siding',
    label: 'Exterior Wall Coverings / Siding',
    placeholder: 'Siding material, shutters, underfloor/projection enclosure…',
  },
  {
    key: 'windows_doors',
    label: 'Exterior Windows & Doors',
    placeholder: 'Window pane construction, door material/thickness, glass panes in doors…',
  },
  {
    key: 'decks',
    label: 'Decks, Patios & Overhead Structures',
    placeholder: 'Walking surface material, railings, post/stair base treatment, underdeck enclosure, pergola roof coverage…',
  },
  {
    key: 'access',
    label: 'Access & Address',
    placeholder: 'Driveway condition/width, address visibility, evacuation route considerations…',
  },
  {
    key: 'other',
    label: 'Other Observations',
    placeholder: 'Anything else relevant to overall site risk not captured above…',
  },
]
