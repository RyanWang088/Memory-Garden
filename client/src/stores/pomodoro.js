import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useAuthStore } from './auth'
import { useToastStore } from './toast'
import { useGardenStore } from './garden'
import { usePlannerStore, isoDay } from './planner'
import { beep, ting, cancelSounds, unlockAudio, audioReady, unlockOnFirstInteraction } from '@/lib/beep'

const STORAGE_KEY = 'sproutly.pomodoro' // where the running session is saved (survives a refresh)

// the Classic and Deep work buttons
export const PRESETS = [
  { key: 'classic', name: 'Classic', focus: 25 * 60, rest: 5 * 60 },
  { key: 'deep', name: 'Deep work', focus: 50 * 60, rest: 10 * 60 },
]
export const MAX_ROUNDS = 12
export const COUNTDOWN_FROM = 5 // beep on 5-4-3-2-1 before each block ends, then TING
// Coins for one session: 2 per full 5 focus minutes, none under 20 min, max 48 (25 min -> 10, 50 min -> 20)
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

// 6900 -> "1h 55 min", 90 -> "1 min 30 sec"
export function lengthText(total) {
  const h = Math.floor(total / 3600), m = Math.floor(total / 60) % 60, s = total % 60
  return [h && `${h}h`, m && `${m} min`, s && `${s} sec`].filter(Boolean).join(' ')
}

// The session's blocks in order, e.g. 4 rounds of 25/5 -> focus, break, focus, break, focus, break, focus
// (no break at the very end)
function buildBlocks(focus, rest, rounds) {
  const blocks = []
  let focusCount = 0, breakCount = 0
  while (focusCount < rounds) {
    const type = rest > 0 && blocks.length % 2 ? 'break' : 'focus' // 0-min break: focus blocks back to back
    const seconds = type === 'focus' ? focus : rest
    blocks.push({ type, number: type === 'focus' ? ++focusCount : ++breakCount, seconds })
  }
  if (blocks.at(-1)?.type === 'break') blocks.pop()
  return blocks
}

export const usePomodoroStore = defineStore('pomodoro', () => {
  const auth = useAuthStore()

  // timer settings
  const preset = ref(null) // 'classic', 'deep', 'custom', or null
  const focusSeconds = ref(PRESETS[0].focus)
  const breakSeconds = ref(PRESETS[0].rest)
  const rounds = ref(4)

  // the session
  const phase = ref('setup') // setup -> running -> done
  const blocks = ref([])
  const index = ref(0)
  const remaining = ref(0)   // seconds left in the current block
  const running = ref(false)
  let endsAt = 0             // clock time the current block ends (keeps time right in a background tab)
  let timer = null

  // a preset fills in its times; 'custom' keeps the current ones
  function choosePreset(key) {
    preset.value = key
    const chosen = PRESETS.find(p => p.key === key)
    if (chosen) {
      focusSeconds.value = chosen.focus
      breakSeconds.value = chosen.rest
    }
  }

  // error to show under the settings ('' = fine)
  // any length can be typed (even seconds, for demos); the − / + buttons keep their own minimums
  const setupError = computed(() => (breakSeconds.value > focusSeconds.value
    ? "Your break can't be longer than your focus duration." : ''))

  // the blocks the current settings would give
  const plan = computed(() => buildBlocks(focusSeconds.value, breakSeconds.value, rounds.value))

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
    // remember what's already ticked, so the done screen only counts tasks ticked during the session
    doneAtStart.value = [...usePlannerStore().tasks, ...tasks.value].filter(t => t.done).map(t => t.id)
    rebookedBlock = -1 // the new session's sounds haven't been re-booked yet
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
    unlockAudio() // Start / Resume are clicks, which lets the browser play sounds
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

  // books every countdown beep and TING left in the session, so they play on time (even in a background tab)
  async function bookSounds() {
    await audioReady() // wait for the speakers to be ready, or the sounds come late
    if (!running.value) return // paused while waiting
    cancelSounds() // clear old bookings so nothing plays twice
    let end = (endsAt - Date.now()) / 1000 // seconds until the current block ends
    for (let i = index.value; i < blocks.value.length; i++) {
      // beep as the timer shows 5, 4, 3, 2, 1 (never longer than the block)
      for (let s = 1; s <= COUNTDOWN_FROM; s++) {
        if (s < blocks.value[i].seconds && end - s > 0) beep(end - s)
      }
      ting(end)
      if (blocks.value[i + 1]) end += blocks.value[i + 1].seconds
    }
  }

  // End early: with a focus block finished, show the done card (and pay coins) for the finished part;
  // with none finished, go straight back to the settings
  function endEarly() {
    if (!focusDoneSeconds.value) return endSession({ keepTasks: true })
    pause()
    blocks.value = blocks.value.slice(0, index.value) // keep only the finished blocks
    phase.value = 'done'
    announce()
    awardCoins()
  }

  // back to the settings for a new session (the number of rounds is kept);
  // keepTasks carries unfinished typed tasks over, and logging out leaves it off so the next user starts empty
  function endSession({ keepTasks = false } = {}) {
    pause()
    useToastStore().dismiss(roundToast)
    if (phase.value === 'running') awardCoins() // pays for focus blocks already finished
    tasks.value = keepTasks ? tasks.value.filter(t => !t.seedId && !t.done) : [] // reviews load fresh next session
    offeredSeedIds = [] // next session gets fresh recommendations
    hiddenPlannerIds.value = [] // and shows hidden planner tasks again
    // clear the old blocks so the ring goes back to its focus look
    blocks.value = []
    index.value = 0
    remaining.value = 0
    preset.value = null
    focusSeconds.value = PRESETS[0].focus
    breakSeconds.value = PRESETS[0].rest
    phase.value = 'setup'
  }

  // this session's own tasks: the recommended reviews and ones the user types
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
  // planner tasks can only be hidden for this session, not deleted
  const hiddenPlannerIds = ref([])
  function hidePlannerTask(id) {
    hiddenPlannerIds.value.push(id)
  }
  // adds the garden's "!" seeds as "Review: ..." tasks, plus seeds reviewed today, ticked: a reviewed seed has left
  // the "!" list but stays on the to-do list until tomorrow. Each seed is offered once per session, so a removed one
  // doesn't come back, but a seed that moves up the list after a review joins it
  let offeredSeedIds = []
  function addReviewTasks(seeds) {
    for (const seed of seeds) {
      const reviewedToday = !!seed.last_reviewed && isoDay(seed.last_reviewed) === isoDay(Date.now())
      if (offeredSeedIds.includes(seed.id) || (!seed.alert && !reviewedToday)) continue
      offeredSeedIds.push(seed.id)
      tasks.value.push({ id: nextTaskId++, text: `Review: ${seed.title}`, done: reviewedToday, seedId: seed.id })
    }
  }
  // when a review is saved on a quiz page, tick its task
  // (true = keep listening even after the page that first used this store closes)
  useGardenStore().$onAction(({ name, args, after }) => {
    if (name !== 'saveReview') return
    after(() => {
      const task = tasks.value.find(t => t.seedId === args[0])
      if (task) task.done = true
    })
  }, true)

  // pop-up saying what just started
  let roundToast = null // the last round pop-up ("Break time", "Break's over", "Round N"), closed when the session ends
  function announce() {
    const toast = useToastStore()
    toast.dismiss(roundToast) // only one round pop-up at a time
    if (phase.value === 'done') {
      // short, because the done card shows the details
      toast.show({ type: 'success', title: 'Session complete 🌱', message: 'Nice work!' })
    } else if (mode.value === 'break') {
      roundToast = toast.show({
        type: 'success', title: 'Break time ☕', duration: 8000,
        message: `Nice work! Step away and rest for ${lengthText(current.value.seconds)}.`,
      })
    } else if (blocks.value[index.value - 1]?.type === 'focus') {
      // 0-min break: focus straight after focus, so there was no break to be over
      roundToast = toast.show({
        type: 'success', title: `Round ${current.value.number} 🌱`, duration: 8000,
        message: `Keep going: focus for ${lengthText(current.value.seconds)}.`,
      })
    } else {
      roundToast = toast.show({
        type: 'warning', title: "Break's over 🌱", duration: 8000,
        message: `Back to focus for ${lengthText(current.value.seconds)}.`,
      })
    }
  }

  // runs 4 times a second
  let rebookedBlock = -1
  async function tick() {
    remaining.value = secondsLeft()
    // a few seconds before each countdown, book the sounds again from the real clock (the sound clock can drift)
    if (remaining.value <= COUNTDOWN_FROM + 3 && rebookedBlock !== index.value) {
      rebookedBlock = index.value
      bookSounds()
    }
    if (remaining.value > 0) return
    const finished = current.value
    if (next.value) {
      beginBlock(index.value + 1)
      // the next block starts exactly when this one ended, in time with the booked sounds
      endsAt += current.value.seconds * 1000
      remaining.value = secondsLeft()
    } else {
      // session over: stop the timer (not pause(), which would cut off the last TING)
      running.value = false
      clearInterval(timer)
      phase.value = 'done'
    }
    announce()
    // a finished focus block counts for coins and the profile's study time
    if (finished.type === 'focus') {
      focusDoneSeconds.value += finished.seconds
      await auth.addStudyTime(finished.seconds).catch(console.error)
    }
    if (phase.value === 'done') awardCoins()
  }

  /* ---------- coins: paid once, when the session ends ---------- */
  const focusDoneSeconds = ref(0) // focus time finished in this session
  const doneAtStart = ref([]) // tasks already ticked when the session started
  async function awardCoins() {
    const seconds = focusDoneSeconds.value
    focusDoneSeconds.value = 0 // so the same minutes aren't paid twice
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

  /* ---------- keep the session through a page refresh (sessionStorage is cleared when the tab closes) ---------- */
  function save() {
    try {
      if (phase.value === 'setup') {
        // before Start: only the tasks the user typed need saving (reviews and planner tasks load again by themselves)
        const typed = tasks.value.filter(t => !t.seedId)
        if (!typed.length) return sessionStorage.removeItem(STORAGE_KEY)
        return sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ tasks: typed, nextTaskId }))
      }
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        phase: phase.value, blocks: blocks.value, index: index.value,
        running: running.value, endsAt, remaining: remaining.value, tasks: tasks.value, nextTaskId, offeredSeedIds,
        focusDoneSeconds: focusDoneSeconds.value, doneAtStart: doneAtStart.value,
        hiddenPlannerIds: hiddenPlannerIds.value,
      }))
    } catch { /* storage blocked: the session just won't survive a refresh */ }
  }
  // remaining isn't watched (it changes every second); endsAt is saved instead
  watch([phase, index, running, tasks, focusDoneSeconds, hiddenPlannerIds], save, { deep: true })

  // called once when the app starts (App.vue)
  function restore() {
    if (phase.value !== 'setup') return // a session is already going
    let saved
    try { saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY)) } catch { return }
    if (!saved) return
    tasks.value = saved.tasks
    nextTaskId = saved.nextTaskId
    if (!saved.blocks?.length) return // saved before Start: just the typed tasks
    phase.value = saved.phase
    blocks.value = saved.blocks
    index.value = saved.index
    remaining.value = saved.remaining
    offeredSeedIds = saved.offeredSeedIds ?? []
    focusDoneSeconds.value = saved.focusDoneSeconds ?? 0
    doneAtStart.value = saved.doneAtStart ?? []
    hiddenPlannerIds.value = saved.hiddenPlannerIds ?? []
    if (saved.phase === 'running' && saved.running) {
      endsAt = saved.endsAt
      startTicking() // no sound until the user clicks (browser rule)
      tick()         // catch up on time that passed during the reload
      unlockOnFirstInteraction(() => { if (running.value) bookSounds() })
    }
  }

  return {
    preset, focusSeconds, breakSeconds, rounds, setupError, plan, choosePreset,
    phase, blocks, index, remaining, running, current, next, mode, focusTotal, breakTotal, progress, label,
    startSession, resume, pause, endEarly, endSession, restore,
    tasks, addTask, toggleTask, removeTask, hiddenPlannerIds, hidePlannerTask, addReviewTasks, focusDoneSeconds, doneAtStart,
  }
})

// while coding: saving this file reloads the page (a hot swap left the old timer running and paying coins twice)
if (import.meta.hot) import.meta.hot.accept(() => window.location.reload())
