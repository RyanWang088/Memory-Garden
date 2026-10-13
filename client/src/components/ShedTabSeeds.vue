<script setup>
import { useUiStore } from '@/stores/ui'
import tulipSvg from '@/assets/foliage/tulip.svg'

const ui = useUiStore()

function onDragStart(e) {
  e.dataTransfer.setData('application/x-sproutly-seed', JSON.stringify({ flower: 'tulip' }))
  e.dataTransfer.effectAllowed = 'copy'
  ui.seedPicked = true // highlights the packet while dragging
}
</script>

<template>
  <div data-testid="shed-seeds">
    <h4 class="seeds-title">Plant a new seed</h4>
    <!-- Touch devices don't fire HTML5 drag events: tap the packet, then tap a spot -->
    <p class="text-body-small hint">
      {{ ui.seedPicked ? 'Now tap an empty spot in the garden to plant it.' : 'Drag the seed onto the garden, or tap it then tap a spot.' }}
    </p>
    <button
      type="button" class="packet" draggable="true" :class="{ picked: ui.seedPicked }"
      :aria-pressed="ui.seedPicked" data-testid="seed-tulip"
      @dragstart="onDragStart" @dragend="ui.seedPicked = false" @click="ui.seedPicked = !ui.seedPicked"
    >
      <img class="packet-art" :src="tulipSvg" alt="" draggable="false" />
      <span class="text-label-field">Tulip seed</span>
    </button>
  </div>
</template>

<style scoped>
.seeds-title { margin: 0 0 4px; font-family: 'Fredoka', sans-serif; font-weight: 500; font-size: 18px; line-height: 24px; }
.hint { margin: 0 0 12px; color: var(--bark-muted); }
.packet {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 96px;
  padding: 12px 6px;
  border: 2px solid var(--linen);
  border-radius: 16px;
  background: var(--paper);
  box-shadow: 0 4px 0 var(--linen);
  color: var(--bark);
  cursor: grab;
  transition: transform 0.18s var(--spring);
}
.packet:hover { transform: translateY(-2px); }
.packet:active { cursor: grabbing; }
.packet.picked { border-color: var(--berry); box-shadow: 0 4px 0 var(--berry); background: #fff1ec; }
.packet-art { width: 48px; height: 56px; }
</style>
