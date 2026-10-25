<script setup>
import { ref, onMounted } from 'vue'
import { useGardenStore } from '@/stores/garden'
import { useAuthStore } from '@/stores/auth'
import SceneryBackdrop from '@/components/SceneryBackdrop.vue'
import JournalBook from '@/components/JournalBook.vue'
import { greeting, longDate } from '@/lib/greeting'

// Journal page: the open book (to-do + calendar). Exams, subjects and reviews due come from the garden.
const garden = useGardenStore()
const auth = useAuthStore()
const name = auth.profile?.display_name && auth.profile.display_name !== 'gardener' ? `, ${auth.profile.display_name}` : ''

// the cover swings open slowly the first time in a visit, quickly after that
let seen = false
try { seen = sessionStorage.getItem('sproutly.coverSeen') === '1'; sessionStorage.setItem('sproutly.coverSeen', '1') } catch { /* ignore */ }
const book = ref(null)
function replay() { book.value?.close(); setTimeout(() => book.value?.open(), 1100) }

const narrow = typeof window !== 'undefined' && window.innerWidth < 600
onMounted(() => { if (!garden.loaded) garden.fetchSeeds().catch(() => {}) })
</script>

<template>
  <main class="journal-main" data-testid="journal">
    <SceneryBackdrop
      mood="blush"
      :options="{ seed: 11, horizon: 0.56, tulips: narrow ? 2 : 8, butterflies: 2, veil: 'linear-gradient(180deg, rgba(252,246,236,0) 30%, rgba(252,246,236,.25) 100%)' }"
    />
    <div class="journal-top">
      <h1 class="sp-greet"><small>{{ longDate() }}</small>{{ greeting() }}{{ name }}. What will you grow today?</h1>
      <button class="sp-btn sp-btn-ghost sp-btn-sm" type="button" @click="replay">Close &amp; reopen</button>
    </div>
    <JournalBook ref="book" cover :auto-open="seen ? 60 : 900" />
    <div class="help" aria-label="Tips">
      <span>Click a date to plan that day</span>
      <span>Double-click a task to edit it</span>
      <span class="kbd-tip"><kbd>←</kbd> <kbd>→</kbd> <kbd>↑</kbd> <kbd>↓</kbd> move between dates · <kbd>PgUp</kbd>/<kbd>PgDn</kbd> turn the month</span>
      <span>Your tasks are saved on this device</span>
    </div>
  </main>
</template>

<style scoped>
.journal-main {
  padding: 22px max(16px, env(safe-area-inset-right, 0px)) calc(var(--dock-h) + 48px + env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px));
  max-width: 1260px; margin: 0 auto;
}
.journal-top { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; margin: 0 auto 28px; max-width: 1220px; flex-wrap: wrap; }
.sp-greet { font-size: clamp(1.7rem, 3vw, 2.2rem); }
.help { margin: 26px auto 0; max-width: 1220px; display: flex; flex-wrap: wrap; gap: 8px 18px; justify-content: center; font-size: .8rem; font-weight: 700; color: var(--ink-soft); }
.help kbd { font: inherit; font-size: .72rem; padding: 1px 6px; border-radius: 5px; background: var(--sheet); border: 1px solid var(--line); box-shadow: 0 1px 0 var(--line); color: var(--ink); }
.help span { background: color-mix(in srgb, var(--sheet) 75%, transparent); padding: 4px 10px; border-radius: 999px; backdrop-filter: blur(6px); }
@media (max-width: 860px) { .journal-top { margin-bottom: 40px; } .kbd-tip { display: none; } }
@media (min-width: 861px) and (min-height: 700px) { .journal-main { padding-bottom: 110px; } }
</style>
