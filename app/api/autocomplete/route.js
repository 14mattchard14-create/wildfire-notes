export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const input = searchParams.get('input')
  if (!input) return Response.json({ suggestions: [] })

  try {
    const apiKey = process.env.GOOGLE_MAPS_KEY
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&types=address&components=country:us&key=${apiKey}`
    const res = await fetch(url)
    const data = await res.json()

    // Surface Google's actual status/error for debugging
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      return Response.json({ suggestions: [], googleStatus: data.status, googleError: data.error_message ?? null })
    }

    const suggestions = data.predictions?.map(p => p.description) ?? []
    return Response.json({ suggestions, googleStatus: data.status })
  } catch (err) {
    return Response.json({ suggestions: [], error: err.message })
  }
}
