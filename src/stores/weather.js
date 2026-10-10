import { defineStore } from 'pinia'
import { ref } from 'vue'

// Feature 2: weather-linked backdrop. No backend needed: Open-Meteo is public and keyless.
export const useWeatherStore = defineStore('weather', () => {
  const condition = ref('sunny') // 'sunny' | 'rainy' | 'overcast'
  const isNight = ref(false)

  async function load() {
    try {
      const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 }))
      const { latitude: lat, longitude: lon } = pos.coords
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=weather_code,is_day`
      const { current } = await (await fetch(url)).json()
      isNight.value = current.is_day === 0
      const code = current.weather_code // WMO codes
      condition.value = code >= 51 ? 'rainy' : code >= 2 ? 'overcast' : 'sunny'
    } catch {
      // Permission denied / offline: keep defaults, derive day/night from the clock
      const h = new Date().getHours()
      isNight.value = h < 6 || h >= 19
    }
  }

  return { condition, isNight, load }
})
