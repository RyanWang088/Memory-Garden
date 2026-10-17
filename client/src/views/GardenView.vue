<script setup>
import { onMounted, onBeforeUnmount, computed } from 'vue'
import { useGardenStore } from '@/stores/garden'
import { useUiStore } from '@/stores/ui'
import { useWeatherStore } from '@/stores/weather'
import GardenBed from '@/components/GardenBed.vue'
import ShedPanel from '@/components/ShedPanel.vue'
import Skybox from '@/components/Skybox.vue'

const garden = useGardenStore()
const ui = useUiStore()
const weather = useWeatherStore()

function clearSeedSelectionOutsideCard(event) {
  if (event.target instanceof Element && event.target.closest('.seed-card')) return
  ui.clearGardenSeedSelection()
}

onMounted(async () => {
  document.addEventListener('click', clearSeedSelectionOutsideCard)
  weather.load()
  await garden.fetchSeeds()
  ui.pickDefaultTab(garden.hasPlants)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', clearSeedSelectionOutsideCard)
})
</script>
<template>
  <div class="d-flex flex-column flex-md-row overflow-hidden position-fixed top-0 start-0 w-100 h-100">
    <!-- sky now spans the whole screen, so nothing is exposed behind the shed -->
    <Skybox/>
    <section class="garden-stage position-relative flex-grow-1" data-testid="garden-stage">
      <div class="scroller position-absolute top-0 start-0 w-100 h-100 overflow-auto">
        <div class="intro"></div>
        <div class="bed-wrap position-sticky bottom-0"><GardenBed /></div>
      </div>
      <div id="sky-front"></div>
    </section>

    <ShedPanel />
  </div>
  <RouterView />
</template>

<style scoped>
.garden-stage { min-width: 0; min-height: 0; z-index: 1; }
#sky-front { position: absolute; inset: 0; z-index: 2; pointer-events: none; }
.backdrop { background: center / cover no-repeat; z-index: 0; }

.scroller { z-index: 1; scrollbar-width: none; overscroll-behavior: contain; }
.scroller::-webkit-scrollbar { display: none; }

.intro { height: 200%; }
.bed-wrap { height: 60%; overflow-y: auto; scrollbar-width: none; overscroll-behavior: contain; }
.bed-wrap::-webkit-scrollbar { display: none; }
</style>