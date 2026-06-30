const BASE_URL = 'https://services.gis.ca.gov/arcgis/rest/services/Environment/Fire_Severity_Zones/MapServer'

// Layer IDs: 0 = SRA, 1 = LRA, 2 = Awaiting Zoning, 3 = FRA
const LAYERS = [
  { id: 0, sra: 'SRA' },
  { id: 1, sra: 'LRA' },
  { id: 3, sra: 'FRA' },
]

async function queryLayer(layerId, lng, lat) {
  const url = `${BASE_URL}/${layerId}/query?geometry=${lng},${lat}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&returnGeometry=false&f=json`
  const res = await fetch(url)
  if (!res.ok) return null
  const data = await res.json()
  return data.features?.[0] ?? null
}

export async function POST(req) {
  try {
    const { address } = await req.json()
    const apiKey = process.env.GOOGLE_MAPS_KEY

    // 1. Geocode the address
    const geoRes = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`
    )
    const geoData = await geoRes.json()
    if (!geoData.results?.length) return Response.json({ fhsz: null, error: 'Address not found' })

    const { lat, lng } = geoData.results[0].geometry.location

    // 2. Pull county from the geocode result's address components
    const countyComponent = geoData.results[0].address_components?.find(c => c.types.includes('administrative_area_level_2'))
    const county = countyComponent?.long_name?.replace(' County', '') ?? null

    // 3. Query SRA, then LRA, then FRA layers in order — first match wins
    for (const layer of LAYERS) {
      const feature = await queryLayer(layer.id, lng, lat)
      if (feature) {
        const attrs = feature.attributes
        const hazClass = attrs.HAZ_CLASS ?? null
        const sra = attrs.SRA ?? layer.sra

        return Response.json({
          fhsz: hazClass,
          sra,
          county,
          lat,
          lng,
        })
      }
    }

    // No FHSZ zone found in any layer — likely LRA with no designated zone
    return Response.json({ fhsz: null, sra: 'LRA', county, lat, lng })
  } catch (err) {
    console.error('FHSZ lookup error:', err)
    return Response.json({ fhsz: null, error: err.message }, { status: 500 })
  }
}
