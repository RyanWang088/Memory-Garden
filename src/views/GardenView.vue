<script setup>
import { onMounted, computed } from 'vue'
import { useGardenStore } from '@/stores/garden'
import { useUiStore } from '@/stores/ui'
import { useWeatherStore } from '@/stores/weather'
import GardenBed from '@/components/GardenBed.vue'
import ShedPanel from '@/components/ShedPanel.vue'
import CardModal from '@/components/CardModal.vue'

const garden = useGardenStore()
const ui = useUiStore()
const weather = useWeatherStore()

// Backdrop slot: backdrop-{day|night}-{sunny|rainy|overcast}
const backdropName = computed(() => `backdrop-${weather.isNight ? 'night' : 'day'}-${weather.condition}`)

onMounted(async () => {
  weather.load()
  await garden.fetchSeeds()
  ui.pickDefaultTab(garden.hasPlants)
})
</script>
<template>
  <div class="d-flex flex-column flex-md-row overflow-hidden position-fixed top-0 start-0 w-100 h-100">
    <section class="garden-stage position-relative flex-grow-1" data-testid="garden-stage">
      <div class="backdrop position-absolute top-0 start-0 w-100 h-100" :class="backdropName"></div>

      <div class="scroller position-absolute top-0 start-0 w-100 h-100 overflow-auto">
        <div class="intro"></div>
        <div class="bed-wrap position-sticky bottom-0"><GardenBed /></div>
      </div>
    </section>

    <ShedPanel />
    <CardModal />
  </div>
</template>

<style scoped>
.garden-stage { min-width: 0; min-height: 0;background-image: url(https://i.redd.it/rgspv42ys7i41.jpg); }  /* lets flex child shrink. sky pic background temporary */

.backdrop { background: center / cover no-repeat; z-index: 0; }

.scroller { z-index: 1; scrollbar-width: none; overscroll-behavior: contain; }
.scroller::-webkit-scrollbar { display: none; }

.intro { height: 200%; }                        /* scroll-jack distance, animate against this */
.bed-wrap { height: 60%; overflow-y: auto; scrollbar-width: none; overscroll-behavior: contain; }
.bed-wrap::-webkit-scrollbar { display: none; }
</style>