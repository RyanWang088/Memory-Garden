import { ref, onMounted, onBeforeUnmount } from 'vue'

// Keyboard and joystick both feed the same vector, so the player code never
// needs to know which one is in use. State lives at module level
const keys = new Set()
const joy = { x: 0, y: 0 }

const KEYMAP = {
  w: 'up', arrowup: 'up',
  s: 'down', arrowdown: 'down',
  a: 'left', arrowleft: 'left',
  d: 'right', arrowright: 'right',
  q: 'orbitL', r: 'orbitR',
}

const isTyping = (t) => !!t && (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable)

export function getMoveVector() {
  let x = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0) + joy.x
  let y = (keys.has('down') ? 1 : 0) - (keys.has('up') ? 1 : 0) + joy.y
  const m = Math.hypot(x, y)
  if (m > 1) {
    x /= m
    y /= m
  }
  return { x, y }
}

export const getOrbitInput = () => (keys.has('orbitR') ? 1 : 0) - (keys.has('orbitL') ? 1 : 0)

export function setJoystick(x, y) {
  joy.x = x
  joy.y = y
}

export function clearInput() {
  keys.clear()
  joy.x = 0
  joy.y = 0
}

export function useInput({ onInteract } = {}) {
  const down = (e) => {
    if (isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return
    const k = e.key.toLowerCase()
    if (k === 'f' && !e.repeat) {
      onInteract && onInteract()
      return
    }
    if (KEYMAP[k]) {
      keys.add(KEYMAP[k])
      if (k.startsWith('arrow')) e.preventDefault()
    }
  }
  const up = (e) => {
    const k = KEYMAP[e.key.toLowerCase()]
    if (k) keys.delete(k)
  }
  onMounted(() => {
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', clearInput)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('keydown', down)
    window.removeEventListener('keyup', up)
    window.removeEventListener('blur', clearInput)
    clearInput()
  })
}

function mediaFlag(query) {
  const flag = ref(false)
  onMounted(() => {
    if (typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(query)
    const sync = () => (flag.value = mq.matches)
    sync()
    mq.addEventListener?.('change', sync)
    onBeforeUnmount(() => mq.removeEventListener?.('change', sync))
  })
  return flag
}

export const useIsTouch = () => mediaFlag('(pointer: coarse)')
export const usePrefersReducedMotion = () => mediaFlag('(prefers-reduced-motion: reduce)')
