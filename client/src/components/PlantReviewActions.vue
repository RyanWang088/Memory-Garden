<script setup>
import { ref } from 'vue'
import SproutIcon from './SproutIcon.vue'
import targetArt from '@/assets/ui/target.svg'
import writingHandArt from '@/assets/ui/writing-hand.svg'

const emit = defineEmits(['review'])

// images, not emoji: emoji are drawn by each device's own font, so they'd differ on phones
const reviewModes = [
  { label: 'Flashcard', route: 'flashcard', iconType: 'sprout', iconName: 'flashcard' },
  { label: 'Multiple Choice Quiz', route: 'multiple-choice-quiz', iconType: 'art', art: targetArt },
  { label: 'Short Structured Mode', route: 'short-structured', iconType: 'art', art: writingHandArt },
]

const RADIUS = 115
const ANGLES = [-42, 0, 42]
const SPOTS = ANGLES.map((deg) => {
  const rad = (deg * Math.PI) / 180
  return { x: Math.round(RADIUS * Math.sin(rad)), y: -Math.round(RADIUS * Math.cos(rad)) }
})

const selected = ref(0)
const ring = ref(null)
let wheelAt = 0

function spin(direction) {
  selected.value = (selected.value + direction + reviewModes.length) % reviewModes.length
  if (ring.value?.contains(document.activeElement)) ring.value.children[selected.value].focus()
}

function onWheel(event) {
  const now = Date.now()
  if (now - wheelAt < 140) return
  wheelAt = now
  spin(Math.sign(event.deltaY || event.deltaX))
}

function onKey(event) {
  const direction = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key]
  if (!direction) return
  event.preventDefault()
  spin(direction)
}
</script>

<template>
  <div
    ref="ring"
    class="plant-review-actions"
    role="group"
    aria-label="Review modes"
    @wheel.prevent.stop="onWheel"
    @keydown.stop="onKey"
  >
    <button
      v-for="(mode, i) in reviewModes"
      :key="mode.route"
      type="button"
      class="review-action d-flex align-items-center justify-content-center rounded-circle border-0 p-0"
      :class="{ 'is-on': selected === i }"
      :style="{ '--i': i, '--x': `${SPOTS[i].x}px`, '--y': `${SPOTS[i].y}px` }"
      :data-testid="`review-${mode.route}`"
      :aria-label="mode.label"
      :aria-pressed="selected === i"
      @pointerenter="$event.pointerType === 'mouse' && (selected = i)"
      @focus="selected = i"
      @click.stop="emit('review', mode.route)"
    >
      <SproutIcon v-if="mode.iconType === 'sprout'" :name="mode.iconName" :size="34" class="ico" aria-hidden="true" />
      <span v-else-if="mode.iconType === 'art'" class="ico d-flex align-items-center justify-content-center" aria-hidden="true"><img :src="mode.art" alt="" width="28" height="28" /></span>
      <span class="tip position-absolute start-50 text-nowrap" aria-hidden="true">{{ mode.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.plant-review-actions {
  --size: 68px;
  position: absolute;
  left: 0;
  bottom: var(--plant-overlay-bottom, 170px);
  width: 0;
  height: 0;
  transform: translateY(30px);
  pointer-events: auto;
}

.review-action {
  position: absolute;
  left: calc(var(--x) - var(--size) / 2);
  top: calc(var(--y) - var(--size) / 2);
  width: var(--size);
  height: var(--size);
  background: var(--paper);
  cursor: pointer;
  box-shadow: var(--shadow-1), inset 0 0 0 3px var(--linen);
  animation: copy-in .55s var(--spring) backwards;
  animation-delay: calc(var(--i) * 90ms);
  transition: transform .4s var(--spring), background .25s;
}

.review-action:hover { transform: translateY(-2px); }
.review-action:active { transform: scale(.94); }
.review-action.is-on { z-index: 2; transform: scale(1.15); background: var(--butter-soft); }
.review-action.is-on:hover { transform: scale(1.15) translateY(-2px); }

.ico {
  width: 42px;
  height: 42px;
  fill: none;
  stroke: var(--ink);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: transform .35s var(--spring);
}

.review-action:hover .ico { transform: scale(1.12) rotate(-6deg); }
.review-action.is-on .ico { transform: scale(1.1); animation: boing .5s var(--spring); }
.review-action:active .ico { transform: scale(.9); }

@keyframes boing {
  0% { transform: scale(.8) rotate(-10deg); }
  60% { transform: scale(1.25) rotate(6deg); }
  100% { transform: scale(1.1) rotate(0); }
}

.tip {
  bottom: calc(100% + 6px);
  translate: -50% 0;
  transform: translateY(6px) scale(.8);
  transform-origin: 50% 100%;
  padding: .2em .65em;
  border-radius: 8px;
  background: var(--ink);
  color: var(--sheet);
  font-size: .72rem;
  font-weight: 800;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity .2s, transform .3s var(--spring);
}

.review-action.is-on .tip { opacity: 1; transform: translateY(0) scale(1); }

@media (prefers-reduced-motion: reduce) {
  .review-action, .ico { animation: none; }
}
</style>
