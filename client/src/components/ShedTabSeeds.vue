<script setup>
import { useUiStore } from '@/stores/ui'
import tulipSvg from '@/assets/foliage/tulip.svg'

const ui = useUiStore()

// 1x1 transparent pixel: replaces the browser's own drag picture, so only the garden's ghost shows
const blankDragImage = new Image()
blankDragImage.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

function onDragStart(e) {
  if (e.dataTransfer) {
    e.dataTransfer.setData('application/x-sproutly-seed', JSON.stringify({ flower: 'tulip' }))
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setDragImage(blankDragImage, 0, 0)
  } else {
    ui.seedDragPointerId = e.pointerId
  }
  ui.seedPicked = true 
  ui.shedOpen = false
}

function onPointerDown(e) {
  if (e.pointerType === 'touch') {
    e.preventDefault()
    onDragStart(e)
  }
}
</script>

<template>
  <div class="d-flex flex-column align-items-start gap-2" data-testid="shed-seeds">
    <h3 class="m-0">Plant a new seed</h3>
    <p class="text-body-small m-0">
      {{ ui.seedPicked ? 'Drag the seed onto an empty garden spot.' : 'Drag the seed onto an empty garden spot to plant it.' }}
    </p>
    <button
      type="button" class="packet d-flex flex-column align-items-center gap-1 px-2 py-3" :class="{ picked: ui.seedPicked }"
      :aria-pressed="ui.seedPicked" data-testid="seed-tulip"
      draggable="true"
      @dragstart="onDragStart" @dragend="ui.seedPicked = false; ui.seedDragPointerId = null"
      @pointerdown="onPointerDown"
    >
      <img
        class="packet-art" :src="tulipSvg" alt="" 
      />
      <span class="text-label-field">Tulip seed</span>
    </button>
  </div>
</template>

<style scoped>
.packet {
  width: 96px;
  padding: 12px 6px;
  border: 2px solid var(--linen);
  border-radius: 16px;
  background: var(--paper);
  box-shadow: 0 4px 0 var(--linen);
  color: var(--bark);
  cursor: grab;
  touch-action: none;
  transition: transform 0.18s var(--spring);
}
.packet:hover { transform: translateY(-4px) rotate(-3deg); }
.packet:active { cursor: grabbing; }
.packet.picked { background: var(--berry); }
.packet-art { width: 48px; height: 56px; }
</style>