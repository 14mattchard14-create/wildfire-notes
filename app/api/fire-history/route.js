const FIRE_LAYER_URL = 'https://services2.arcgis.com/cFEFS0EWrhfDeVw9/arcgis/rest/services/California_Fire_Perimeters/FeatureServer/1'

// Convert miles to degrees latitude (rough approximation good enough for a search buffer)
function milesToDegrees(miles) {
  return miles / 69
}

export async function POST(req) {
  try {
    const { lat, lng, radiusMiles = 5 } = await req.json()
    if (!lat || !lng) return Response.json({ fires: [], error: 'Missing coordinates' })

    const buffer = milesToDegrees(radiusMiles)
    const envelope = {
      xmin: lng - buffer,
      ymin: lat - buffer,
      xmax: lng + buffer,
      ymax: lat + buffer,
      spatialReference: { wkid: 4326 },
    }

    const url = `${FIRE_LAYER_URL}/query?geometry=${encodeURIComponent(JSON.stringify(envelope))}` +
      `&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects` +
      `&outFields=*&returnGeometry=false&orderByFields=YEAR_+DESC&resultRecordCount=25&f=json`

    const res = await fetch(url)
    if (!res.ok) return Response.json({ fires: [], error: `ArcGIS request failed: ${res.status}` })

    const data = await res.json()
    if (data.error) return Response.json({ fires: [], error: data.error.message ?? 'ArcGIS query error' })

    const features = data.features ?? []

    // Field names vary slightly across CAL FIRE FRAP releases — check common variants defensively
    const fires = features.map(f => {
      const a = f.attributes
      const name = a.FIRE_NAME ?? a.FIRENAME ?? a.fire_name ?? 'Unnamed Fire'
      const year = a.YEAR_ ?? a.YEAR ?? a.year ?? null
      const acres = a.GIS_ACRES ?? a.Shape__Area ?? a.acres ?? null
      const cause = a.CAUSE ?? a.cause ?? null
      return {
        name,
        year,
        acres: acres ? Math.round(acres) : null,
        cause,
      }
    }).filter(f => f.year) // drop records with no year, usually incomplete/junk entries

    // Sort newest first, dedupe by name+year
    const seen = new Set()
    const deduped = fires.filter(f => {
      const key = `${f.name}-${f.year}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }).sort((a, b) => (b.year ?? 0) - (a.year ?? 0))

    return Response.json({ fires: deduped.slice(0, 10), radiusMiles })
  } catch (err) {
    console.error('Fire history lookup error:', err)
    return Response.json({ fires: [], error: err.message }, { status: 500 })
  }
}
