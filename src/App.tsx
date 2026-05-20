import { type FormEvent, useEffect, useState } from 'react'
import './App.css'

type WeatherMood = 'good' | 'bad' | 'mixed'

type WeatherSnapshot = {
  temperature: number
  feelsLike: number
  high: number
  low: number
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

type NamedLocation = LocationSnapshot & {
  latitude: number
  longitude: number
}

type ProgressStep = 'idle' | 'location' | 'weather' | 'meme'
type ActiveAction = 'place' | 'current' | null

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

const suggestedLocations = ['New York', 'London', 'Tokyo', 'Miami', 'Paris', 'Sydney']

const usStateAbbreviations: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', DC: 'District of Columbia',
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

function formatLocationName(location: LocationSnapshot) {
  const region = location.region && location.region.toLowerCase() !== location.city.toLowerCase() ? location.region : ''
  return [location.city, region || location.country].filter(Boolean).join(', ')
}

function parseLocationQuery(query: string) {
  const normalized = query.replace(/,/g, ' ').replace(/\s+/g, ' ').trim()
  const parts = normalized.split(' ')
  const lastPart = parts.at(-1)?.toUpperCase()
  const regionHint = lastPart ? usStateAbbreviations[lastPart] : ''

  return {
    searchName: regionHint && parts.length > 1 ? parts.slice(0, -1).join(' ') : normalized,
    regionHint,
  }
}

function isWarmSeason(latitude: number) {
  const month = new Date().getMonth()
  const northernWarmSeason = month >= 4 && month <= 8

  return latitude >= 0 ? northernWarmSeason : !northernWarmSeason
}

function getComfortThresholds(latitude: number) {
  const warmSeason = isWarmSeason(latitude)
  const absLatitude = Math.abs(latitude)

  if (warmSeason) {
    if (absLatitude < 28) return { coldAt: 58, niceMin: 68, niceMax: 90, hotAt: 95 }
    if (absLatitude < 36) return { coldAt: 54, niceMin: 64, niceMax: 88, hotAt: 92 }
    return { coldAt: 52, niceMin: 62, niceMax: 84, hotAt: 89 }
  }

  if (absLatitude < 28) return { coldAt: 55, niceMin: 66, niceMax: 84, hotAt: 90 }
  if (absLatitude < 36) return { coldAt: 38, niceMin: 56, niceMax: 76, hotAt: 82 }
  return { coldAt: 28, niceMin: 46, niceMax: 68, hotAt: 78 }
}

function getWeatherMood(code: number, feelsLike: number, high: number, low: number, windSpeed: number, precipitation: number, latitude: number): WeatherMood {
  const comfort = getComfortThresholds(latitude)
  const hasRainOrSnow = precipitation > 0.02 || (code >= 61 && code < 90)
  const hasDrizzle = code >= 51 && code < 60
  const hasThunder = code >= 95
  const isWindy = windSpeed >= 25
  const isBreezy = windSpeed >= 18
  const isTooCold = feelsLike <= comfort.coldAt
  const isTooHot = feelsLike >= comfort.hotAt
  const dayGetsTooCold = low <= comfort.coldAt
  const dayGetsTooHot = high >= comfort.hotAt
  const isNiceTemp = feelsLike >= comfort.niceMin && feelsLike <= comfort.niceMax
  const isNiceDay = high <= comfort.hotAt - 1 && low >= comfort.coldAt + 2
  const isOkaySky = code <= 3 || code === 45 || code === 48

  if (hasThunder || hasRainOrSnow || isWindy || isTooCold || isTooHot) return 'bad'
  if ((dayGetsTooHot || dayGetsTooCold) && !isNiceTemp) return 'bad'
  if (isNiceTemp && isNiceDay && isOkaySky && !hasDrizzle && !isBreezy) return 'good'
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

async function searchLocation(query: string): Promise<NamedLocation> {
  const { searchName, regionHint } = parseLocationQuery(query)
  const params = new URLSearchParams({
    name: searchName,
    count: '10',
    language: 'en',
    format: 'json',
  })

  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`)

  if (!response.ok) {
    throw new Error('Could not search for that location.')
  }

  const data = await response.json()
  const places = data.results ?? []
  const place = regionHint
    ? places.find((result: { admin1?: string; country_code?: string }) => result.admin1 === regionHint && result.country_code === 'US') ?? places[0]
    : places[0]

  if (!place) {
    throw new Error('No matching location found. Try a city name like Tokyo or Miami.')
  }

  return {
    latitude: Number(place.latitude),
    longitude: Number(place.longitude),
    city: place.name || query,
    region: place.admin1 || '',
    country: place.country || '',
  }
}

async function getWeather(latitude: number, longitude: number, knownLocation?: LocationSnapshot): Promise<WeatherSnapshot> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation',
    daily: 'temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min',
    forecast_days: '1',
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
    precipitation_unit: 'inch',
  })

  const [weatherResponse, location] = await Promise.all([
    fetch(`https://api.open-meteo.com/v1/forecast?${params}`),
    knownLocation ? Promise.resolve(knownLocation) : getLocationName(latitude, longitude),
  ])

  if (!weatherResponse.ok) {
    throw new Error('Could not load weather data.')
  }

  const data = await weatherResponse.json()
  const current = data.current
  const daily = data.daily
  const code = Number(current.weather_code)
  const temperature = Math.round(Number(current.temperature_2m))
  const feelsLike = Math.round(Number(current.apparent_temperature))
  const high = Math.round(Number(daily?.apparent_temperature_max?.[0] ?? daily?.temperature_2m_max?.[0] ?? temperature))
  const low = Math.round(Number(daily?.apparent_temperature_min?.[0] ?? daily?.temperature_2m_min?.[0] ?? temperature))
  const windSpeed = Math.round(Number(current.wind_speed_10m))
  const precipitation = Number(current.precipitation)

  return {
    temperature,
    feelsLike,
    high,
    low,
    windSpeed,
    precipitation,
    code,
    summary: weatherCodeLabels[code] ?? 'weird weather',
    latitude,
    longitude,
    city: location.city,
    region: location.region,
    country: location.country,
    mood: getWeatherMood(code, feelsLike, high, low, windSpeed, precipitation, latitude),
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
  const [status, setStatus] = useState('Use your weather or pick a city.')
  const [isLoading, setIsLoading] = useState(false)
  const [progressStep, setProgressStep] = useState<ProgressStep>('idle')
  const [activeAction, setActiveAction] = useState<ActiveAction>(null)
  const [locationQuery, setLocationQuery] = useState('')
  const [showMemelordPopup, setShowMemelordPopup] = useState(false)

  function resetMemeState() {
    setMeme(null)
    setPrompt('')
    setShowMemelordPopup(false)
  }

  useEffect(() => {
    if (!meme) return

    const popupTimer = window.setTimeout(() => {
      setShowMemelordPopup(true)
    }, 2400)

    return () => window.clearTimeout(popupTimer)
  }, [meme])

  async function finishMeme(snapshot: WeatherSnapshot) {
    setWeather(snapshot)
    setProgressStep('meme')
    setStatus(`${snapshot.city} weather found. Asking Memelord for one reaction meme...`)

    const result = await generateMeme(snapshot)
    const firstMeme = result.results?.find((item) => item.url)

    setPrompt(result.prompt ?? '')
    setMeme(firstMeme ?? null)
    setStatus(firstMeme ? 'Meme generated.' : 'Memelord responded, but no meme URL came back.')
  }

  async function handleGenerate() {
    if (!navigator.geolocation) {
      setStatus('Your browser does not support location lookup.')
      return
    }

    setIsLoading(true)
    setActiveAction('current')
    setProgressStep('location')
    resetMemeState()
    setStatus('Finding your local sky vibes...')

    try {
      const position = await getPosition()
      setProgressStep('weather')
      setStatus('Checking the forecast...')

      const snapshot = await getWeather(position.coords.latitude, position.coords.longitude)
      await finishMeme(snapshot)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Something went wrong.')
    } finally {
      setIsLoading(false)
      setActiveAction(null)
      setProgressStep('idle')
    }
  }

  async function handleLocationSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const query = locationQuery.trim()

    if (!query) {
      setStatus('Type a city first, then we can meme its weather.')
      return
    }

    setIsLoading(true)
    setActiveAction('place')
    setProgressStep('location')
    resetMemeState()
    setStatus(`Finding ${query}...`)

    try {
      const selectedLocation = await searchLocation(query)
      setLocationQuery(formatLocationName(selectedLocation))
      setProgressStep('weather')
      setStatus(`Checking ${selectedLocation.city} weather...`)

      const snapshot = await getWeather(selectedLocation.latitude, selectedLocation.longitude, selectedLocation)
      await finishMeme(snapshot)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Something went wrong.')
    } finally {
      setIsLoading(false)
      setActiveAction(null)
      setProgressStep('idle')
    }
  }

  const mood = weather ? moodCopy[weather.mood] : null
  const progressValue = progressStep === 'location' ? 33 : progressStep === 'weather' ? 66 : progressStep === 'meme' ? 92 : 0

  return (
    <main className="app-shell">
      <div className="emoji-cloud emoji-cloud-one" aria-hidden="true">🌤️</div>
      <div className="emoji-cloud emoji-cloud-two" aria-hidden="true">🫧</div>
      <div className="emoji-cloud emoji-cloud-three" aria-hidden="true">🌈</div>

      <section className="glass-panel" aria-labelledby="page-title">
        <p className="eyebrow">How&apos;s the weather? 🐠</p>
        <h1 id="page-title">Your city&apos;s forecast becomes a meme.</h1>
        <p className="lede">
          Use your location or pick any city. We check the weather, judge the vibes, then make a reaction meme.
        </p>

        <form className="location-form" onSubmit={handleLocationSubmit}>
          <label htmlFor="location">Pick a place</label>
          <div className="location-controls">
            <input
              id="location"
              name="location"
              type="search"
              list="location-suggestions"
              placeholder="Try Tokyo, Lagos, or Miami"
              value={locationQuery}
              onChange={(event) => setLocationQuery(event.target.value)}
              disabled={isLoading}
            />
            <datalist id="location-suggestions">
              {suggestedLocations.map((location) => (
                <option key={location} value={location} />
              ))}
            </datalist>
            <button type="submit" disabled={isLoading}>
              {activeAction === 'place' ? 'Making city meme...' : 'Meme this place'}
            </button>
          </div>
          <div className="action-divider" aria-hidden="true">
            <span />
            <em>or</em>
            <span />
          </div>
          <button type="button" className="current-location-button" onClick={handleGenerate} disabled={isLoading}>
            {activeAction === 'current' ? 'Finding your weather...' : 'Use my weather ✨'}
          </button>
        </form>

        <p className="status" role="status">
          {status}
        </p>

        {isLoading && (
          <div className="progress" aria-label="Weather meme progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressValue} role="progressbar">
            <div className="progress-track">
              <span style={{ width: `${progressValue}%` }} />
            </div>
            <ol className="progress-steps">
              <li className={progressStep === 'location' ? 'active' : progressStep === 'weather' || progressStep === 'meme' ? 'done' : ''}>Location</li>
              <li className={progressStep === 'weather' ? 'active' : progressStep === 'meme' ? 'done' : ''}>Weather</li>
              <li className={progressStep === 'meme' ? 'active' : ''}>Meme</li>
            </ol>
          </div>
        )}
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
              <dt>High / low</dt>
              <dd>{weather.high}° / {weather.low}°</dd>
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

      {showMemelordPopup && (
        <div className="memelord-popup-backdrop" role="presentation">
          <div className="memelord-popup" role="dialog" aria-modal="true" aria-labelledby="memelord-popup-title">
            <button type="button" className="memelord-popup-close" onClick={() => setShowMemelordPopup(false)} aria-label="Close Memelord popup">
              ×
            </button>
            <p id="memelord-popup-title">Want to make more memes?</p>
            <a href="https://www.memelord.com" target="_blank" rel="noreferrer">
              Go to Memelord
            </a>
          </div>
        </div>
      )}

      <a className="memelord-powered-stamp" href="https://www.memelord.com" target="_blank" rel="noreferrer">
        <span className="stamp-copy">
          <span className="stamp-ribbon">Another web site powered by</span>
          <span className="stamp-name">Memelord API</span>
        </span>
      </a>
    </main>
  )
}

export default App


