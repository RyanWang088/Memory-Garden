<script setup>
// Memory Beds: flashcard review and plant growth.
// Mounted by FeatureHost when this location opens. Emit 'close' to dismiss the overlay.
// Seeds are planted in the Seed Shed; here the garden is display only until review is built.
import { onMounted, ref } from 'vue'
import { useGardenStore } from '@/stores/garden'
import GardenPlots from '@/features/garden/GardenPlots.vue'

defineEmits(['close'])

const garden = useGardenStore()
const error = ref('')

onMounted(async () => {
  try {
    await garden.fetchSeeds()
  } catch (e) {
    error.value = e.message
  }
})
</script>

<template>
  <section class="beds" data-testid="beds-panel">
    <p v-if="error" class="error" data-testid="beds-error">{{ error }}</p>
    <p v-else-if="garden.loaded && !garden.hasPlants" class="hint" data-testid="beds-empty">
      Your garden is empty. Plant a seed in the Seed Shed.
    </p>
    <GardenPlots />
  </section>
</template>

<style scoped>
.beds { display: flex; flex-direction: column; gap: 16px; }
.error { margin: 0; font: 700 14px var(--font-body); color: var(--petal-deep); }
.hint { margin: 0; font: 700 14px var(--font-body); color: var(--ink-soft); }
</style>
