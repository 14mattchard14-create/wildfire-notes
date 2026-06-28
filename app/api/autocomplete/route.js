export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const input = searchParams.get('input')
  if (!input) return Response.json({ suggestions: [] })

  try {
    const apiKey = process.env.GOOGLE_MAPS_KEY
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&types=address&components=country:us&key=${apiKey}`
    )
    const data = await res.json()
    const suggestions = data.predictions?.map(p => p.description) ?? []
    return Response.json({ suggestions })
  } catch (err) {
    return Response.json({ suggestions: [], error: err.message })
  }
}
