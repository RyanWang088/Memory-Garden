<script setup>
import { useGardenStore } from '@/stores/garden'
import { useUiStore } from '@/stores/ui'

const garden = useGardenStore()
const ui = useUiStore()

function onDrop(e) {
  const raw = e.dataTransfer.getData('application/x-sproutly-seed')
  if (raw) ui.openCreate(JSON.parse(raw)) // modal collects title + cards, then garden.plantSeed()
}

function onPlantClick(seed) {
  // Watering can  -> open the review modal. Shovel -> TODO: remove plant (confirm first).
  if (ui.activeTool === 'shovel') return
  ui.openReview(seed.id)
}
</script>

<template>
  <div class="bed" data-testid="garden-bed" @dragover.prevent @drop.prevent="onDrop">
    <p v-if="!garden.hasPlants" class="text-muted m-auto">Your garden is empty. Plant a seed from the shed.</p>

    <button
      v-for="seed in garden.seeds" :key="seed.id" class="plant"
      :class="{ wilted: garden.isWilted(seed) }" :data-testid="`plant-${seed.id}`" :title="seed.title"
      @click="onPlantClick(seed)"
    >
      <!-- SVG animations: plant-sprout, plant-seedling, plant-bloom -->
       <img src="" alt="">plant img
      <small>{{ seed.title }}</small>
    </button>
  </div>
</template>

<style scoped>
.bed { display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-end; padding: 16px; min-height: 180px; background: rgba(92, 61, 38, 0.35); border-radius: 12px; }
.plant { width: 96px; height: 120px; border: 0; background: transparent; text-align: center; }
/* Wilt effect: desaturate + droop. Refine once real SVGs exist. */
.plant.wilted { filter: saturate(0.3); transform: rotate(6deg) translateY(4px); transition: filter 0.4s, transform 0.4s; }
</style>
