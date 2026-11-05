import { test, expect } from '@playwright/test'

const EMAIL = 'demo@smu.edu.sg'
const PASSWORD = 'demo@smu.edu.sg'
const SEED = 'demo for prof'

// the cards of "demo for prof": question -> correct answer (the full-marks quiz needs them)
const ANSWERS = {
  'What is 15 × 4?': '60',
  'Which gas do plants absorb during photosynthesis?': 'Carbon dioxide',
  'What is the opposite of "Brave"?': 'Cowardly',
}

// the tests share one account and its coins, so run them one at a time
test.describe.configure({ mode: 'serial' })

test.describe('Review feature', () => {
  // setup for every test: log in, then scroll the garden to the plant
  // (it sits at the back of the meadow, behind the hill, where it can't be clicked)
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth')
    await page.getByTestId('auth-email').fill(EMAIL)
    await page.getByTestId('auth-password').fill(PASSWORD)
    await page.getByTestId('auth-submit').click()
    await expect(page).toHaveURL(/\/garden/, { timeout: 15_000 }) // the login page waits a moment before moving on
    const seedId = await page.locator('.plant-info', { hasText: SEED }).getAttribute('data-seed-id')
    await page.goto(`/garden?scrollTo=${seedId}`)
    await expect(page).toHaveURL(/\/garden$/) // the garden drops ?scrollTo once it has scrolled
    await expect(plant(page)).toBeVisible()
  })

  test('Test 1: show review controls above a selected plant', async ({ page }) => {
    // actions: select the plant
    await openPlant(page)

    // assert: the plant info and three floating review buttons appear in the garden
    await expect(page).toHaveURL(/\/garden$/)
    const plantInfo = page.locator('.plant-info-details.is-visible') // every plant has a label; only the selected one shows
    await expect(plantInfo.locator('.plant-title')).toHaveText(SEED)
    await expect(plantInfo.locator('.plant-mastery')).toHaveText(/Mastery \d+%/i)
    const flashcard = page.getByTestId('review-flashcard')
    await expect(flashcard).toBeVisible()
    const actions = [
      flashcard,
      page.getByTestId('review-multiple-choice-quiz'),
      page.getByTestId('review-short-structured'),
    ]
    for (const action of actions) {
      await expect(action).toBeVisible()
      const receivesPointer = await action.evaluate((button) => {
        const rect = button.getBoundingClientRect()
        const target = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
        return target === button || button.contains(target)
      })
      expect(receivesPointer).toBe(true)
    }
    await flashcard.hover()
    await expect(flashcard.locator('.tip')).toHaveCSS('opacity', '1')
  })

  test('Test 2: should finish Flashcard Mode and water the plant', async ({ page }) => {
    const coinsBefore = await coins(page)

    // actions: open Flashcard Mode, flip each card and rate it Easy
    await openPlant(page)
    await page.getByTestId('review-flashcard').click()
    const total = await totalOf(page.getByTestId('card-count')) // "Card 1 of N"
    for (let i = 0; i < total; i++) {
      await page.getByTestId('show-answer').click()
      await page.getByTestId('rate-easy').click()
    }
    await expect(page.getByTestId('deck-results')).toBeVisible()
    await page.getByTestId('deck-finish').click()

    // assert: back in the garden, the plant is watered (not wilting) and no coins were given
    await expect(page).toHaveURL(/\/garden/)
    await expect(page.getByText('Session saved')).toBeVisible()
    await expect(page.locator('.plant').filter({ has: plant(page) })).not.toHaveAttribute('data-wilting')
    expect(await coins(page)).toBe(coinsBefore)
  })

  test('Test 3: get full marks in the quiz, show confetti and claim 30 coins', async ({ page }) => {
    const coinsBefore = await coins(page)

    // actions: open the Multiple Choice Quiz and pick the correct answer for every question
    await openPlant(page)
    await page.getByTestId('review-multiple-choice-quiz').click()
    const total = await totalOf(questionCount(page))
    for (let i = 0; i < total; i++) {
      const question = await page.locator('h2.question').innerText()
      await page.getByRole('button', { name: ANSWERS[question], exact: true }).click()
      await page.getByTestId('quiz-next').click()
    }

    // assert: confetti rains, the reward is 30 coins, and claiming adds them to the coin count
    await expect(page.getByTestId('confetti')).toBeVisible()
    await expect(page.getByTestId('quiz-results')).toBeVisible()
    await expect(page.getByTestId('quiz-reward')).toHaveText('+30')
    await page.getByTestId('quiz-claim').click()
    await expect(page).toHaveURL(/\/garden/)
    await expect(page.getByText('+30 coins')).toBeVisible()
    await expect(page.getByTestId('nav-coins')).toHaveText(String(coinsBefore + 30))
  })

  test('Test 4: should give no coins below 60% for short-structured questions', async ({ page }) => {
    // setup: the AI marks every answer 20% (faked, so the score is the same on every run)
    await fakeMarking(page, { score: 20, rating: 'short_wrong', feedback: 'This does not answer the question.' })
    const coinsBefore = await coins(page)

    // actions: open Short Structured Mode and answer every question
    await answerAllShort(page, '20%')

    // assert: a 20% average earns 0 coins, and claiming leaves the coin count unchanged
    await expect(page.getByTestId('short-results')).toBeVisible()
    await expect(page.getByTestId('short-reward')).toHaveText('+0')
    await expect(page.getByText('Average 60% or more to earn coins')).toBeVisible()
    await page.getByTestId('short-claim').click()
    await expect(page).toHaveURL(/\/garden/)
    expect(await coins(page)).toBe(coinsBefore)
  })

  test('Test 5: should mark a typed answer in short-structured questions', async ({ page }) => {
    // setup: the AI marks the answer 100% (faked, so the verdict is the same on every run)
    await fakeMarking(page, { score: 100, rating: 'short_correct', feedback: 'Spot on, well done!' })

    // actions: open Short Structured Mode, type the correct answer to the first question and check it
    await openPlant(page)
    await page.getByTestId('review-short-structured').click()
    const question = await page.locator('h2.question').innerText()
    await page.getByTestId('short-answer').fill(ANSWERS[question])
    const marking = page.waitForRequest('**/api/seeds/*/grade')
    await page.getByTestId('short-check').click()

    // assert: the typed answer is sent for marking, and its score, feedback and the model answer are shown
    expect((await marking).postDataJSON().response).toBe(ANSWERS[question])
    const verdict = page.getByTestId('short-verdict')
    await expect(verdict.locator('.verdict-title')).toHaveText('Correct')
    await expect(verdict).toContainText('100%')
    await expect(verdict).toContainText('Spot on, well done!')
    await expect(page.getByText('Model answer')).toBeVisible()
    await expect(page.getByTestId('short-next')).toBeVisible()
  })

  // Boundary tests: coins start at an average of 60% in Short Structured Mode,
  // so check the values right on each side of that line (59% and 60%).

  test('Test 6: should give no coins at 59%, just below the 60% line', async ({ page }) => {
    // setup: the AI marks every answer 59%
    await fakeMarking(page, { score: 59, rating: 'short_partial', feedback: 'Nearly there.' })
    const coinsBefore = await coins(page)

    // actions: answer every question, then claim
    await answerAllShort(page, '59%')

    // assert: 59% is below the line, so 0 coins
    await expect(page.getByTestId('short-reward')).toHaveText('+0')
    await page.getByTestId('short-claim').click()
    await expect(page).toHaveURL(/\/garden/)
    expect(await coins(page)).toBe(coinsBefore)
  })

  test('Test 7: should give 15 coins at exactly 60%', async ({ page }) => {
    // setup: the AI marks every answer 60%
    await fakeMarking(page, { score: 60, rating: 'short_partial', feedback: 'Some key points are there.' })
    const coinsBefore = await coins(page)

    // actions: answer every question, then claim
    await answerAllShort(page, '60%')

    // assert: 60% is on the line, so it earns the lowest reward (15 coins)
    await expect(page.getByTestId('short-reward')).toHaveText('+15')
    await page.getByTestId('short-claim').click()
    await expect(page).toHaveURL(/\/garden/)
    await expect(page.getByText('+15 coins')).toBeVisible()
    await expect(page.getByTestId('nav-coins')).toHaveText(String(coinsBefore + 15))
  })

  // Boundary test: confetti starts at 75% in the Multiple Choice Quiz (Test 3 covers 100%).

  test('Test 8: should give 10 coins and no confetti at 67% in the Multiple Choice Quiz, below the 75% line', async ({ page }) => {
    const coinsBefore = await coins(page)

    // actions: open the Multiple Choice Quiz, answer every question right except the last one
    await openPlant(page)
    await page.getByTestId('review-multiple-choice-quiz').click()
    const total = await totalOf(questionCount(page))
    expect(total, '2 of 3 right is 67%, so this test needs the 3-card seed').toBe(3)
    for (let i = 0; i < total; i++) {
      const question = await page.locator('h2.question').innerText()
      const texts = await page.getByRole('group', { name: 'Answer options' }).getByRole('button').allInnerTexts()
      const pick = i < total - 1 ? ANSWERS[question] : texts.find(t => t.trim() !== ANSWERS[question]) // the last one: any wrong option
      await page.getByRole('button', { name: pick.trim(), exact: true }).click()
      await page.getByTestId('quiz-next').click()
    }

    // assert: 67% earns 10 coins (60%+) but no confetti (75%+)
    await expect(page.getByTestId('quiz-results')).toBeVisible()
    await expect(page.getByTestId('confetti')).toHaveCount(0)
    await expect(page.getByTestId('quiz-reward')).toHaveText('+10')
    await page.getByTestId('quiz-claim').click()
    await expect(page).toHaveURL(/\/garden/)
    await expect(page.getByTestId('nav-coins')).toHaveText(String(coinsBefore + 10))
  })
})

// opens Short Structured Mode and answers every question, checking each faked mark shows the expected score
async function answerAllShort(page, expectedScore) {
  await openPlant(page)
  await page.getByTestId('review-short-structured').click()
  const total = await totalOf(questionCount(page))
  for (let i = 0; i < total; i++) {
    await page.getByTestId('short-answer').fill('My answer')
    await page.getByTestId('short-check').click()
    await expect(page.getByTestId('short-verdict')).toContainText(expectedScore)
    await page.getByTestId('short-next').click()
  }
  await expect(page.getByTestId('short-results')).toBeVisible()
}

// the "demo for prof" plant in the garden: its sprite is the button (the plant's own box is 0x0)
function plant(page) {
  return page.getByRole('button', { name: `Open ${SEED}` })
}

// clicks the plant low on its stem: the droplet badge in the middle of the sprite doesn't open it
// (a raw mouse click: the sprite always sways, so locator.click() would wait forever for it to hold still)
async function openPlant(page) {
  const box = await plant(page).boundingBox()
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.85)
}

// answers the AI marking request (POST /api/seeds/:id/grade) with a fixed mark instead of calling the AI
async function fakeMarking(page, mark) {
  await page.route('**/api/seeds/*/grade', route => route.fulfill({ json: mark }))
}

// the "Question 1 of N" label of a quiz
function questionCount(page) {
  return page.getByText(/^Question \d+ of \d+$/)
}

async function totalOf(label) {
  await expect(label).toBeVisible()
  return Number((await label.textContent()).match(/of\s+(\d+)/i)[1])
}

async function coins(page) {
  return Number((await page.getByTestId('nav-coins').innerText()).trim())
}