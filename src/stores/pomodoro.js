import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAuthStore } from './auth'

export const usePomodoroStore = defineStore('pomodoro', () => {
  const auth = useAuthStore()

  const presets = { focus: 25 * 60, break: 5 * 60 } // seconds
  const mode = ref('focus')
  const remaining = ref(presets.focus)
  const running = ref(false)
  let timer = null

  const label = computed(() => {
    const m = String(Math.floor(remaining.value / 60)).padStart(2, '0')
    const s = String(remaining.value % 60).padStart(2, '0')
    return `${m}:${s}`
  })

  function start() {
    if (running.value) return
    running.value = true
    timer = setInterval(tick, 1000)
  }
  function pause() { running.value = false; clearInterval(timer) }
  function reset(nextMode = mode.value) {
    pause()
    mode.value = nextMode
    remaining.value = presets[nextMode]
  }

  async function tick() {
    remaining.value -= 1
    if (remaining.value > 0) return
    const finishedFocus = mode.value === 'focus'
    reset(finishedFocus ? 'break' : 'focus')
    // Focus reward: persisted via the profile (swap to an RPC if you want server-side validation)
    if (finishedFocus) await auth.updateProfile({ coins: auth.profile.coins + 10, exp: auth.profile.exp + 25 })
  }

  return { mode, remaining, running, label, start, pause, reset }
})
