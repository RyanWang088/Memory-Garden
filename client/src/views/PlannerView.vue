<script setup>
import { onMounted } from 'vue'
import { useGardenStore } from '@/stores/garden'
import SceneryBackdrop from '@/components/SceneryBackdrop.vue'
import PlannerBook from '@/components/PlannerBook.vue'

// Planner page: the open book (to-do + calendar). Exams, subjects and reviews due come from the garden.
const garden = useGardenStore()

// the cover swings open slowly the first time in a visit, quickly after that
let seen = false
try { seen = sessionStorage.getItem('sproutly.coverSeen') === '1'; sessionStorage.setItem('sproutly.coverSeen', '1') } catch { /* ignore */ }

const narrow = typeof window !== 'undefined' && window.innerWidth < 600
onMounted(() => { if (!garden.loaded) garden.fetchSeeds().catch(() => {}) })
</script>

<template>
  <main class="planner-main" data-testid="planner">
    <SceneryBackdrop
      mood="blush"
      :options="{ seed: 11, horizon: 0.56, tulips: narrow ? 2 : 8, butterflies: 2, veil: 'linear-gradient(180deg, rgba(252,246,236,0) 30%, rgba(252,246,236,.25) 100%)' }"
    />
    <PlannerBook cover :auto-open="seen ? 60 : 900" />
  </main>
</template>

<style scoped>
.planner-main {
  padding: 10px max(16px, env(safe-area-inset-right, 0px)) calc(var(--dock-h) + 28px + env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px));
  max-width: 1260px; margin: 0 auto;
}
@media (min-width: 768px) { .planner-main { padding-bottom: 40px; } }
</style>
