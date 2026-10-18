import { test, expect } from '@playwright/test'

test('Garden plant stage updates when the seed changes', async ({ page }) => {
  await page.addInitScript(() => {
    const session = {
      user: { id: 'user-1', email: 'demo@example.com' },
      access_token: 'fake-token',
    }
    const profile = { id: 'user-1', onboarded: true, streak: 1, last_tended: null }
    const seeds = [{
      id: 'seed-1',
      title: 'Demo plant',
      subject: 'Math',
      exam_date: new Date().toISOString(),
      tags: [],
      cards: [],
      col: 3,
      row: 4,
      mastery: 30,
      last_reviewed: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    }]

    const originalFetch = window.fetch.bind(window)
    window.fetch = async (...args) => {
      const [input, init] = args
      const url = String(input)

      if (url.includes('/auth/v1')) {
        return new Response(JSON.stringify({ data: { session }, error: null }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      if (url.includes('/rest/v1/profiles')) {
        return new Response(JSON.stringify(profile), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      if (url.includes('/api/weather')) {
        return new Response(JSON.stringify({
          condition: 'sunny',
          isDay: true,
          temperature: 24,
          daily: [],
          sunrise: 420,
          sunset: 1140,
          nowMin: 720,
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      if (url.includes('/api/seeds')) {
        return new Response(JSON.stringify(seeds), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      return originalFetch(...args)
    }
  })

  await page.goto('http://localhost:5173/garden')
  const plant = page.locator('[data-testid="plant"]').first()
  await expect(plant).toHaveAttribute('data-stage', '2')

  await page.evaluate(() => {
    const root = document.querySelector('#app')
    const app = root.__vue_app__
    const pinia = app.config.globalProperties.$pinia
    const garden = pinia._s.get('garden')
    const seed = garden.seeds[0]
    seed.mastery = 80
    seed.last_reviewed = new Date(Date.now() - 3 * 86_400_000).toISOString()
  })

  await expect(plant).toHaveAttribute('data-stage', '5')
})
