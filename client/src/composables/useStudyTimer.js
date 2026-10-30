import { onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth'

// Active study time in a review session (Flashcard, Multiple Choice Quiz) for the profile's "studied" stat.
// Counts the time between the user's actions, each gap capped at MAX_GAP_MS, so time away from the screen
// doesn't count. Saved once when the page closes, finished or not: only the time up to the last action counts.
//   start() when the first card/question shows, mark() on every answer
export const MAX_GAP_MS = 2 * 60_000

export function useStudyTimer() {
  const auth = useAuthStore()
  let last = 0
  let activeMs = 0

  function start() {
    last = Date.now()
    activeMs = 0
  }

  function mark() {
    if (!last) return
    const now = Date.now()
    activeMs += Math.min(now - last, MAX_GAP_MS)
    last = now
  }

  onUnmounted(() => {
    if (activeMs >= 1000) auth.addStudyTime(activeMs / 1000).catch(console.error)
  })

  return { start, mark }
}
