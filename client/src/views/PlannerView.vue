<script setup>
import { computed, onMounted, watchEffect } from 'vue'
import { useGardenStore } from '@/stores/garden'

// Book-flip styling goes here later. Data side: group seeds by subject with an aggregate readiness score.
const garden = useGardenStore()
onMounted(() => { if (!garden.loaded) garden.fetchSeeds() })

const subjects = computed(() => [...new Set(garden.seeds.map(s => s.subject))])
// TODO: milestones/deadlines -> add a `milestones` table 
const milestones = computed(()=>
  [...new Set(garden.seeds.map(s1 =>({ subject:s1.subject, exam_date:s1.exam_date})).filter(s2=>{return !!s2.exam_date}))]
) // placing {} makes the computed a function, place return to return value
// returns array of objects that have subject and exam date

watchEffect(()=>{
  console.log(milestones.value)
}) //testing, milestone updates later once fetchSeeds() runs
  

</script>

<template>
  <main class="container py-4" data-testid="planner">
    <h2>Planner</h2>
    <p v-if="!subjects.length" class="text-muted">No subjects yet. Plant a seed in the garden to start tracking progress.</p>
    <div v-for="s in subjects" :key="s" class="mb-3">
      <strong>{{ s }}</strong> <span class="text-muted">readiness {{ garden.readiness(s) }}%</span>
    </div>
    <h4 class="mt-4">Upcoming milestones</h4>
    <p class="text-muted">TODO</p>
  </main>
</template>
