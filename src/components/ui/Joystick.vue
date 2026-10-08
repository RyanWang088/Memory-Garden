<script setup>
import { ref } from 'vue'
import { useIsTouch, setJoystick } from '@/composables/useInput'
import { useGameStore } from '@/stores/game'

const store = useGameStore()
const isTouch = useIsTouch()
const baseEl = ref(null)
const knobEl = ref(null)
let pointerId = null

function update(e) {
  const r = baseEl.value.getBoundingClientRect()
  const max = r.width / 2 - 14
  let dx = e.clientX - (r.left + r.width / 2)
  let dy = e.clientY - (r.top + r.height / 2)
  const d = Math.hypot(dx, dy)
  if (d > max) {
    dx *= max / d
    dy *= max / d
  }
  const dead = 0.15
  const nx = dx / max
  const ny = dy / max
  setJoystick(Math.hypot(nx, ny) < dead ? 0 : nx, Math.hypot(nx, ny) < dead ? 0 : ny)
  knobEl.value.style.transform = `translate(${dx}px, ${dy}px)`
}
function down(e) {
  pointerId = e.pointerId
  baseEl.value.setPointerCapture(pointerId)
  update(e)
}
function move(e) {
  if (e.pointerId === pointerId) update(e)
}
function end(e) {
  if (e.pointerId !== pointerId) return
  pointerId = null
  setJoystick(0, 0)
  knobEl.value.style.transform = ''
}
</script>

<template>
  <div
    v-if="isTouch"
    v-show="store.mode === 'walking'"
    ref="baseEl"
    class="joy"
    data-testid="joystick"
    role="application"
    aria-label="Movement joystick"
    @pointerdown="down"
    @pointermove="move"
    @pointerup="end"
    @pointercancel="end"
  >
    <span ref="knobEl" class="knob" />
  </div>
</template>

<style scoped>
.joy {
  position: fixed;
  z-index: 20;
  left: max(20px, env(safe-area-inset-left, 0px));
  bottom: calc(var(--nav-h) + 16px + var(--safe-bottom));
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: rgba(255, 250, 243, 0.55);
  border: 3px solid rgba(255, 255, 255, 0.9);
  box-shadow: var(--shadow);
  touch-action: none;
}
.knob {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 52px;
  height: 52px;
  margin: -26px 0 0 -26px;
  border-radius: 50%;
  background: var(--cream);
  box-shadow: 0 4px 0 var(--line), 0 6px 14px rgba(92, 64, 44, 0.2);
  transition: transform 0.08s linear;
}
@media (orientation: landscape) and (max-height: 520px) {
  .joy { width: 100px; height: 100px; bottom: calc(var(--nav-h) + 8px + var(--safe-bottom)); }
}
</style>
