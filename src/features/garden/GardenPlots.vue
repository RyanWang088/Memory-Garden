<script setup>
// The 8 garden spots, shared by the Seed Shed (planting) and Memory Beds (display only).
// With `plantable`, empty spots accept a dragged seed packet, or a tap once `picked` holds
// a packet chosen by tap. Either way it emits 'choose' (plot, flowerId).
import { ref } from 'vue'
import { useGardenStore } from '@/stores/garden'
import { flowerById, PLOT_COUNT, DRAG_TYPE } from './flowers'

const props = defineProps({
  plantable: { type: Boolean, default: false },
  picked: { type: String, default: null }, // flower id chosen by tap, waiting for a spot
})
const emit = defineEmits(['choose'])

const garden = useGardenStore()
const plots = Array.from({ length: PLOT_COUNT }, (_, i) => i)
const hoverPlot = ref(null) // spot under a dragged packet

// Same sprout -> seedling -> bloom stages as garden.stageOf
const plantEmoji = (seed) => {
  const stage = garden.stageOf(seed)
  return stage === 'sprout' ? '🌱' : stage === 'seedling' ? '🌿' : flowerById(seed.flower).emoji
}
const canPlant = (plot) => props.plantable && !garden.seedAt(plot)

function onDragOver(e, plot) {
  if (!canPlant(plot) || !e.dataTransfer.types.includes(DRAG_TYPE)) return
  e.preventDefault() // allows the drop
  hoverPlot.value = plot
}
function onDrop(e, plot) {
  hoverPlot.value = null
  const flower = e.dataTransfer.getData(DRAG_TYPE)
  if (flower && canPlant(plot)) emit('choose', plot, flower)
}
function onClick(plot) {
  if (props.picked && canPlant(plot)) emit('choose', plot, props.picked)
}
</script>

<template>
  <div class="garden" data-testid="garden">
    <button
      v-for="plot in plots"
      :key="plot"
      type="button"
      class="plot"
      :class="{ planted: garden.seedAt(plot), hover: hoverPlot === plot, ready: picked && canPlant(plot) }"
      :disabled="!(picked && canPlant(plot))"
      :data-testid="`plot-${plot}`"
      :aria-label="garden.seedAt(plot) ? garden.seedAt(plot).title : `Empty spot ${plot + 1}`"
      @dragover="onDragOver($event, plot)"
      @dragleave="hoverPlot = null"
      @drop.prevent="onDrop($event, plot)"
      @click="onClick(plot)"
    >
      <template v-if="garden.seedAt(plot)">
        <span class="plant" :class="{ wilted: garden.isWilted(garden.seedAt(plot)) }">{{ plantEmoji(garden.seedAt(plot)) }}</span>
        <span class="name">{{ garden.seedAt(plot).title }}</span>
      </template>
      <span v-else class="empty">Empty spot</span>
    </button>
  </div>
</template>

<style scoped>
/* 4 x 2 spots (2 columns on phones) */
.garden {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  padding: 16px;
  border-radius: 24px;
  background: var(--grass-a);
}
.plot {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  min-height: 112px;
  padding: 8px;
  border: 2px dashed var(--wood);
  border-radius: 16px;
  background: #b98a5e;
  color: #fff;
  font: 700 13px var(--font-body);
  transition: transform 0.18s var(--ease-spring), background 0.15s;
}
.plot:disabled { color: rgba(255, 255, 255, 0.75); }
.plot.planted { border-style: solid; border-color: var(--wood-deep); background: var(--wood-deep); color: #fff; }
.plot.ready { cursor: pointer; border-color: #fff; }
.plot.ready:hover, .plot.hover { background: var(--leaf-deep); border-color: #fff; transform: scale(1.04); }
.plant { font-size: 40px; line-height: 1; }
.plant.wilted { filter: saturate(0.3); transform: rotate(8deg); }
.name { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

@media (max-width: 719px) {
  .garden { grid-template-columns: repeat(2, 1fr); }
}
</style>
