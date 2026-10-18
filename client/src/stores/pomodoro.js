import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAuthStore } from './auth'

export const BREAK_REQUIRED_FROM = 30 * 60 // focus blocks this long or more need a typed break
export const DEFAULT_BREAK = 5 * 60       // shorter blocks get this when no break is typed

// mm:ss, or h:mm:ss once it is an hour or more
export function formatSeconds(total) {
  const h = Math.floor(total / 3600)
  const m = String(Math.floor(total / 60) % 60).padStart(2, '0')
  const s = String(total % 60).padStart(2, '0')
  return h ? `${h}:${m}:${s}` : `${m}:${s}`
}

// Fills the whole session (breaks included) with focus/break blocks; the last one is cut short to fit.
//   2h, 30 min focus, 10 min break -> focus 1, break 1, focus 2, break 2, focus 3, break 3
function buildBlocks(total, focus, rest) {
  const blocks = []
  let left = total, focusCount = 0, breakCount = 0
  while (left > 0) {
    const type = blocks.length % 2 ? 'break' : 'focus'
    const seconds = Math.min(type === 'focus' ? focus : rest, left)
    blocks.push({ type, number: type === 'focus' ? ++focusCount : ++breakCount, seconds })
    left -= seconds
  }
  return blocks
}

export const usePomodoroStore = defineStore('pomodoro', () => {
  const auth = useAuthStore()

  // setup answers
  const topic = ref('')
  const totalSeconds = ref(2 * 3600)
  const focusSeconds = ref(30 * 60)
  const breakSeconds = ref(null) // typed break; null = not typed

  // session
  const phase = ref('setup') // setup -> running -> done
  const blocks = ref([])
  const index = ref(0)
  const remaining = ref(0)   // seconds left in the current block
  const running = ref(false)
  let endsAt = 0             // clock time the current block ends, so a background tab stays accurate
  let timer = null

  const breakRequired = computed(() => focusSeconds.value >= BREAK_REQUIRED_FROM)
  const breakToUse = computed(() => breakSeconds.value ?? Math.min(DEFAULT_BREAK, focusSeconds.value))

  // the problem with each setup step ('' = fine)
  const errors = computed(() => ({
    topic: topic.value.trim() ? '' : 'Tell us what you are focusing on.',
    total: '',
    focus: focusSeconds.value > totalSeconds.value ? "A focus block can't be longer than the whole session." : '',
    break: breakSeconds.value === null && breakRequired.value
      ? 'Enter a break time for focus blocks of 30 min or more.'
      : breakToUse.value > focusSeconds.value ? "Your break can't be longer than your focus block." : '',
  }))
  const setupError = computed(() => Object.values(errors.value).find(Boolean) ?? '')

  const current = computed(() => blocks.value[index.value] ?? null)
  const next = computed(() => blocks.value[index.value + 1] ?? null)
  const mode = computed(() => current.value?.type ?? 'focus')
  const focusTotal = computed(() => blocks.value.filter(b => b.type === 'focus').length)
  const breakTotal = computed(() => blocks.value.length - focusTotal.value)
  const progress = computed(() => (current.value ? remaining.value / current.value.seconds : 1)) // 1 -> 0
  const label = computed(() => formatSeconds(remaining.value))

  function startSession() {
    if (setupError.value) return
    blocks.value = buildBlocks(totalSeconds.value, focusSeconds.value, breakToUse.value)
    phase.value = 'running'
    beginBlock(0)
    resume()
  }

  function beginBlock(i) {
    index.value = i
    remaining.value = blocks.value[i].seconds
    endsAt = Date.now() + remaining.value * 1000
  }

  function resume() {
    if (running.value) return
    running.value = true
    endsAt = Date.now() + remaining.value * 1000
    timer = setInterval(tick, 250)
  }
  function pause() { running.value = false; clearInterval(timer) }

  // back to setup; the answers are kept so the next session is quick to start
  function endSession() {
    pause()
    phase.value = 'setup'
  }

  // breaks are scheduled, so the timer rolls straight into the next block
  async function tick() {
    remaining.value = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
    if (remaining.value > 0) return
    const finished = current.value
    if (next.value) beginBlock(index.value + 1)
    else { pause(); phase.value = 'done' }
    // Focus reward: persisted via the profile (swap to an RPC if you want server-side validation)
    if (finished.type === 'focus') {
      await auth.updateProfile({ coins: auth.profile.coins + 10, exp: auth.profile.exp + 25 }).catch(console.error)
    }
  }

  return {
    topic, totalSeconds, focusSeconds, breakSeconds, breakRequired, breakToUse, errors, setupError,
    phase, blocks, index, remaining, running, current, next, mode, focusTotal, breakTotal, progress, label,
    startSession, resume, pause, endSession,
  }
})
