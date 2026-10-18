// Controller: checks the coordinates, gets the weather, sends the JSON response.
import { getWeather } from '../lib/weather.js'

const FALLBACK = { lat: 1.3005, lon: 103.8626 } // SMU SCIS 1

// Missing -> fallback; present but not a number in range -> null (invalid)
function coord(v, limit, fallback) {
  if (v === undefined || v === '') return fallback
  const n = Number(v)
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : null
}

export const weatherController = {
  // GET /api/weather?lat=1.30&lon=103.86  (both optional, defaults to SMU)
  async current(req, res, next) {
    const lat = coord(req.query.lat, 90, FALLBACK.lat)
    const lon = coord(req.query.lon, 180, FALLBACK.lon)
    if (lat === null || lon === null) return res.status(400).json({ error: 'Invalid latitude or longitude.' })

    try {
      res.json(await getWeather(lat, lon))
    } catch (err) {
      next(err)
    }
  },
}
