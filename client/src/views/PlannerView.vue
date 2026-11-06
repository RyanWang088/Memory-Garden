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
  <main class="container py-3 mt-3 mb-5 mb-md-0" data-testid="planner">
    <SceneryBackdrop
      mood="blush"
      :options="{ seed: 11, horizon: 0.56, tulips: narrow ? 2 : 8, butterflies: 2, veil: 'linear-gradient(180deg, rgba(252,246,236,0) 30%, rgba(252,246,236,.25) 100%)' }"
    />
    <PlannerBook cover :auto-open="seen ? 60 : 900" />
  </main>
</template>
