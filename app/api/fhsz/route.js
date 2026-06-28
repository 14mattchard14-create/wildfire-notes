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

    // 2. Query CAL FIRE FHSZ ArcGIS layer
    const fhszRes = await fetch(
      `https://services1.arcgis.com/jUJYIo9tSA7EHvfZ/arcgis/rest/services/FHSZ_v2_2023/FeatureServer/0/query?` +
      `geometry=${lng},${lat}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects` +
      `&outFields=HAZ_CLASS,SRA,COUNTY&returnGeometry=false&f=json`
    )
    const fhszData = await fhszRes.json()
    const feature = fhszData.features?.[0]

    if (!feature) return Response.json({ fhsz: null, lat, lng, error: 'No FHSZ data for this location' })

    const hazClass = feature.attributes.HAZ_CLASS
    const sra      = feature.attributes.SRA
    const county   = feature.attributes.COUNTY

    const zoneMap = {
      '1': 'Moderate',
      '2': 'High',
      '3': 'Very High',
      'MODERATE': 'Moderate',
      'HIGH': 'High',
      'VERY HIGH': 'Very High',
    }
    const zone = zoneMap[String(hazClass).toUpperCase()] ?? hazClass ?? 'Unknown'

    return Response.json({ fhsz: zone, sra, county, lat, lng })
  } catch (err) {
    console.error('FHSZ lookup error:', err)
    return Response.json({ fhsz: null, error: err.message }, { status: 500 })
  }
}
