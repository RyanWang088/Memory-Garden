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
  <div class="garden-layout row">
    <section class="garden-stage" data-testid="garden-stage">
      <div class="backdrop"><img src="" alt=""></div>
      <div class="bed-wrap"><GardenBed /></div>
    </section>
    <ShedPanel />
    <CardModal />
  </div>
</template>

<style scoped>
.garden-layout { display: grid; grid-template-columns: 1fr 320px; height: calc(100vh - 56px); }
.garden-stage { position: relative; overflow: hidden; background: var(--sp-sky-day); }
.backdrop { position: absolute; inset: 0; }
.bed-wrap { position: absolute; left: 0; right: 0; bottom: 0; }

</style>
