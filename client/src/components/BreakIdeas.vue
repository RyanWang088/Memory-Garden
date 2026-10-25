<script setup>
import { computed } from 'vue'
import { usePomodoroStore } from '@/stores/pomodoro'

// Suggests a few things to do on the next (or current) break.
// Ideas that fit in the break are picked first, and each break shows a different set.
const pomo = usePomodoroStore()

const IDEAS = [
  { icon: '🧘', name: 'Stretch it out', minutes: 3, tint: 'var(--mint)' },
  { icon: '💧', name: 'Refill your water', minutes: 2, tint: 'var(--peri-soft)' },
  { icon: '👀', name: '20-20-20 eye rest', minutes: 1, tint: 'var(--butter)' },
  { icon: '🚶', name: 'Take a short walk', minutes: 5, tint: 'var(--mint)' },
  { icon: '🌬️', name: 'Slow, deep breaths', minutes: 2, tint: 'var(--peri-soft)' },
  { icon: '🍎', name: 'Grab a healthy snack', minutes: 5, tint: 'var(--peach)' },
  { icon: '🌱', name: 'Water your garden', minutes: 2, tint: 'var(--mint)' },
  { icon: '🪟', name: 'Look out the window', minutes: 1, tint: 'var(--butter)' },
  { icon: '🧹', name: 'Tidy your desk', minutes: 3, tint: 'var(--lilac)' },
]
const SHOW = 3

// the break these ideas are for: the one running now, or the one right after this focus block
const breakBlock = computed(() => (pomo.mode === 'break' ? pomo.current : pomo.next?.type === 'break' ? pomo.next : null))

const ideas = computed(() => {
  const fits = IDEAS.filter(i => i.minutes * 60 <= breakBlock.value.seconds)
  // very short (demo) breaks: fall back to the quickest ideas
  const pool = fits.length >= SHOW ? fits : [...IDEAS].sort((a, b) => a.minutes - b.minutes).slice(0, SHOW)
  const start = (breakBlock.value.number - 1) * SHOW // rotate so each break gets new ideas
  return Array.from({ length: SHOW }, (_, k) => pool[(start + k) % pool.length])
})

// "now" during a break, otherwise how long until it starts: "in 18 min", "in 40 sec"
const when = computed(() => {
  if (pomo.mode === 'break') return 'now'
  const s = pomo.remaining
  return s >= 60 ? `in ${Math.ceil(s / 60)} min` : `in ${s} sec`
})
</script>

<template>
  <section v-if="breakBlock" :class="{ now: pomo.mode === 'break' }" aria-labelledby="ideas-title" data-testid="break-ideas">
    <div id="ideas-title" class="text-label-caption mb-3">Break ideas · {{ when }}</div>
    <ul class="list-unstyled d-grid gap-2 mb-0">
      <li v-for="idea in ideas" :key="idea.name" class="idea d-flex align-items-center gap-3">
        <span class="icon" :style="{ background: idea.tint }" aria-hidden="true">{{ idea.icon }}</span>
        <span class="flex-fill">{{ idea.name }}</span>
        <span class="text-button">{{ idea.minutes }} min</span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.idea { padding: 8px 12px; background: var(--cream); border-radius: 10px; }
.icon {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  flex: none;
  border-radius: 8px;
  font-size: 16px;
}
/* during the break itself the card is outlined so it stands out */
.now { outline: 2px solid var(--mint-deep); }
</style>
