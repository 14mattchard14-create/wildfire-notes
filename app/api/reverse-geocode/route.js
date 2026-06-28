export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const lat = searchParams.get('lat')
  const lng = searchParams.get('lng')
  if (!lat || !lng) return Response.json({ address: null })

  try {
    const apiKey = process.env.GOOGLE_MAPS_KEY
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`
    )
    const data = await res.json()
    const address = data.results?.[0]?.formatted_address ?? null
    return Response.json({ address })
  } catch (err) {
    return Response.json({ address: null, error: err.message })
  }
}
