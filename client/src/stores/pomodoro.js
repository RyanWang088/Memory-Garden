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
export const FOCUS_REWARD = { coins: 10, exp: 25 } // given each time a focus block finishes

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
    const type = blocks.length % 2 ? 'break' : 'focus'
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
  const topic = ref('')
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
    topic: topic.value.trim() ? '' : 'Tell us what you are focusing on.',
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
    tasks.value = [] // every session starts with a fresh to-do list
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
    bookingId++ // drop a booking that's still waiting for the audio
    cancelSounds()
  }

  // Books every remaining countdown beep and end-of-block TING ahead of time in one go.
  // tick() only runs about 4x a second, so sounding from there came up to 250 ms late now and then
  // (5 -> 4 sounded rushed); booked sounds are exactly a second apart, even in a background tab.
  let bookingId = 0 // only the latest booking counts (an older one may still be waiting for the audio)
  async function bookSounds() {
    const id = ++bookingId
    await audioReady() // the sound device must be running, or every sound would come late
    if (id !== bookingId || !running.value) return // paused, or booked again, while waiting
    cancelSounds()
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

  // back to setup for a fresh session: topic and rhythm are cleared so each session is chosen anew
  // (Custom starts again from the Classic times); the session length answers are kept
  function endSession() {
    pause()
    topic.value = ''
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

  // pop-up on whatever page the user is on, saying what just started (the TING plays at the same time)
  function announce() {
    const toast = useToastStore()
    if (phase.value === 'done') {
      toast.show({
        type: 'reward', title: 'Session complete 🌱', duration: 8000,
        message: `${focusTotal.value} focus block${focusTotal.value === 1 ? '' : 's'} done · +${focusTotal.value * FOCUS_REWARD.coins} coins`,
      })
    } else if (mode.value === 'break') {
      toast.show({
        type: 'success', title: 'Break time ☕', duration: 8000,
        message: `Nice work! Step away and rest for ${lengthText(current.value.seconds)}.`,
      })
    } else {
      toast.show({
        type: 'warning', title: "Break's over 🌱", duration: 8000,
        message: `Back to ${topic.value} for ${lengthText(current.value.seconds)}.`,
      })
    }
  }

  // breaks are scheduled, so the timer rolls straight into the next block
  let resyncedBlock = -1
  async function tick() {
    remaining.value = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
    // the audio clock can drift from the real clock over a long block, so line the sounds up again
    // a few seconds before each countdown starts
    if (remaining.value <= COUNTDOWN_FROM + 3 && resyncedBlock !== index.value) {
      resyncedBlock = index.value
      bookSounds()
    }
    if (remaining.value > 0) return
    const finished = current.value
    if (next.value) {
      beginBlock(index.value + 1)
      // the next block starts exactly when this one ended (not when tick noticed), matching the booked sounds
      endsAt += current.value.seconds * 1000
      remaining.value = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
    } else {
      pause()
      phase.value = 'done'
    }
    announce()
    // Focus reward: persisted via the profile (swap to an RPC if you want server-side validation).
    // The finished block also counts as study time (after the reward, which re-reads the whole profile).
    if (finished.type === 'focus') {
      await auth.updateProfile({
        coins: auth.profile.coins + FOCUS_REWARD.coins,
        exp: auth.profile.exp + FOCUS_REWARD.exp,
      }).catch(console.error)
      await auth.addStudyTime(finished.seconds).catch(console.error)
    }
  }

  /* ---------- keep the session through a page refresh ----------
     sessionStorage survives a refresh but is wiped when the tab closes, so an old session never comes back.
     While running we save endsAt (a clock time), so time that passes during the reload still counts. */
  function save() {
    try {
      if (phase.value === 'setup') return sessionStorage.removeItem(STORAGE_KEY)
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        phase: phase.value, topic: topic.value, blocks: blocks.value, index: index.value,
        running: running.value, endsAt, remaining: remaining.value, tasks: tasks.value, nextTaskId,
      }))
    } catch { /* storage blocked (e.g. private mode): the session just won't survive a refresh */ }
  }
  // remaining isn't watched (it changes every second); endsAt covers a running timer, and pause() changes running
  watch([phase, index, running, topic, tasks], save, { deep: true })

  // called once when the app starts (App.vue): picks the saved session back up after a refresh
  function restore() {
    if (phase.value !== 'setup') return // already have a session (e.g. App.vue hot-reloaded)
    let saved
    try { saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY)) } catch { return }
    if (!saved?.blocks?.length) return
    phase.value = saved.phase
    topic.value = saved.topic
    blocks.value = saved.blocks
    index.value = saved.index
    remaining.value = saved.remaining
    tasks.value = saved.tasks
    nextTaskId = saved.nextTaskId
    if (saved.phase === 'running' && saved.running) {
      endsAt = saved.endsAt
      startTicking() // no sound yet: the new page hasn't been clicked, so the browser blocks it
      tick()         // catch up at once (moves on if a block ended during the reload)
      unlockOnFirstInteraction(() => { if (running.value) bookSounds() })
    }
  }

  return {
    topic, preset, focusSeconds, breakSeconds, endBy, rounds, totalSeconds, errors, setupError, plan, choosePreset,
    phase, blocks, index, remaining, running, current, next, mode, focusTotal, breakTotal, progress, label,
    startSession, resume, pause, endSession, restore,
    tasks, addTask, toggleTask, removeTask,
  }
})

// lets Vite swap in edits to this store without a page refresh (otherwise the old store stays in memory)
if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(usePomodoroStore, import.meta.hot))
