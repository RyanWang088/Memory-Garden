import { test, expect } from '@playwright/test'

const EMAIL = 'demo@smu.edu.sg'
const PASSWORD = 'demo@smu.edu.sg'
const ROUND_CHANGE = { timeout: 10_000 } // long enough for a round of a few seconds to end

// the tests share one account and its coins, so run them one at a time
test.describe.configure({ mode: 'serial' })

test.describe('Pomodoro feature', () => {
  // setup for every test: log in, then open the Focus page
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth')
    await page.getByTestId('auth-email').fill(EMAIL)
    await page.getByTestId('auth-password').fill(PASSWORD)
    await page.getByTestId('auth-submit').click()
    await expect(page).toHaveURL(/\/garden/, { timeout: 15_000 }) // the login page waits a moment before moving on
    await page.getByTestId('nav-pomodoro').click()
    await expect(page.getByTestId('pomodoro-setup')).toBeVisible()
  })

  test('Test 1: start a Classic session', async ({ page }) => {
    // actions: pick Classic and press Start
    await page.getByTestId('pomodoro-rhythm-classic').click()
    await page.getByTestId('pomodoro-start').click()

    // assert: the timer settings are gone and the timer is counting down
    await expect(page.getByTestId('pomodoro-setup')).toBeHidden()
    await expect(page.getByTestId('pomodoro-mode')).toContainText('Focus · 1 of 4')
    await expect(page.getByTestId('pomodoro-time')).not.toHaveText('25:00')
  })

  test('Test 2: run a full session from focus to the done card', async ({ page }) => {
    // actions: 3 s focus, 2 s break, 2 rounds, then Start
    await setTimer(page, { focus: '3', rest: '2', rounds: 2 })
    await page.getByTestId('pomodoro-start').click()

    // assert: the pop-ups appear as the rounds change
    await expect(page.getByText('Break time')).toBeVisible(ROUND_CHANGE)
    await expect(page.getByText("Break's over")).toBeVisible(ROUND_CHANGE)

    // assert: the done card shows the total focus time
    await expect(page.getByTestId('pomodoro-done')).toContainText('You focused for 6 sec.', ROUND_CHANGE)

    // actions: start another session
    await page.getByRole('button', { name: 'Start another' }).click()

    // assert: back at the timer settings
    await expect(page.getByTestId('pomodoro-setup')).toBeVisible()
  })

  test('Test 3: pause and resume', async ({ page }) => {
    // actions: start, then pause
    await page.getByTestId('pomodoro-start').click()
    await page.getByRole('button', { name: 'Pause' }).click()

    // assert: it says paused and the time stands still
    await expect(page.getByTestId('pomodoro-mode')).toContainText('paused')
    const pausedAt = await page.getByTestId('pomodoro-time').innerText()
    await page.waitForTimeout(1500)
    await expect(page.getByTestId('pomodoro-time')).toHaveText(pausedAt)

    // actions: resume
    await page.getByRole('button', { name: 'Resume' }).click()

    // assert: the time moves again
    await expect(page.getByTestId('pomodoro-mode')).not.toContainText('paused')
    await expect(page.getByTestId('pomodoro-time')).not.toHaveText(pausedAt)
  })

  test('Test 4: end early after a finished round', async ({ page }) => {
    // actions: finish round 1, then press End early during the break
    await setTimer(page, { focus: '3', rest: '3', rounds: 2 })
    await page.getByTestId('pomodoro-start').click()
    await expect(page.getByText('Break time')).toBeVisible(ROUND_CHANGE)
    await page.getByRole('button', { name: 'End early' }).click()

    // assert: the done card counts only the finished round, and the break pop-up has closed
    await expect(page.getByTestId('pomodoro-done')).toContainText('You focused for 3 sec.')
    await expect(page.getByText('Break time')).toBeHidden()
  })

  test('Test 5: a 25 minute round earns 10 coins', async ({ page }) => {
    const coinsBefore = await coins(page)

    // actions: 1 Classic round, then skip the 25 minutes with the fake clock
    await page.clock.install()
    await page.getByTestId('pomodoro-rhythm-classic').click()
    await setRounds(page, 1)
    await expect(page.getByTestId('pomodoro-reward')).toContainText('+10 coins when you finish')
    await page.getByTestId('pomodoro-start').click()
    await expect(page.getByTestId('pomodoro-mode')).toContainText('Focus · 1 of 1')
    await page.clock.fastForward(25 * 60 * 1000)

    // assert: the done card, the coins pop-up and the coin count
    await expect(page.getByTestId('pomodoro-done')).toContainText('You focused for 25 min.')
    await expect(page.getByText('+10 coins')).toBeVisible()
    await expect(page.getByTestId('nav-coins')).toHaveText(String(coinsBefore + 10))
  })

  test('Test 6: use the to-do list during a session', async ({ page }) => {
    // actions: start a short session, add two tasks and tick one
    await setTimer(page, { focus: '12', rest: '1', rounds: 1 })
    await page.getByTestId('pomodoro-start').click()
    await page.getByTestId('todo-input').fill('Wad2')
    await page.getByTestId('todo-input').press('Enter')
    await page.getByTestId('todo-input').fill('IDP')
    await page.getByTestId('todo-input').press('Enter')
    await page.getByRole('checkbox', { name: 'Mark “Wad2” done' }).click()

    // assert: both are on the list, and the ticked one is marked done
    await expect(page.getByTestId('session-todo')).toContainText('IDP')
    await expect(page.getByRole('checkbox', { name: 'Mark “Wad2” not done' })).toBeVisible()

    // assert: the done card only counts the task ticked in this session
    await expect(page.getByTestId('pomodoro-done')).toContainText('You ticked off 1 task.', { timeout: 15_000 })
  })

  test('Test 7: the mini timer follows you to other pages', async ({ page }) => {
    // actions: start a session and go to the garden
    await page.getByTestId('pomodoro-start').click()
    await page.getByTestId('nav-garden').click()

    // assert: the mini timer shows with the time running
    await expect(page.getByTestId('focus-player')).toBeVisible()
    await expect(page.getByTestId('focus-player')).toContainText('Focus 1/4')

    // actions + assert: it can pause the session
    await page.getByTestId('focus-player-toggle').click()
    await expect(page.getByTestId('focus-player')).toContainText('paused')
    await page.getByTestId('focus-player-toggle').click()
    await expect(page.getByTestId('focus-player')).not.toContainText('paused')

    // actions + assert: ↗ opens the Focus page, where the big timer replaces it
    await page.getByRole('link', { name: 'Open the Focus page' }).click()
    await expect(page).toHaveURL(/\/pomodoro/)
    await expect(page.getByTestId('pomodoro-time')).toBeVisible()
    await expect(page.getByTestId('focus-player')).toBeHidden()
    await page.getByTestId('nav-garden').click()

    // actions + assert: – hides it, and it comes back after a visit to the Focus page
    await page.getByTestId('focus-player-hide').click()
    await expect(page.getByTestId('focus-player')).toBeHidden()
    await page.getByTestId('nav-pomodoro').click()
    await page.getByTestId('nav-garden').click()
    await expect(page.getByTestId('focus-player')).toBeVisible()
  })

  test('Test 8: control Garden Radio', async ({ page }) => {
    const radio = page.getByTestId('pomodoro').getByTestId('garden-radio')

    // actions: play, then skip to the next song
    await radio.getByTestId('radio-play').click()
    await expect(radio.getByRole('button', { name: 'Pause music' })).toBeVisible()
    const firstSong = await radio.getByTestId('radio-title').innerText()
    await radio.getByTestId('radio-next').click()

    // assert: a different song is playing
    await expect(radio.getByTestId('radio-title')).not.toHaveText(firstSong)

    // actions + assert: the volume slider moves
    await radio.getByRole('slider', { name: 'Music volume' }).fill('0.85')
    await expect(radio.getByRole('slider', { name: 'Music volume' })).toHaveValue('0.85')

    // actions + assert: each mood updates the label, and Auto goes back to matching the weather
    for (const mood of ['sunny', 'cloudy', 'rainy', 'stormy']) {
      await radio.getByTestId(`radio-mood-${mood}`).click()
      await expect(radio.getByTestId('radio-match')).toContainText(mood)
    }
    await radio.getByTestId('radio-mood-auto').click()
    await expect(radio.getByTestId('radio-match')).toContainText('matched to')

    // actions + assert: the navbar's music button turns it off and on
    await page.getByTestId('music-toggle').click()
    await expect(page.getByTestId('music-toggle')).toHaveAttribute('aria-pressed', 'false')
    await page.getByTestId('music-toggle').click()
    await expect(page.getByTestId('music-toggle')).toHaveAttribute('aria-pressed', 'true')
  })

  test('Test 9: planner tasks show in the Focus to-do list', async ({ page }) => {
    // actions: add a task for today in the planner, then open Focus
    await page.getByTestId('nav-planner').click()
    await page.getByTestId('planner-new-task').fill('Finish lab report')
    await page.getByTestId('planner-add').click()
    await expect(page.getByTestId('planner-task')).toContainText('Finish lab report')
    await page.getByTestId('nav-pomodoro').click()

    // assert: it's on the Focus to-do list
    await expect(page.getByTestId('session-todo')).toContainText('Finish lab report')

    // actions: tick it in Focus, then go back to the planner
    await page.getByRole('checkbox', { name: 'Mark “Finish lab report” done' }).click()
    await page.getByTestId('nav-planner').click()

    // assert: it's ticked in the planner too
    await expect(page.getByRole('checkbox', { name: 'Mark “Finish lab report” not done' })).toBeVisible()
  })

  test('Test 10: end early pays for the finished round only', async ({ page }) => {
    const coinsBefore = await coins(page)

    // actions: 2 rounds of 20 min with 3 min breaks, skip to 10 minutes into round 2, then end early
    await page.clock.install()
    await setTimer(page, { focus: '2000', rest: '300', rounds: 2 })
    await page.getByTestId('pomodoro-start').click()
    await expect(page.getByTestId('pomodoro-mode')).toContainText('Focus · 1 of 2')
    await page.clock.fastForward(20 * 60 * 1000)
    await expect(page.getByTestId('pomodoro-mode')).toContainText('Break · 1 of 1')
    await page.clock.fastForward(3 * 60 * 1000)
    await expect(page.getByTestId('pomodoro-mode')).toContainText('Focus · 2 of 2')
    await page.clock.fastForward(10 * 60 * 1000)
    await page.getByRole('button', { name: 'End early' }).click()

    // assert: only the finished 20 minutes count, so 8 coins
    await expect(page.getByTestId('pomodoro-done')).toContainText('You focused for 20 min.')
    await expect(page.getByText('+8 coins')).toBeVisible()
    await expect(page.getByTestId('nav-coins')).toHaveText(String(coinsBefore + 8))
  })
})

// types the times (the recorder can't capture digits typed into these boxes) and sets the rounds
async function setTimer(page, { focus, rest, rounds }) {
  await typeTime(page, 'pomodoro-focus', focus)
  await typeTime(page, 'pomodoro-break', rest)
  await setRounds(page, rounds)
}

async function typeTime(page, testId, digits) {
  await page.getByTestId(testId).click()
  await page.keyboard.type(digits)
  await page.keyboard.press('Enter')
}

// every session starts on 4 rounds
async function setRounds(page, rounds) {
  for (let n = 4; n > rounds; n--) await page.getByRole('button', { name: 'One round less' }).click()
}

async function coins(page) {
  return Number((await page.getByTestId('nav-coins').innerText()).trim())
}