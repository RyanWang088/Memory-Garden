<script setup>
import { onUnmounted, ref } from 'vue'

// Confetti that falls over the whole page for a few seconds. The parent calls rain() through a template ref,
// e.g. a review session scoring 75% or more. Hidden for users who prefer reduced motion.
const CONFETTI_MS = 3000
const CONFETTI_COLORS = ['var(--peach)', 'var(--mint-deep)', 'var(--berry)', 'var(--periwinkle)', 'var(--butter)', 'var(--lilac)']

const pieces = ref([])
let timer

function rain() {
  clearTimeout(timer)
  const list = []
  for (let id = 0; id < 90; id++) {
    list.push({
      id,
      style: {
        left: `${Math.random() * 100}%`,
        background: CONFETTI_COLORS[id % CONFETTI_COLORS.length],
        animationDelay: `${Math.random() * 1.2}s`,
        animationDuration: `${1.6 + Math.random() * 1.2}s`,
        transform: `rotate(${Math.random() * 360}deg)`,
      },
    })
  }
  pieces.value = list
  timer = setTimeout(() => { pieces.value = [] }, CONFETTI_MS)
}

onUnmounted(() => clearTimeout(timer))
defineExpose({ rain })
</script>

<template>
  <div v-if="pieces.length" class="confetti" aria-hidden="true" data-testid="confetti">
    <span v-for="piece in pieces" :key="piece.id" class="confetti-piece" :style="piece.style" />
  </div>
</template>

<style scoped>
.confetti {
  position: fixed;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 1100;
}

.confetti-piece {
  position: absolute;
  top: -16px;
  width: 8px;
  height: 14px;
  border-radius: 2px;
  animation-name: confetti-fall;
  animation-timing-function: linear;
  animation-fill-mode: forwards;
}

@keyframes confetti-fall {
  to {
    top: 105vh;
    rotate: 720deg;
    translate: 40px 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .confetti {
    display: none;
  }
}
</style>
