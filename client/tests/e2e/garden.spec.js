import { test, expect } from '@playwright/test'

const EMAIL = 'demo@smu.edu.sg'
const PASSWORD = 'demo@smu.edu.sg'
const COINS = 500

test.describe('Garden', () => {
  test('shows a plant stage change after a review', async ({ page }) => {
    const seed = makeSeed({ id: 'stage-change', title: 'Stage change', mastery: 24 })
    await openGarden(page, [seed])
    await expect(plant(page, seed.title)).toHaveAttribute('data-stage', '1')

    await reviewOnce(page, seed)

    await expect(plant(page, seed.title)).toHaveAttribute('data-stage', '2')
    await expect(plant(page, seed.title)).not.toHaveAttribute('data-wilting')
  })

  test('deletes a seed from the garden with the shovel', async ({ page }) => {
    const seed = makeSeed({ id: 'shovel-target', title: 'Shovel target' })
    await openGarden(page, [seed])

    await page.getByRole('button', { name: 'Weed' }).click()
    await clickPlant(page, seed.title)
    const confirmation = page.getByRole('alertdialog', { name: `Delete ${seed.title}?` })
    await expect(confirmation).toBeVisible()
    await confirmation.getByRole('button', { name: 'Delete plant' }).click()

    await expect(page.getByText('Plant removed')).toBeVisible()
    await expect(page.getByRole('button', { name: `Open ${seed.title}` })).toHaveCount(0)
  })

  test('moves a finished subject into the flower house', async ({ page }) => {
    const seed = makeSeed({
      id: 'finished-subject',
      title: 'Finished subject',
      subject: 'Biology',
      subjectId: 'biology-subject',
      examId: 'biology-final',
      examName: 'Final',
      examDate: dateDaysAgo(1),
    })
    await openGarden(page, [seed])

    const prompt = page.getByRole('dialog', { name: 'Biology Final is over' })
    await expect(prompt).toBeVisible()
    await prompt.getByRole('button', { name: 'Move to house' }).click()

    await expect(page).toHaveURL(/\/profile/)
    await expect(page.getByRole('heading', { name: 'Your flower house' })).toBeVisible()
    await expect(page.getByLabel('Biology')).toBeVisible()
  })

  test('buys a new seed type when the gardener has enough coins', async ({ page }) => {
    await openGarden(page, [])

    await expect(page.getByTestId('shed-seeds')).toBeVisible()
    await expect(page.getByTestId('nav-coins')).toHaveText(String(COINS))
    await page.getByRole('button', { name: 'Buy Rose for 100 coins' }).click()

    await expect(page.getByRole('button', { name: 'Rose seed' })).toBeVisible()
    await expect(page.getByTestId('nav-coins')).toHaveText(String(COINS - 100))
    await expect(page.getByText('New plant species unlocked')).toBeVisible()
  })

  test('edits a planted seed with the Prune tool', async ({ page }) => {
    const seed = makeSeed({ id: 'prune-target', title: 'Before pruning' })
    await openGarden(page, [seed])

    await page.getByRole('button', { name: 'Prune' }).click()
    await clickPlant(page, seed.title)
    await expect(page).toHaveURL(/\/garden\/seeds\/[^/]+\/edit$/)

    await page.getByLabel('Study set name').fill('After pruning')
    await page.getByRole('button', { name: 'Save changes' }).click()

    await expect(page).toHaveURL(/\/garden(?:\?|$)/)
    await expect(page.getByRole('button', { name: 'Open After pruning' })).toBeVisible()
    await expect(page.getByText('Seed updated')).toBeVisible()
  })

  test('revives a wilted plant after one revision session', async ({ page }) => {
    const seed = makeSeed({
      id: 'revival-target',
      title: 'Wilted subject',
      mastery: 80,
      lastReviewed: new Date(Date.now() - 7 * 86_400_000).toISOString(),
    })
    await openGarden(page, [seed])
    await expect(plant(page, seed.title)).toHaveAttribute('data-stage', '6')
    await expect(plant(page, seed.title)).toHaveAttribute('data-wilting', 'true')

    await reviewOnce(page, seed)

    await expect(plant(page, seed.title)).toHaveAttribute('data-stage', '4')
    await expect(plant(page, seed.title)).not.toHaveAttribute('data-wilting')
  })

  test('shows the mocked weather and the sky phase for the returned local time', async ({ page }) => {
    await openGarden(page, [])

    const sky = page.locator('.scenery').first()
    await expect(sky).toHaveAttribute('data-weather', 'rainy')
    await expect(sky).toHaveAttribute('data-mood', 'dusk')
    await expect(page.locator('.rain').first()).toHaveAttribute('data-weather', 'rainy')
  })
})

async function openGarden(page, seeds) {
  await installFixtures(page, seeds)
  await page.goto('/auth')
  await page.getByLabel('Email').fill(EMAIL)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page).toHaveURL(/\/garden/, { timeout: 15_000 })

  if (seeds.length) {
    await page.goto(`/garden?scrollTo=${encodeURIComponent(seeds[0].id)}`)
    await expect(page).toHaveURL(/\/garden$/)
    await expect(page.getByRole('button', { name: `Open ${seeds[0].title}` })).toBeVisible()
  }
}

async function installFixtures(page, initialSeeds) {
  let seeds = JSON.parse(JSON.stringify(initialSeeds))
  let profile = {
    coins: COINS,
    unlocked_flowers: ['tulip'],
    shelf_unlocked: false,
    streak: 3,
    best_streak: 3,
    last_tended: new Date().toISOString(),
    study_seconds: 0,
    onboarded: true,
    onboarding_answers: { flower: 'pink' },
  }

  await page.route(/\/rest\/v1\/profiles\?/, async route => {
    const request = route.request()
    if (request.method() === 'PATCH') {
      profile = { ...profile, ...request.postDataJSON() }
    }
    const idFilter = new URL(request.url()).searchParams.get('id')
    const response = { ...profile, id: idFilter?.replace(/^eq\./, '') }
    await route.fulfill({ json: response })
  })

  await page.route(/\/rest\/v1\/flowers\?/, route => route.fulfill({
    json: [
      { id: 'tulip', name: 'Tulip', price: 0 },
      { id: 'rose', name: 'Rose', price: 100 },
    ],
  }))

  await page.route(/\/rest\/v1\/rpc\/(buy_flower|choose_exam_outcome)$/, async route => {
    const { pathname } = new URL(route.request().url())
    if (pathname.endsWith('/buy_flower')) {
      profile = { ...profile, coins: profile.coins - 100, unlocked_flowers: ['tulip', 'rose'] }
      await route.fulfill({ json: { coins: profile.coins, unlocked_flowers: profile.unlocked_flowers } })
      return
    }
    await route.fulfill({ json: { shelf_slot: 0, exam_choice: 'house' } })
  })

  await page.route(/\/api\/weather(?:\?.*)?$/, route => route.fulfill({
    json: {
      timezone: 'Asia/Singapore',
      code: 61,
      condition: 'rainy',
      isDay: true,
      temperature: 27,
      precipitation: 1.2,
      nowMin: 1170,
      sunrise: 360,
      sunset: 1140,
      daily: [
        { date: '2026-11-05', max: 30, min: 25, precipitation: 1.2 },
        { date: '2026-11-06', max: 30, min: 25, precipitation: 0 },
        { date: '2026-11-07', max: 30, min: 25, precipitation: 0 },
      ],
    },
  }))

  await page.route(/\/api\/seeds(?:\/[^/?]+)?(?:\/reviews)?(?:\?.*)?$/, async route => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const seedId = path.split('/')[3]

    if (request.method() === 'GET' && !seedId) {
      await route.fulfill({ json: seeds })
      return
    }
    if (request.method() === 'POST' && !seedId) {
      const seed = { ...request.postDataJSON(), id: 'created-seed', cards: [] }
      seeds.push(seed)
      await route.fulfill({ json: seed })
      return
    }
    const seed = seeds.find(item => item.id === seedId)
    if (!seed) {
      await route.fulfill({ status: 404, json: { error: 'Seed not found' } })
      return
    }

    if (request.method() === 'DELETE') {
      seeds = seeds.filter(item => item.id !== seedId)
      await route.fulfill({ json: { ok: true } })
      return
    }
    if (request.method() === 'PUT') {
      Object.assign(seed, request.postDataJSON())
      await route.fulfill({ json: seed })
      return
    }
    if (request.method() === 'PATCH') {
      Object.assign(seed, request.postDataJSON())
      await route.fulfill({ json: seed })
      return
    }
    if (request.method() === 'POST' && path.endsWith('/reviews')) {
      const { ratings } = request.postDataJSON()
      seed.mastery = Math.min(100, seed.mastery + ratings.length * 5)
      seed.last_reviewed = new Date().toISOString()
      await route.fulfill({ json: seed })
      return
    }
    await route.continue()
  })
}

function makeSeed({
  id,
  title,
  mastery = 0,
  lastReviewed = new Date().toISOString(),
  subject = title,
  subjectId = `subject-${id}`,
  examId = null,
  examName = null,
  examDate = null,
}) {
  return {
    id,
    title,
    subject,
    subject_id: subjectId,
    exam_id: examId,
    exam_name: examName,
    exam_date: examDate,
    exam_choice: null,
    shelf_slot: null,
    in_house: false,
    col: 7,
    row: 12,
    mastery,
    last_reviewed: lastReviewed,
    flower: 'tulip',
    color: 'pink',
    tags: [],
    alert: false,
    priority: 0,
    cards: [{
      id: `card-${id}`,
      question: 'What does this subject teach?',
      answer: 'The answer',
      wrong_options: [],
      card_mastery: 0,
      next_review: null,
    }],
  }
}

function dateDaysAgo(days) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function plant(page, title) {
  const openButton = page.getByRole('button', { name: `Open ${title}` })
  return page.locator('.plant').filter({ has: openButton })
}

async function clickPlant(page, title) {
  const sprite = page.getByRole('button', { name: `Open ${title}` })
  const bounds = await sprite.boundingBox()
  expect(bounds, `Expected ${title} to be in the garden`).not.toBeNull()
  await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height * 0.85)
}

async function reviewOnce(page, seed) {
  await clickPlant(page, seed.title)
  await page.getByRole('button', { name: 'Flashcard' }).click()
  await page.getByTestId('show-answer').click()
  await page.getByTestId('rate-easy').click()
  await expect(page.getByTestId('deck-results')).toBeVisible()
  await page.getByRole('button', { name: /Water my plant/ }).click()
  await expect(page).toHaveURL(/\/garden(?:\?|$)/)
}