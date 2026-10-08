import { onMounted, onBeforeUnmount } from 'vue'

/** requestAnimationFrame loop that pauses while the tab is hidden. update(dt) gets seconds. */
export function useGameLoop(update) {
  let raf = 0
  let last = 0
  let running = false

  const tick = (t) => {
    if (!running) return
    const dt = Math.min((t - last) / 1000, 0.05)
    last = t
    update(dt)
    raf = requestAnimationFrame(tick)
  }
  const start = () => {
    if (running) return
    running = true
    last = performance.now()
    raf = requestAnimationFrame(tick)
  }
  const stop = () => {
    running = false
    cancelAnimationFrame(raf)
  }
  const onVisibility = () => (document.hidden ? stop() : start())

  onMounted(() => {
    start()
    document.addEventListener('visibilitychange', onVisibility)
  })
  onBeforeUnmount(() => {
    stop()
    document.removeEventListener('visibilitychange', onVisibility)
  })
  return { start, stop }
}
