<script setup>
import Billboard from './Billboard.vue'
defineProps({
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  scale: { type: Number, default: 1 },
  kind: { type: String, default: 'round' },
})
</script>

<template>
  <Billboard :x="x" :y="y" :w="72 * scale" :h="108 * scale" :shadow="60 * scale">
    <div class="tree" :class="kind">
      <span class="trunk" />
      <span class="crown" />
    </div>
  </Billboard>
</template>

<style scoped>
.tree {
  position: relative;
  width: 100%;
  height: 100%;
}
.trunk {
  position: absolute;
  left: 42%;
  bottom: 0;
  width: 16%;
  height: 40%;
  border-radius: 4px;
  background: var(--wood-deep);
}
.crown {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 72%;
  border-radius: 50%;
  background: #7ec46a;
  box-shadow: inset -8px -10px 0 rgba(60, 110, 50, 0.28);
  animation: sway 4.5s ease-in-out infinite;
  transform-origin: 50% 100%;
}
.pine .crown {
  height: 82%;
  border-radius: 0;
  background: #5fa65e;
  clip-path: polygon(50% 0, 100% 100%, 0 100%);
  box-shadow: none;
}
@keyframes sway {
  0%, 100% { transform: rotate(-1.5deg); }
  50% { transform: rotate(1.5deg); }
}
</style>
