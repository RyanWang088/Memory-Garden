import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'

// supabase-js reads the session from localStorage under sb-<project ref>-auth-token
const supabaseUrl = readFileSync(new URL('../../.env.local', import.meta.url), 'utf8').match(/VITE_SUPABASE_URL=(\S+)/)[1]
const AUTH_KEY = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`

const DAY = 86_400_000
const day = (offset) => new Date(Date.now() + offset * DAY).toLocaleDateString('en-CA') // local YYYY-MM-DD

const seed = (id, overrides = {}) => ({
  id, title: `Seed ${id}`, subject: 'Math', subject_id: 'subj-math', exam_id: null, exam_name: null, exam_date: null, exam_choice: null, shelf_slot: null,
  in_house: false, flower: 'tulip', color: 'red', tags: [], cards: [], col: 3, row: 4, mastery: 80,
  last_reviewed: new Date().toISOString(), ...overrides,
})
// a subject already in the flower house, on the given shelf slot
const housed = (slot) => seed(`housed-${slot}`, {
  subject: `Old subject ${slot}`, subject_id: `subj-old-${slot}`, exam_id: `exam-old-${slot}`, exam_name: 'Exam', exam_date: day(-30), exam_choice: 'house', shelf_slot: slot, in_house: true,
})

// Fakes the Supabase session/profile, the Express API and the flower-house RPCs (same idea as garden-stage.spec.js)
async function mockApp(page, { profile = {}, seeds = [], rpc = {} }) {
  await page.addInitScript(({ profile, seeds, rpc, authKey }) => {
    const session = {
      user: { id: 'user-1', email: 'demo@example.com' }, access_token: 'fake-token', refresh_token: 'fake-refresh',
      token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    }
    localStorage.setItem(authKey, JSON.stringify(session))
    const fullProfile = { id: 'user-1', onboarded: true, streak: 3, best_streak: 7, study_seconds: 9000, coins: 50,
      shelf_unlocked: false, last_tended: new Date().toISOString(), ...profile }
    const json = (body) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
    const originalFetch = window.fetch.bind(window)
    window.fetch = async (...args) => {
      const url = String(args[0])
      if (url.includes('/auth/v1')) return json({ data: { session }, error: null })
      const rpcName = url.match(/\/rest\/v1\/rpc\/(\w+)/)?.[1]
      if (rpcName) return json(rpc[rpcName] ?? null)
      if (url.includes('/rest/v1/profiles')) return json(fullProfile)
      if (url.includes('/api/weather')) {
        return json({ condition: 'sunny', isDay: true, temperature: 24, daily: [], sunrise: 420, sunset: 1140, nowMin: 720 })
      }
      if (url.includes('/api/seeds')) return json(seeds)
      return originalFetch(...args)
    }
  }, { profile, seeds, rpc, authKey: AUTH_KEY })
}

test('profile shows the stats, 12 open shelf slots and a locked third row', async ({ page }) => {
  await mockApp(page, { seeds: [housed(0)] })
  await page.goto('/profile')

  await expect(page.getByTestId('stat-streak')).toContainText('3')
  await expect(page.getByTestId('stat-best-streak')).toContainText('7')
  await expect(page.getByTestId('stat-studied')).toContainText('2.5h')
  await expect(page.getByTestId('stat-blooms-kept')).toContainText('1') // one flower on the shelf

  await expect(page.getByTestId('shelf-flower')).toHaveCount(1)
  await expect(page.getByTestId('shelf-empty')).toHaveCount(11)
  await expect(page.getByTestId('shelf-unlock')).toBeDisabled() // 50 coins < 80
})

test('unlocking the third row adds 6 slots and spends the coins', async ({ page }) => {
  await mockApp(page, { profile: { coins: 100 }, rpc: { unlock_shelf: { coins: 20, shelf_unlocked: true } } })
  await page.goto('/profile')

  await page.getByTestId('shelf-unlock').click()
  await expect(page.getByTestId('shelf-empty')).toHaveCount(18)
  await expect(page.getByTestId('shelf-unlock')).toHaveCount(0)
  await expect(page.getByTestId('nav-coins')).toContainText('20')
})

test('the exam box asks about a past exam, not a future one', async ({ page }) => {
  await mockApp(page, {
    seeds: [
      seed('past', { subject: 'WAD2', subject_id: 'subj-wad2', exam_id: 'exam-wad2', exam_name: 'Exam', exam_date: day(-1) }),
      seed('future', { subject: 'Math', subject_id: 'subj-math', exam_id: 'exam-math', exam_name: 'Exam', exam_date: day(3), col: 6 }),
    ],
  })
  await page.goto('/garden')

  await expect(page.getByTestId('exam-over')).toHaveCount(1)
  await expect(page.getByTestId('exam-over')).toContainText('WAD2 exam is over')
  await expect(page.getByTestId('exam-move')).toBeEnabled()
})

test('moving to the house is disabled while the shelves are full', async ({ page }) => {
  await mockApp(page, {
    seeds: [...Array.from({ length: 12 }, (_, i) => housed(i)), seed('past', { subject: 'WAD2', subject_id: 'subj-wad2', exam_id: 'exam-wad2', exam_name: 'Exam', exam_date: day(-1) })],
  })
  await page.goto('/garden')

  await expect(page.getByTestId('exam-move')).toBeDisabled()
  await expect(page.getByTestId('exam-over-full')).toBeVisible()
})

test('move to house takes the plants out of the garden and shows the subject on the shelf', async ({ page }) => {
  await mockApp(page, {
    seeds: [
      seed('a', { subject: 'WAD2', subject_id: 'subj-wad2', exam_id: 'exam-wad2', exam_name: 'Exam', exam_date: day(-1) }),
      seed('b', { subject: 'WAD2', subject_id: 'subj-wad2', exam_id: 'exam-wad2', exam_name: 'Exam', exam_date: day(-1), col: 6 }),
    ],
    rpc: { choose_exam_outcome: { exam_choice: 'house', shelf_slot: 0 } },
  })
  await page.goto('/garden')
  await expect(page.getByTestId('plant')).toHaveCount(3) // 2 plants + the drag ghost

  await page.getByTestId('exam-move').click()
  await expect(page).toHaveURL(/\/profile\?new=subj-wad2/)
  await expect(page.getByTestId('shelf-flower')).toHaveCount(1)
  await expect(page.getByTestId('exam-over')).toHaveCount(0)
})

test('moving one exam to the house leaves the subject\'s other exams in the garden', async ({ page }) => {
  await mockApp(page, {
    seeds: [
      seed('mid', { subject: 'WAD2', subject_id: 'subj-wad2', exam_id: 'exam-mid', exam_name: 'Midterm', exam_date: day(-1) }),
      seed('final', { subject: 'WAD2', subject_id: 'subj-wad2', exam_id: 'exam-final', exam_name: 'Final', exam_date: day(20), col: 6 }),
    ],
    rpc: { choose_exam_outcome: { exam_choice: 'house', shelf_slot: 0 } },
  })
  await page.goto('/garden')
  await expect(page.getByTestId('exam-over')).toContainText('WAD2 Midterm is over')
  await expect(page.getByTestId('exam-over')).toContainText('1 bloom')

  await page.getByTestId('exam-move').click()
  await expect(page).toHaveURL(/\/profile\?new=subj-wad2/)
  await expect(page.getByTestId('shelf-flower')).toHaveCount(1)
  // read the garden store (going back to /garden would fetch the mocked seeds again)
  const where = await page.evaluate(() => {
    const garden = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('garden')
    return Object.fromEntries(garden.seeds.map((s) => [s.id, s.in_house]))
  })
  expect(where).toEqual({ mid: true, final: false }) // only the Midterm's seed moved
})
