<script setup>
import { computed } from 'vue'

// The score ring at the top of a review session's results (Multiple Choice Quiz, Short Structured Mode).
// tier: 'high' | 'mid' | 'low' colours it mint / butter / berry.
const props = defineProps({
  percent: { type: Number, required: true },
  tier: { type: String, required: true },
})

const RING_RADIUS = 52
const RING_LENGTH = 2 * Math.PI * RING_RADIUS
const ringOffset = computed(() => RING_LENGTH * (1 - props.percent / 100))
</script>

<template>
  <div class="ring" :class="`tier-${tier}`">
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="60" cy="60" :r="RING_RADIUS" class="ring-track" />
      <circle cx="60" cy="60" :r="RING_RADIUS" class="ring-fill" :stroke-dasharray="RING_LENGTH"
        :stroke-dashoffset="ringOffset" />
    </svg>
    <span class="ring-label text-display">{{ percent }}%</span>
  </div>
</template>

<style scoped>
.ring {
  position: relative;
  width: 200px;
  height: 200px;
}

.ring svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.ring-track,
.ring-fill {
  fill: none;
  stroke-width: 10;
}

.ring-track {
  stroke: var(--linen);
}

.ring-fill {
  stroke-linecap: round;
  transition: stroke-dashoffset 1s ease-out;
}

.ring-label {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
}

.tier-high .ring-fill { stroke: var(--mint-deep); }
.tier-high .ring-label { color: var(--mint-deep); }
.tier-mid .ring-fill { stroke: var(--butter-deep); }
.tier-mid .ring-label { color: var(--butter-deep); }
.tier-low .ring-fill { stroke: var(--berry); }
.tier-low .ring-label { color: var(--berry-ink); }
</style>
