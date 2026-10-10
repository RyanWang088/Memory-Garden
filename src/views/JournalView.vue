<script setup>
import { computed, onMounted } from 'vue'
import { useGardenStore } from '@/stores/garden'

// Book-flip styling goes here later. Data side: group seeds by subject with an aggregate readiness score.
const garden = useGardenStore()
onMounted(() => { if (!garden.loaded) garden.fetchSeeds() })

const subjects = computed(() => [...new Set(garden.seeds.map(s => s.subject))])
// TODO: milestones/deadlines -> add a `milestones` table 
</script>

<template>
  <main class="container py-4" data-testid="journal">
    <h2>Journal</h2>
    <p v-if="!subjects.length" class="text-muted">No subjects yet. Plant a seed in the garden to start tracking progress.</p>
    <div v-for="s in subjects" :key="s" class="mb-3">
      <strong>{{ s }}</strong> <span class="text-muted">readiness {{ garden.readiness(s) }}%</span>
    </div>
    <h4 class="mt-4">Upcoming milestones</h4>
    <p class="text-muted">TODO</p>
  </main>
</template>
