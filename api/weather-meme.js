function getWeatherReaction(mood) {
  if (mood === 'good') {
    return 'reacting like the weather is unexpectedly elite and everyone should be outside immediately'
  }

  if (mood === 'bad') {
    return 'reacting like the weather is personally ruining the day and the city deserves a roast'
  }

  return 'reacting like the forecast is confusing, suspicious, and impossible to dress for'
}

function buildPrompt(weather) {
  const location = [weather.city, weather.region].filter(Boolean).join(', ')
  const reaction = getWeatherReaction(weather.mood)

  return `A funny meme about ${location || "the user's city"} weather. Current forecast: ${weather.temperature} degrees Fahrenheit, feels like ${weather.feelsLike} degrees Fahrenheit, ${weather.summary}, wind ${weather.windSpeed} mph, precipitation ${weather.precipitation} inches. Overall weather judgment: ${weather.mood}. Make the meme ${reaction}. Use the city/location context as part of the joke, not just generic weather. Important text rendering rule: do not use the degree symbol, the Fahrenheit symbol, or special temperature characters in the meme caption; write temperatures as "${weather.temperature} degrees" or "${weather.temperature} degrees Fahrenheit" instead. Keep it relatable, internet-native, and caption-forward.`
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    response.status(405).json({ error: 'Method not allowed.' })
    return
  }

  const apiKey = process.env.MEMELORD_API_KEY

  if (!apiKey) {
    response.status(500).json({ error: 'MEMELORD_API_KEY is not set in the deployment environment.' })
    return
  }

  try {
    const weather = request.body?.weather

    if (!weather) {
      response.status(400).json({ error: 'Missing weather payload.' })
      return
    }

    const prompt = buildPrompt(weather)
    const memelordResponse = await fetch('https://www.memelord.com/api/v1/ai-meme', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        count: 1,
        include_nsfw: false,
      }),
    })

    const data = await memelordResponse.json()

    if (!memelordResponse.ok) {
      response.status(memelordResponse.status).json({
        error: data.error || 'Memelord API request failed.',
      })
      return
    }

    response.status(200).json(data)
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : 'Unexpected server error.',
    })
  }
}
