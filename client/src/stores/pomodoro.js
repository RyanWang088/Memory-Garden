import { defineStore, acceptHMRUpdate } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useAuthStore } from './auth'
import { useToastStore } from './toast'
import { beep, ting, cancelSounds, unlockAudio, audioReady, unlockOnFirstInteraction } from '@/lib/beep'

const STORAGE_KEY = 'sproutly.pomodoro' // the running session, saved so a page refresh doesn't lose it

// one-click rhythms; 'custom' lets the user type their own focus and break
export const PRESETS = [
  { key: 'classic', name: 'Classic', focus: 25 * 60, rest: 5 * 60 },
  { key: 'deep', name: 'Deep work', focus: 50 * 60, rest: 10 * 60 },
]
export const MAX_ROUNDS = 12
export const COUNTDOWN_FROM = 5 // beep each second for the last 5 seconds of every block, then TING
// Coins for the focus minutes finished in one session: 2 coins for every full 5 minutes,
// nothing under 20 minutes, at most 48 (reached at 2 hours). 25 min -> 10, 50 min -> 20.
export const MIN_COIN_MINUTES = 20
export const MAX_FOCUS_COINS = 48
export function coinsFor(minutes) {
  if (minutes < MIN_COIN_MINUTES) return 0
  return Math.min(MAX_FOCUS_COINS, Math.floor(minutes / 5) * 2)
}

// mm:ss, or h:mm:ss once it is an hour or more
export function formatSeconds(total) {
  const h = Math.floor(total / 3600)
  const m = String(Math.floor(total / 60) % 60).padStart(2, '0')
  const s = String(total % 60).padStart(2, '0')
  return h ? `${h}:${m}:${s}` : `${m}:${s}`
}

// 6900 -> "1h 55 min", 600 -> "10 min", 90 -> "1 min 30 sec" (short times are allowed, handy for demos)
export function lengthText(total) {
  const h = Math.floor(total / 3600), m = Math.floor(total / 60) % 60, s = total % 60
  return [h && `${h}h`, m && `${m} min`, s && `${s} sec`].filter(Boolean).join(' ')
}

// Alternates focus/break blocks until `rounds` focus blocks are done, or until `total` seconds
// (breaks included) are used up, cutting the last block short to fit.
// A break at the very end has nothing to rest before, so it is dropped and the session ends early.
//   4 rounds of 25/5 -> focus 1, break 1, focus 2, break 2, focus 3, break 3, focus 4 (1h55m)
//   2h of 30/10      -> focus 1, break 1, focus 2, break 2, focus 3 (ends at 1h50m)
function buildBlocks(focus, rest, { rounds = Infinity, total = Infinity }) {
  const blocks = []
  let left = total, focusCount = 0, breakCount = 0
  while (left > 0 && focusCount < rounds) {
    const type = rest > 0 && blocks.length % 2 ? 'break' : 'focus' // a 0-minute break: focus blocks back to back
    const seconds = Math.min(type === 'focus' ? focus : rest, left)
    blocks.push({ type, number: type === 'focus' ? ++focusCount : ++breakCount, seconds })
    left -= seconds
  }
  if (blocks.at(-1)?.type === 'break') blocks.pop()
  return blocks
}

export const usePomodoroStore = defineStore('pomodoro', () => {
  const auth = useAuthStore()

  // setup answers
  const preset = ref(null) // a PRESETS key, 'custom', or null = not picked yet
  const focusSeconds = ref(PRESETS[0].focus)
  const breakSeconds = ref(PRESETS[0].rest)
  const endBy = ref('rounds')   // 'rounds' = stop after N focus blocks, 'time' = stop when the total is used up
  const rounds = ref(4)
  const totalSeconds = ref(2 * 3600)

  // session
  const phase = ref('setup') // setup -> running -> done
  const blocks = ref([])
  const index = ref(0)
  const remaining = ref(0)   // seconds left in the current block
  const running = ref(false)
  let endsAt = 0             // clock time the current block ends, so a background tab stays accurate
  let timer = null

  // a preset fills in its times; 'custom' keeps the current ones as a starting point to edit
  function choosePreset(key) {
    preset.value = key
    const chosen = PRESETS.find(p => p.key === key)
    if (chosen) {
      focusSeconds.value = chosen.focus
      breakSeconds.value = chosen.rest
    }
  }

  // the problem with each setup step ('' = fine)
  const errors = computed(() => ({
    // any length can be typed, even a few seconds (handy for demos); the steppers keep their own minimums
    rhythm: !preset.value ? 'Pick a rhythm to continue.'
      : breakSeconds.value > focusSeconds.value ? "Your break can't be longer than your focus block." : '',
    length: endBy.value === 'time' && focusSeconds.value > totalSeconds.value
      ? "The session can't be shorter than one focus block." : '',
  }))
  const setupError = computed(() => Object.values(errors.value).find(Boolean) ?? '')

  // the blocks the current answers would give, so setup can preview them before Start
  const plan = computed(() => buildBlocks(focusSeconds.value, breakSeconds.value,
    endBy.value === 'rounds' ? { rounds: rounds.value } : { total: totalSeconds.value }))

  const current = computed(() => blocks.value[index.value] ?? null)
  const next = computed(() => blocks.value[index.value + 1] ?? null)
  const mode = computed(() => current.value?.type ?? 'focus')
  const focusTotal = computed(() => blocks.value.filter(b => b.type === 'focus').length)
  const breakTotal = computed(() => blocks.value.length - focusTotal.value)
  const progress = computed(() => (current.value ? remaining.value / current.value.seconds : 1)) // 1 -> 0
  const label = computed(() => formatSeconds(remaining.value))

  function startSession() {
    if (setupError.value) return
    blocks.value = [...plan.value]
    focusDoneSeconds.value = 0
    rebookedBlock = -1 // block 0 of this new session hasn't been re-booked yet
    phase.value = 'running'
    beginBlock(0)
    resume()
  }

  function beginBlock(i) {
    index.value = i
    remaining.value = blocks.value[i].seconds
  }

  function resume() {
    if (running.value) return
    unlockAudio() // Start / Resume are clicks, so the browser lets the sounds play later
    endsAt = Date.now() + remaining.value * 1000
    startTicking()
  }
  function startTicking() {
    running.value = true
    timer = setInterval(tick, 250)
    bookSounds()
  }
  function pause() {
    running.value = false
    clearInterval(timer)
    cancelSounds()
  }

  // seconds left in the current block, worked out from the clock
  function secondsLeft() {
    return Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
  }

  // Books all the remaining countdown beeps and end-of-block TINGs in one go, so they play exactly
  // on time (even in a background tab). Called on Start / Resume.
  async function bookSounds() {
    await audioReady() // wait for the speakers to wake up, or every sound would come late
    if (!running.value) return // paused while waiting
    cancelSounds() // clear any older booking, so nothing plays twice
    let end = (endsAt - Date.now()) / 1000 // seconds from now until the current block ends
    for (let i = index.value; i < blocks.value.length; i++) {
      // 5, 4, 3, 2, 1: beep the moment the timer shows that number (none longer than the block itself)
      for (let s = 1; s <= COUNTDOWN_FROM; s++) {
        if (s < blocks.value[i].seconds && end - s > 0) beep(end - s)
      }
      ting(end)
      if (blocks.value[i + 1]) end += blocks.value[i + 1].seconds
    }
  }

  // back to setup for a fresh session: the rhythm and the to-do list are cleared so each session starts
  // anew (Custom starts again from the Classic times); the number of rounds is kept
  function endSession() {
    pause()
    if (phase.value === 'running') awardCoins() // End early still pays for the focus blocks already finished
    tasks.value = [] // the list can be filled in before Start, so it's cleared here, not when starting
    reviewsAdded = false // the next session gets fresh recommendations
    // forget the old blocks too, or the ring keeps the last block's look (e.g. a break) after End early
    blocks.value = []
    index.value = 0
    remaining.value = 0
    preset.value = null
    focusSeconds.value = PRESETS[0].focus
    breakSeconds.value = PRESETS[0].rest
    phase.value = 'setup'
  }

  // this session's to-do list (saved with the session below, so it survives a refresh too)
  const tasks = ref([])
  let nextTaskId = 1
  function addTask(text) {
    const trimmed = text.trim()
    if (trimmed) tasks.value.push({ id: nextTaskId++, text: trimmed, done: false })
  }
  function toggleTask(id) {
    const task = tasks.value.find(t => t.id === id)
    if (task) task.done = !task.done
  }
  function removeTask(id) {
    tasks.value = tasks.value.filter(t => t.id !== id)
  }
  // recommended reviews (the garden's "!" seeds) as normal tasks that remember their seed, so the
  // list can link to its review. Added once per session, so one the user removed doesn't come back.
  let reviewsAdded = false
  function addReviewTasks(seeds) {
    if (reviewsAdded) return
    reviewsAdded = true
    for (const seed of seeds) {
      if (tasks.value.some(t => t.seedId === seed.id)) continue
      tasks.value.push({ id: nextTaskId++, text: `Review: ${seed.title}`, done: false, seedId: seed.id })
    }
  }

  // pop-up on whatever page the user is on, saying what just started (the TING plays at the same time)
  function announce() {
    const toast = useToastStore()
    if (phase.value === 'done') {
      // short: the done card already shows how long you focused, and the coins pop-up comes right after
      toast.show({ type: 'success', title: 'Session complete 🌱', message: 'Nice work!' })
    } else if (mode.value === 'break') {
      toast.show({
        type: 'success', title: 'Break time ☕', duration: 8000,
        message: `Nice work! Step away and rest for ${lengthText(current.value.seconds)}.`,
      })
    } else {
      toast.show({
        type: 'warning', title: "Break's over 🌱", duration: 8000,
        message: `Back to focus for ${lengthText(current.value.seconds)}.`,
      })
    }
  }

  // runs 4x a second; breaks are scheduled, so the timer rolls straight into the next block
  let rebookedBlock = -1
  async function tick() {
    remaining.value = secondsLeft()
    // A few seconds before each countdown, book the beeps again from the real clock. Over a long block
    // the computer's sound clock can drift (Bluetooth earbuds especially), which made the beeps late.
    if (remaining.value <= COUNTDOWN_FROM + 3 && rebookedBlock !== index.value) {
      rebookedBlock = index.value
      bookSounds()
    }
    if (remaining.value > 0) return
    const finished = current.value
    if (next.value) {
      beginBlock(index.value + 1)
      // the next block starts exactly when this one ended (not when tick noticed), matching the booked sounds
      endsAt += current.value.seconds * 1000
      remaining.value = secondsLeft()
    } else {
      // session over: stop the timer, but not pause(), which would cut off the final TING
      running.value = false
      clearInterval(timer)
      phase.value = 'done'
    }
    announce()
    // a finished focus block counts towards the session's coins and the profile's study time
    if (finished.type === 'focus') {
      focusDoneSeconds.value += finished.seconds
      await auth.addStudyTime(finished.seconds).catch(console.error)
    }
    if (phase.value === 'done') awardCoins()
  }

  /* ---------- coins ----------
     Coins are given once per session, when it ends (finished or End early), for the focus minutes
     finished, worked out by coinsFor() at the top. */
  const focusDoneSeconds = ref(0) // focus time finished so far this session
  async function awardCoins() {
    const seconds = focusDoneSeconds.value
    focusDoneSeconds.value = 0 // so the same minutes are never paid twice
    const coins = coinsFor(Math.floor(seconds / 60))
    if (!coins) return
    const toast = useToastStore()
    try {
      await auth.updateProfile({ coins: auth.profile.coins + coins })
      toast.show({ type: 'reward', title: `+${coins} coins`, message: `For ${lengthText(seconds)} of focus.` })
    } catch {
      toast.show({ type: 'warning', message: "Your focus coins couldn't be saved. Please try again later." })
    }
  }

  /* ---------- keep the session through a page refresh ----------
     sessionStorage survives a refresh but is wiped when the tab closes, so an old session never comes back.
     While running we save endsAt (a clock time), so time that passes during the reload still counts. */
  function save() {
    try {
      if (phase.value === 'setup') return sessionStorage.removeItem(STORAGE_KEY)
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        phase: phase.value, blocks: blocks.value, index: index.value,
        running: running.value, endsAt, remaining: remaining.value, tasks: tasks.value, nextTaskId,
        focusDoneSeconds: focusDoneSeconds.value,
      }))
    } catch { /* storage blocked (e.g. private mode): the session just won't survive a refresh */ }
  }
  // remaining isn't watched (it changes every second); endsAt covers a running timer, and pause() changes running
  watch([phase, index, running, tasks, focusDoneSeconds], save, { deep: true })

  // called once when the app starts (App.vue): picks the saved session back up after a refresh
  function restore() {
    if (phase.value !== 'setup') return // already have a session (e.g. App.vue hot-reloaded)
    let saved
    try { saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY)) } catch { return }
    if (!saved?.blocks?.length) return
    phase.value = saved.phase
    blocks.value = saved.blocks
    index.value = saved.index
    remaining.value = saved.remaining
    tasks.value = saved.tasks
    nextTaskId = saved.nextTaskId
    focusDoneSeconds.value = saved.focusDoneSeconds ?? 0
    if (saved.phase === 'running' && saved.running) {
      endsAt = saved.endsAt
      startTicking() // no sound yet: the new page hasn't been clicked, so the browser blocks it
      tick()         // catch up at once (moves on if a block ended during the reload)
      unlockOnFirstInteraction(() => { if (running.value) bookSounds() })
    }
  }

  return {
    preset, focusSeconds, breakSeconds, endBy, rounds, totalSeconds, errors, setupError, plan, choosePreset,
    phase, blocks, index, remaining, running, current, next, mode, focusTotal, breakTotal, progress, label,
    startSession, resume, pause, endSession, restore,
    tasks, addTask, toggleTask, removeTask, addReviewTasks, focusDoneSeconds,
  }
})

// lets Vite swap in edits to this store without a page refresh (otherwise the old store stays in memory)
if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(usePomodoroStore, import.meta.hot))
