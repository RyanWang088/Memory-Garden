import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const FALLBACK = { lat: 1.3005, lon: 103.8626 } // SMU SCIS 1

// "2026-10-13T06:58" -> minutes since local midnight
const toMin = (iso) => {
  const [h, m] = iso.slice(11, 16).split(':')
  return +h * 60 + +m
}

// WMO code -> 'sunny' | 'cloudy' | 'rainy'
function toCondition(code) {
  if (code <= 1) return 'sunny'
  if (code <= 3 || code === 45 || code === 48) return 'cloudy'
  return 'rainy'
}

function getCoords() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.warn('[weather] no geolocation API, using SMU')
      return resolve(FALLBACK)
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      (e) => {
        console.warn('[weather] geolocation failed, using SMU:', e.code, e.message)
        resolve(FALLBACK)
      },
      { timeout: 5000 },
    )
  })
}

export const useWeatherStore = defineStore('weather', () => {
  const code = ref(0)
  const sunrise = ref(7 * 60)
  const sunset = ref(19 * 60)
  const nowMin = ref(12 * 60)

  const condition = computed(() => toCondition(code.value))

  async function load() {
  const { lat, lon } = await getCoords()
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
      + '&current=weather_code,is_day&daily=sunrise,sunset&forecast_days=1&timezone=auto'
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const { current, daily, utc_offset_seconds } = await res.json()

    code.value = current.weather_code
    sunrise.value = toMin(daily.sunrise[0])
    sunset.value = toMin(daily.sunset[0])

    // minutes since local midnight AT THAT LOCATION, accurate to the minute
    const local = new Date(Date.now() + utc_offset_seconds * 1000)
    nowMin.value = local.getUTCHours() * 60 + local.getUTCMinutes()

    console.log('[weather] live', { lat, lon, code: code.value, condition: condition.value, nowMin: nowMin.value, sunrise: sunrise.value, sunset: sunset.value })
  } catch (err) {
    const d = new Date()
    nowMin.value = d.getHours() * 60 + d.getMinutes()
    console.warn('[weather] fetch failed, using device clock:', err)
  }
}

  return { code, condition, sunrise, sunset, nowMin, load }
})