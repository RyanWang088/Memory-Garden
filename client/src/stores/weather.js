import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { apiFetch } from '@/lib/http'

const FALLBACK = { lat: 1.3005, lon: 103.8626 } // SMU SCIS 1
const MOOD_BY_PHASE = Object.freeze({ dawn: 'morning', day: 'day', blush:'blush', dusk: 'dusk', night: 'night' })

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
  const condition = ref('sunny') // 'sunny' | 'cloudy' | 'rainy' | 'stormy'
  const isDay = ref(true)
  const temperature = ref(null)
  const daily = ref([])          // [{ date, max, min, precipitation }] for 3 days
  const sunrise = ref(7 * 60)
  const sunset = ref(19 * 60)
  const nowMin = ref(12 * 60)
  const awake = ref(false)
  let timer, users = 0

  const phase = computed(() => {
  const t = nowMin.value
  const sr = sunrise.value
  const ss = sunset.value

  // 1. Dawn & Morning: Golden sunrise straight into daytime
  if (t >= sr - 30 && t <= sr + 90) return 'dawn'       // Morning golden light (06:30 - 08:30)

  // 2. Evening & Sunset: Pink Blush BEFORE Purple Dusk
  if (t >= ss - 60 && t < ss) return 'blush'            // Pink sky right before sunset (18:00 - 19:00)
  if (t >= ss && t <= ss + 45) return 'dusk'            // Purple sky right as dusk sets in (19:00 - 19:45)

  // 3. High Day vs. Night
  return t > sr && t < ss ? 'day' : 'night'
  })

  const progress = computed(() => {
    const t = nowMin.value
    if (t >= sunrise.value && t <= sunset.value) return (t - sunrise.value) / (sunset.value - sunrise.value)
    const len = sunrise.value + 1440 - sunset.value
    const tt = t >= sunset.value ? t : t + 1440
    return Math.min(1, Math.max(0, (tt - sunset.value) / len))
  })

  const sun = computed(() => ({ x: 10 + 80 * progress.value, y: 60 - 45 * Math.sin(Math.PI * progress.value) }))
  const look = computed(() => ({ mood: awake.value ? MOOD_BY_PHASE[phase.value] : 'night', weather: condition.value }))

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

  function start() {
    if (users++) return
    awake.value = false
    requestAnimationFrame(() => requestAnimationFrame(() => { awake.value = true }))
    load()
    timer = setInterval(() => { nowMin.value = (nowMin.value + 1) % 1440 }, 60000)
  }

  function stop() {
    if (!users || --users) return
    clearInterval(timer)
  }

  return {
    condition, isDay, temperature, daily, sunrise, sunset, nowMin, load,
    look, sun, phase, start, stop,
  }
})
