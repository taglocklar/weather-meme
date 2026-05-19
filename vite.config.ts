import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

type WeatherMood = 'good' | 'bad' | 'mixed'

type WeatherSnapshot = {
  temperature: number
  feelsLike: number
  windSpeed: number
  precipitation: number
  summary: string
  city: string
  region: string
  country: string
  mood: WeatherMood
}

function readBody(req: import('node:http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ''

    req.on('data', (chunk: Buffer) => {
      body += chunk.toString()
    })

    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

function sendJson(res: import('node:http').ServerResponse, statusCode: number, data: unknown) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(data))
}

function weatherMemeApi(): Plugin {
  return {
    name: 'weather-meme-api',
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), '')
      const apiKey = env.MEMELORD_API_KEY

      server.middlewares.use('/api/weather-meme', async (req, res) => {
        if (req.method !== 'POST') {
          sendJson(res, 405, { error: 'Method not allowed.' })
          return
        }

        if (!apiKey) {
          sendJson(res, 500, {
            error: 'MEMELORD_API_KEY is not set. Add it to .env.local and restart the dev server.',
          })
          return
        }

        try {
          const rawBody = await readBody(req)
          const body = JSON.parse(rawBody) as { weather?: WeatherSnapshot }
          const weather = body.weather

          if (!weather) {
            sendJson(res, 400, { error: 'Missing weather payload.' })
            return
          }

          const location = [weather.city, weather.region].filter(Boolean).join(', ')
          const reaction =
            weather.mood === 'good'
              ? 'reacting like the weather is unexpectedly elite and everyone should be outside immediately'
              : weather.mood === 'bad'
                ? 'reacting like the weather is personally ruining the day and the city deserves a roast'
                : 'reacting like the forecast is confusing, suspicious, and impossible to dress for'

          const prompt = `A funny meme about ${location || 'the user\'s city'} weather. Current forecast: ${weather.temperature} degrees Fahrenheit, feels like ${weather.feelsLike} degrees Fahrenheit, ${weather.summary}, wind ${weather.windSpeed} mph, precipitation ${weather.precipitation} inches. Overall weather judgment: ${weather.mood}. Make the meme ${reaction}. Use the city/location context as part of the joke, not just generic weather. Important text rendering rule: do not use the degree symbol, the Fahrenheit symbol, or special temperature characters in the meme caption; write temperatures as "${weather.temperature} degrees" or "${weather.temperature} degrees Fahrenheit" instead. Keep it relatable, internet-native, and caption-forward.`

          const response = await fetch('https://www.memelord.com/api/v1/ai-meme', {
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

          const data = (await response.json()) as { error?: string }

          if (!response.ok) {
            sendJson(res, response.status, {
              error: data.error || 'Memelord API request failed.',
            })
            return
          }

          sendJson(res, 200, data)
        } catch (error) {
          sendJson(res, 500, {
            error: error instanceof Error ? error.message : 'Unexpected server error.',
          })
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), weatherMemeApi()],
})
