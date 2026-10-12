<script setup>
import { useUiStore } from '@/stores/ui'

// Tab 1: seed packets. Drag one onto the garden bed (see GardenBed.vue) to open the create-card modal.
// TODO: replace with real seed types (by subject, or limited editions the user owns).
const ui = useUiStore()
const packets = [
  { id: 'packet-default', subject: 'General' },
  { id: 'packet-science', subject: 'Science' },
  { id: 'packet-language', subject: 'Language' },
]

function onDragStart(e, packet) {
  e.dataTransfer.setData('application/x-sproutly-seed', JSON.stringify(packet))
}
</script>

<template>
  <div data-testid="shed-seeds">
    <p class="small">Drag a packet onto the garden to plant it.</p>
    <div class="d-flex flex-wrap gap-2">
      <div
        v-for="p in packets" :key="p.id" class="packet" draggable="true"
        :data-testid="`seed-${p.id}`" @dragstart="onDragStart($event, p)"
      >
        <img src="" alt="">
        <small>{{ p.subject }}</small>
      </div>
    </div>
    <!-- Touch devices don't fire HTML5 drag events: offer a tap fallback -->
    <button class="btn btn-sm btn-success mt-3" @click="ui.openCreate({ subject: 'General' })" data-testid="plant-via-button">
      Plant a seed
    </button>
  </div>
</template>

<style scoped>
.packet { width: 72px; height: 88px; cursor: grab; text-align: center; }
</style>
