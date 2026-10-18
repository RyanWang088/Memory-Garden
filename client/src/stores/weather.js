import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiFetch } from '@/lib/http'

const FALLBACK = { lat: 1.3005, lon: 103.8626 } // SMU SCIS 1

// Resolves the user's coords, or null if they block it, ignore the popup, or have no geolocation
function getCoords() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.warn('[weather] no geolocation API, staying on SMU')
      return resolve(null)
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      (e) => {
        console.warn('[weather] geolocation failed, staying on SMU:', e.code, e.message)
        resolve(null)
      },
      { timeout: 5000 },
    )
  })
}

// Server (/api/weather) calls Open-Meteo and maps the WMO code to a condition; this store just holds the result
export const useWeatherStore = defineStore('weather', () => {
  const condition = ref('sunny') // 'sunny' | 'cloudy' | 'rainy' | 'snowy' | 'stormy'
  const isDay = ref(true)
  const temperature = ref(null)
  const daily = ref([])          // [{ date, max, min, precipitation }] for 3 days
  const sunrise = ref(7 * 60)
  const sunset = ref(19 * 60)
  const nowMin = ref(12 * 60)

  async function fetchWeather({ lat, lon }) {
    const w = await apiFetch(`/api/weather?lat=${lat}&lon=${lon}`)
    condition.value = w.condition
    isDay.value = w.isDay
    temperature.value = w.temperature
    daily.value = w.daily
    sunrise.value = w.sunrise
    sunset.value = w.sunset
    nowMin.value = w.nowMin
    console.log('[weather] live', { lat, lon, ...w })
  }

  // Show SMU weather straight away, then swap to the user's location if they allow it.
  // Waiting on the permission popup first would leave the sky on defaults if the user never answers it.
  async function load() {
    const coords = getCoords() // ask now so the popup shows while SMU loads
    try {
      await fetchWeather(FALLBACK)
    } catch (err) {
      const d = new Date()
      nowMin.value = d.getHours() * 60 + d.getMinutes()
      console.warn('[weather] fetch failed, using device clock:', err)
    }

    const here = await coords
    if (!here) return
    try {
      await fetchWeather(here)
    } catch (err) {
      console.warn('[weather] fetch for user location failed, staying on SMU:', err)
    }
  }

  return { condition, isDay, temperature, daily, sunrise, sunset, nowMin, load }
})
