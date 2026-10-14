<script setup>
import { useUiStore } from '@/stores/ui'
import tulipSvg from '@/assets/foliage/tulip.svg'

const ui = useUiStore()

// 1x1 transparent pixel: replaces the browser's own drag picture, so only the garden's ghost shows
const blankDragImage = new Image()
blankDragImage.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

function onDragStart(e) {
  e.dataTransfer.setData('application/x-sproutly-seed', JSON.stringify({ flower: 'tulip' }))
  e.dataTransfer.effectAllowed = 'copy'
  e.dataTransfer.setDragImage(blankDragImage, 0, 0)
  ui.seedPicked = true 
}
</script>

<template>
  <div data-testid="shed-seeds">
    <h3>Plant a new seed</h3>
    <!-- Touch devices don't fire HTML5 drag events: tap the packet, then tap a spot -->
    <p class="text-body-small m-0">
      {{ ui.seedPicked ? 'Now tap an empty spot in the garden to plant it.' : 'Drag the seed onto the garden, or tap it then tap a spot.' }}
    </p>
    <button
      type="button" class="packet" :class="{ picked: ui.seedPicked }"
      :aria-pressed="ui.seedPicked" data-testid="seed-tulip"
      draggable="true"
      @dragstart="onDragStart" @dragend="ui.seedPicked = false"
    >
      <img
        class="packet-art" :src="tulipSvg" alt="" 
      />
      <span class="text-label-field">Tulip seed</span>
    </button>
  </div>
</template>

<style scoped>
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
