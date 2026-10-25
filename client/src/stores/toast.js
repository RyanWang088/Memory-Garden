import { defineStore } from 'pinia'
import { ref } from 'vue'

const DEFAULTS = {
  reward: { title: 'Reward', duration: 3000 },
  success: { title: 'Success', duration: 3000 },
  warning: { title: 'Warning', duration: 3000 },
}

export const useToastStore = defineStore('toast', () => {
  const toasts = ref([])
  const timers = new Map()
  let nextId = 0

  function dismiss(id) {
    const timer = timers.get(id)
    if (timer !== undefined) clearTimeout(timer)
    timers.delete(id)
    toasts.value = toasts.value.filter((toast) => toast.id !== id)
  }

  function show({ type = 'success', title, message, duration } = {}) {
    if (!Object.hasOwn(DEFAULTS, type)) {
      throw new Error(`Unknown toast type: ${type}`)
    }
    if (typeof message !== 'string' || !message.trim()) {
      throw new Error('Toast message must be a non-empty string.')
    }

    const defaults = DEFAULTS[type]
    const timeout = duration ?? defaults.duration
    if (!Number.isFinite(timeout) || timeout < 0) {
      throw new Error('Toast duration must be a non-negative number of milliseconds.')
    }

    const id = nextId++
    const toast = {
      id,
      type,
      title: title ?? defaults.title,
      message: message.trim(),
    }
    toasts.value.push(toast)

    if (timeout > 0) timers.set(id, setTimeout(() => dismiss(id), timeout))
    return id
  }

  function clear() {
    for (const timer of timers.values()) clearTimeout(timer)
    timers.clear()
    toasts.value = []
  }

  return { toasts, show, dismiss, clear }
})
