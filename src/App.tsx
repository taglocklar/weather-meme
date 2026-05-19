import { useState } from 'react'
import './App.css'

type WeatherMood = 'good' | 'bad' | 'mixed'

type WeatherSnapshot = {
  temperature: number
  feelsLike: number
  windSpeed: number
  precipitation: number
  code: number
  summary: string
  latitude: number
  longitude: number
  city: string
  region: string
  country: string
  mood: WeatherMood
}

type MemeResult = {
  url: string
  template_name?: string
}

type MemeApiResponse = {
  success: boolean
  prompt?: string
  results?: MemeResult[]
  error?: string
}

type LocationSnapshot = {
  city: string
  region: string
  country: string
}

const weatherCodeLabels: Record<number, string> = {
  0: 'clear sky',
  1: 'mainly clear',
  2: 'partly cloudy',
  3: 'overcast',
  45: 'foggy',
  48: 'rime fog',
  51: 'light drizzle',
  53: 'drizzle',
  55: 'heavy drizzle',
  61: 'light rain',
  63: 'rain',
  65: 'heavy rain',
  71: 'light snow',
  73: 'snow',
  75: 'heavy snow',
  80: 'rain showers',
  81: 'strong rain showers',
  82: 'violent rain showers',
  95: 'thunderstorm',
  96: 'thunderstorm with hail',
  99: 'heavy thunderstorm with hail',
}

const moodCopy: Record<WeatherMood, { label: string; emoji: string; line: string }> = {
  good: {
    label: 'good weather detected',
    emoji: '😎',
    line: 'The meme should celebrate that the sky is actually cooperating.',
  },
  bad: {
    label: 'bad weather detected',
    emoji: '😭',
    line: 'The meme should roast the forecast like it personally betrayed you.',
  },
  mixed: {
    label: 'confusing weather detected',
    emoji: '🤔',
    line: 'The meme should react to a forecast that cannot pick a side.',
  },
}

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 300000,
    })
  })
}

function getWeatherMood(code: number, temperature: number, windSpeed: number, precipitation: number): WeatherMood {
  const isStormy = code >= 61 || precipitation > 0.04 || windSpeed >= 25
  const isGrossTemp = temperature <= 45 || temperature >= 94
  const isNiceTemp = temperature >= 62 && temperature <= 84
  const isClearish = code <= 2 && precipitation === 0 && windSpeed < 18

  if (isStormy || isGrossTemp) return 'bad'
  if (isClearish && isNiceTemp) return 'good'
  return 'mixed'
}

async function getLocationName(latitude: number, longitude: number): Promise<LocationSnapshot> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    localityLanguage: 'en',
  })

  const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?${params}`)

  if (!response.ok) {
    return { city: 'your city', region: '', country: '' }
  }

  const data = await response.json()

  const country = String(data.countryName || '').replace(' (the)', '')

  return {
    city: data.city || data.locality || data.principalSubdivision || 'your city',
    region: data.principalSubdivision || '',
    country,
  }
}

async function getWeather(latitude: number, longitude: number): Promise<WeatherSnapshot> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation',
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
    precipitation_unit: 'inch',
  })

  const [weatherResponse, location] = await Promise.all([
    fetch(`https://api.open-meteo.com/v1/forecast?${params}`),
    getLocationName(latitude, longitude),
  ])

  if (!weatherResponse.ok) {
    throw new Error('Could not load weather data.')
  }

  const data = await weatherResponse.json()
  const current = data.current
  const code = Number(current.weather_code)
  const temperature = Math.round(Number(current.temperature_2m))
  const windSpeed = Math.round(Number(current.wind_speed_10m))
  const precipitation = Number(current.precipitation)

  return {
    temperature,
    feelsLike: Math.round(Number(current.apparent_temperature)),
    windSpeed,
    precipitation,
    code,
    summary: weatherCodeLabels[code] ?? 'weird weather',
    latitude,
    longitude,
    city: location.city,
    region: location.region,
    country: location.country,
    mood: getWeatherMood(code, temperature, windSpeed, precipitation),
  }
}

async function generateMeme(weather: WeatherSnapshot): Promise<MemeApiResponse> {
  const response = await fetch('/api/weather-meme', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ weather }),
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || 'Could not generate a meme.')
  }

  return data
}

function App() {
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null)
  const [meme, setMeme] = useState<MemeResult | null>(null)
  const [prompt, setPrompt] = useState('')
  const [status, setStatus] = useState('Ready for the forecast orb.')
  const [isLoading, setIsLoading] = useState(false)

  async function handleGenerate() {
    if (!navigator.geolocation) {
      setStatus('Your browser does not support location lookup.')
      return
    }

    setIsLoading(true)
    setMeme(null)
    setPrompt('')
    setStatus('Finding your local sky vibes...')

    try {
      const position = await getPosition()
      const snapshot = await getWeather(position.coords.latitude, position.coords.longitude)
      setWeather(snapshot)
      setStatus(`${snapshot.city} weather found. Asking Memelord for one reaction meme...`)

      const result = await generateMeme(snapshot)
      const firstMeme = result.results?.find((item) => item.url)

      setPrompt(result.prompt ?? '')
      setMeme(firstMeme ?? null)
      setStatus(firstMeme ? 'Meme generated.' : 'Memelord responded, but no meme URL came back.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Something went wrong.')
    } finally {
      setIsLoading(false)
    }
  }

  const mood = weather ? moodCopy[weather.mood] : null

  return (
    <main className="app-shell">
      <div className="emoji-cloud emoji-cloud-one" aria-hidden="true">🌤️</div>
      <div className="emoji-cloud emoji-cloud-two" aria-hidden="true">🫧</div>
      <div className="emoji-cloud emoji-cloud-three" aria-hidden="true">🌈</div>

      <section className="glass-panel" aria-labelledby="page-title">
        <img className="logo" src="/brand/memelord.svg" alt="Memelord" />

        <p className="eyebrow">How&apos;s the weather? 🐠</p>
        <h1 id="page-title">Your city&apos;s forecast becomes a meme.</h1>
        <p className="lede">
          We pull your city, check the weather, decide if it&apos;s good or cursed, then make a Memelord reaction meme.
        </p>

        <button type="button" onClick={handleGenerate} disabled={isLoading}>
          {isLoading ? 'Consulting the weather orb...' : 'Use my weather ✨'}
        </button>

        <p className="status" role="status">
          {status}
        </p>
      </section>

      {weather && mood && (
        <section className={`weather-card ${weather.mood}`} aria-label="Current weather readout">
          <div className="mood-badge">
            <span>{mood.emoji}</span>
            {mood.label}
          </div>

          <h2>{weather.city}</h2>
          {(weather.region || weather.country) && (
            <p className="place">
              {[weather.region, weather.country].filter(Boolean).join(', ')}
            </p>
          )}

          <div className="temperature-row">
            <strong>{weather.temperature}°F</strong>
            <span>{weather.summary}</span>
          </div>

          <p>{mood.line}</p>

          <dl className="stats">
            <div>
              <dt>Feels like</dt>
              <dd>{weather.feelsLike}°F</dd>
            </div>
            <div>
              <dt>Wind</dt>
              <dd>{weather.windSpeed} mph</dd>
            </div>
            <div>
              <dt>Rain</dt>
              <dd>{weather.precipitation} in</dd>
            </div>
          </dl>
        </section>
      )}

      {prompt && (
        <details className="prompt">
          <summary>Show Memelord prompt</summary>
          <p>{prompt}</p>
        </details>
      )}

      {meme && (
        <figure className="result">
          <img src={meme.url} alt="Generated weather meme" />
          {meme.template_name && <figcaption>{meme.template_name}</figcaption>}
        </figure>
      )}

      <a className="memelord-powered-badge" href="https://www.memelord.com" target="_blank" rel="noreferrer">
        <span aria-hidden="true">⚡</span>
        powered by memelord
      </a>
    </main>
  )
}

export default App
