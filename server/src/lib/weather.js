// Calls Open-Meteo (free, no API key) and turns its WMO weather_code into a simple condition.
const BASE_URL = 'https://api.open-meteo.com/v1/forecast'
const CACHE_MS = 10 * 60 * 1000 // Open-Meteo refreshes "current" every 15 min, so 10 min is fresh enough

// WMO code -> 'sunny' | 'cloudy' | 'rainy' | 'stormy'  snow omitted due to time constraint
export function toCondition(code) {
  if (code <= 1) return 'sunny'                          // 0 clear, 1 mainly clear
  if (code <= 3 || code === 45 || code === 48) return 'cloudy' // 2 partly cloudy, 3 overcast, 45/48 fog
  if (code >= 95) return 'stormy'                       // 95 thunderstorm, 96/99 with hail
  return 'rainy'                                         // 51-57 drizzle, 61-67 rain, 80-82 showers
}

// "2026-10-13T06:58" -> minutes since local midnight
const toMin = (iso) => {
  const [h, m] = iso.slice(11, 16).split(':')
  return +h * 60 + +m
}

// Same spot (to ~1 km) shares one cached response, so many users don't each hit Open-Meteo
const cache = new Map()

async function fetchForecast(lat, lon) {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data

  const url = `${BASE_URL}?latitude=${lat}&longitude=${lon}`
    + '&current=temperature_2m,precipitation,weather_code,is_day'
    + '&daily=sunrise,sunset,temperature_2m_max,temperature_2m_min,precipitation_sum'
    + '&forecast_days=3&timezone=auto'
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`Open-Meteo request failed (${res.status})`)

  const data = await res.json()
  cache.set(key, { at: Date.now(), data })
  return data
}

// Returns only what the client needs, already interpreted
export async function getWeather(lat, lon) {
  const { current, daily, timezone, utc_offset_seconds } = await fetchForecast(lat, lon)

  // minutes since local midnight AT THAT LOCATION, worked out per request (not cached)
  const local = new Date(Date.now() + utc_offset_seconds * 1000)

  return {
    timezone,
    code: current.weather_code,
    condition: toCondition(current.weather_code),
    isDay: current.is_day === 1, // 0 + sunny code = clear night (moon and stars)
    temperature: current.temperature_2m,
    precipitation: current.precipitation,
    nowMin: local.getUTCHours() * 60 + local.getUTCMinutes(),
    sunrise: toMin(daily.sunrise[0]),
    sunset: toMin(daily.sunset[0]),
    daily: daily.time.map((date, i) => ({
      date,
      max: daily.temperature_2m_max[i],
      min: daily.temperature_2m_min[i],
      precipitation: daily.precipitation_sum[i],
    })),
  }
}
