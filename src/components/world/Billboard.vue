<script setup>
// "Pop up" art that always faces the camera
import { ref, computed } from 'vue'

const props = defineProps({
  // Leave x/y unset when a game loop positions this billboard itself (the player).
  // Vue re-applies bound styles on every re-render, which would snap it back here.
  x: { type: Number, default: null },
  y: { type: Number, default: null },
  w: { type: Number, required: true },
  h: { type: Number, required: true },
  lift: { type: Number, default: 0 }, // floats the face above its ground point
  shadow: { type: Number, default: 0 }, // diameter of the ground shadow, 0 for none
})

const el = ref(null)
defineExpose({ el })

const posStyle = computed(() => (props.x == null || props.y == null ? {} : { '--x': props.x, '--y': props.y }))
const faceStyle = computed(() => ({
  width: `${props.w}px`,
  height: `${props.h}px`,
  marginLeft: `${-props.w / 2}px`,
  marginTop: `${-props.h}px`,
  '--lift': `${props.lift}px`,
}))
const shadowStyle = computed(() => ({
  width: `${props.shadow}px`,
  height: `${props.shadow * 0.4}px`,
  marginLeft: `${-props.shadow / 2}px`,
  marginTop: `${-props.shadow * 0.2}px`,
}))
</script>

<template>
  <div ref="el" class="bb" :style="posStyle">
    <span v-if="shadow" class="bb-shadow" :style="shadowStyle" />
    <div class="bb-face" :style="faceStyle"><slot /></div>
  </div>
</template>

<style scoped>
.bb {
  position: absolute;
  left: 0;
  top: 0;
  transform-style: preserve-3d;
  transform: translate3d(calc(var(--x) * 1px), calc(var(--y) * 1px), 0);
}
.bb-shadow {
  position: absolute;
  left: 0;
  top: 0;
  border-radius: 50%;
  background: rgba(60, 90, 30, 0.32);
  transform: translateZ(1px);
}
.bb-face {
  position: absolute;
  left: 0;
  top: 0;
  pointer-events: none;
  transform-origin: 50% 100%;
  transform: rotateZ(calc(var(--yaw, 0deg) * -1)) rotateX(calc(var(--tilt, 58deg) * -1))
    translateY(calc(var(--lift, 0px) * -1));
}
</style>
