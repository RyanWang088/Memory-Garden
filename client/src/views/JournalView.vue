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
    </div>
    <JournalBook ref="book" cover :auto-open="seen ? 60 : 900" />
  </main>
</template>

<style scoped>
.journal-main {
  padding: 22px max(16px, env(safe-area-inset-right, 0px)) calc(var(--dock-h) + 48px + env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px));
  max-width: 1260px; margin: 0 auto;
}
.journal-top { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; margin: 0 auto 28px; max-width: 1220px; flex-wrap: wrap; }
.sp-greet { font-size: clamp(1.7rem, 3vw, 2.2rem); }
@media (max-width: 860px) { .journal-top { margin-bottom: 40px; } }
@media (min-width: 861px) and (min-height: 700px) { .journal-main { padding-bottom: 110px; } }
</style>
