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
  'Exterior Walls / Siding': {
    base: [
      'At least 6 inches of noncombustible material required at the base of exterior walls, and above any attached deck or patio surface.',
      'Acceptable materials: exposed concrete foundation, fiber-cement siding, brick, stone, stucco, or metal flashing.',
      'Same 6-inch base requirement applies to combustible deck posts and stairs.',
    ],
    plus: [
      'All exterior wall coverings — not just the base — must be fully noncombustible (brick, concrete, fiber-cement, masonry veneer, metal, or stucco).',
      'Vinyl, wood siding, engineered wood, and similar wood-based products are not allowed, even if treated or coated.',
      'Shutters, decorative or operable, must also be noncombustible.',
      'Underfloor areas and projections (e.g. bay windows, homes on piers) must be enclosed or covered with noncombustible material.',
    ],
  },
  'Windows & Doors': {
    base: [
      'Not called out as a standalone Base requirement — addressed at the Plus level.',
    ],
    plus: [
      'Exterior windows need at least two panes of tempered glass with visible corner etching on both panes, or glass-block construction.',
      'Exterior doors must be noncombustible material or solid-core wood at least 1¾ inches thick, with a noncombustible threshold.',
      'Glass within a door must also be two-pane tempered glass. A noncombustible storm door over an existing door is an accepted alternative.',
    ],
  },
  'Decks, Porches & Attachments': {
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
  'Fencing': {
    base: [
      'Wood or vinyl fencing within 5 ft of the home must be replaced with noncombustible material (e.g. metal) — fire-resistant-rated materials do not qualify.',
    ],
    plus: [
      'Combustible fences running back-to-back and less than 5 ft apart, within 30 ft of the home, must be removed or have one side replaced with noncombustible material.',
    ],
  },
  'Vegetation / Fuel Load': {
    base: [
      '0–5 ft: all vegetation removed down to bare mineral soil, no exceptions — applies even to irrigated or fire-resistant-labeled plants. Overhanging branches removed too.',
      '5–30 ft: 6 ft vertical clearance under tree canopies, 10 ft horizontal clearance between continuous vegetation and the home, grass kept under 4 inches, shrub clusters capped at 10 ft wide with spacing based on plant height.',
    ],
    plus: [
      'No additional vegetation requirement at Plus — enhancements at this level focus on structures and building materials.',
    ],
  },
  'Defensible Space Clearance': {
    base: [
      '0–5 ft noncombustible zone required around the home and attached features, in all directions and extending vertically.',
      '5–30 ft (or to the property line) requires vegetation spacing/maintenance and limits on detached structures.',
      '10–30 ft: maximum of 3 detached structures, properly placed and spaced from the home and each other.',
    ],
    plus: [
      'All detached structures (sheds, pergolas, playsets, garages, ADUs) must be relocated at least 30 ft from the home.',
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
  'Other': {
    base: [
      'Hot tubs: at least 10 ft from the home, not under combustible overhead structures, with a noncombustible zone around the installation.',
      'Outdoor kitchens/built-ins: noncombustible countertops; 6-inch noncombustible base where cabinets are combustible.',
      'LPG/fuel tanks: 30 ft from the home, or 10 ft with extended clearance requirements out to 20 ft.',
      'Combustible water storage tanks: at least 5 ft from the home, with a noncombustible zone beneath and around it.',
    ],
    plus: [
      'No separate "other items" category at Plus — these requirements stay the same as Base.',
    ],
  },
}

export const ZONES = [
  'Zone 0 (0–5 ft)',
  'Zone 1 (5–30 ft)',
  'Zone 2 (30–100 ft)',
  'Home Hardening (Structure)',
  'Access & Address',
  'Overall Site',
]

export const CATEGORIES = [
  'Roof',
  'Gutters',
  'Vents',
  'Eaves & Soffits',
  'Exterior Walls / Siding',
  'Windows & Doors',
  'Decks, Porches & Attachments',
  'Fencing',
  'Vegetation / Fuel Load',
  'Defensible Space Clearance',
  'Address Visibility',
  'Driveway / Access',
  'Other',
]

export const STATUSES = [
  { value: 'Compliant',          label: 'Compliant',  color: 'green'  },
  { value: 'Non-Compliant',      label: 'Non-Comp.',  color: 'red'    },
  { value: 'Needs Verification', label: 'Verify',     color: 'blue'   },
  { value: 'Not Applicable',     label: 'N/A',        color: 'gray'   },
]
