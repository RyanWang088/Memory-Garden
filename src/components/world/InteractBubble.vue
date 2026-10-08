<script setup>
// Floats above a door while the player stands at it. Clicking opens the overlay.
import Billboard from './Billboard.vue'
import Icon from '../ui/Icon.vue'
defineProps({ loc: { type: Object, required: true } })
defineEmits(['activate'])
</script>

<template>
  <Billboard :key="loc.id" :x="loc.stand.x" :y="loc.stand.y" :w="200" :h="60" :lift="(loc.size?.h ?? 120) + 80">
    <button
      class="bubble"
      type="button"
      data-testid="interact-bubble"
      :aria-label="`Open ${loc.label}`"
      @click="$emit('activate')"
    >
      <span class="ic" :style="{ background: loc.color }"><Icon :name="loc.icon" /></span>
      <span class="txt">{{ loc.label }}</span>
    </button>
  </Billboard>
</template>

<style scoped>
.bubble {
  pointer-events: auto;
  position: absolute;
  left: 50%;
  top: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 52px;
  padding: 0 18px 0 6px;
  border: 3px solid #fff;
  border-radius: 999px;
  background: var(--cream);
  box-shadow: 0 8px 0 rgba(201, 154, 104, 0.25), var(--shadow);
  font: 800 16px var(--font-display);
  color: var(--ink);
  white-space: nowrap;
  cursor: pointer;
  transform: translateX(-50%);
  transform-origin: 50% 100%;
  animation: pop 0.45s var(--ease-spring) both, float 2.2s ease-in-out 0.45s infinite;
}
.bubble::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: -13px;
  margin-left: -9px;
  border: 9px solid transparent;
  border-top-color: var(--cream);
}
.bubble:hover { background: #fff; }
.ic { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 50%; font-size: 20px; color: #fff; }
@keyframes pop { from { opacity: 0; transform: translateX(-50%) scale(0.4); } to { opacity: 1; transform: translateX(-50%) scale(1); } }
@keyframes float { 0%, 100% { translate: 0 0; } 50% { translate: 0 -5px; } }
</style>
