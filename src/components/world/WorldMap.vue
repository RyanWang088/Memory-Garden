<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useGameStore } from '@/stores/game'
import { useGameLoop } from '@/composables/useGameLoop'
import { useInput, getMoveVector, getOrbitInput, clearInput, usePrefersReducedMotion } from '@/composables/useInput'
import { stepPlayer } from '@/utils/movement'
import { createCamera, stepCamera, computeView } from '@/utils/camera'
import { nearestLocation } from '@/utils/proximity'
import { clamp } from '@/utils/collision'
import { SPAWN, TRIGGER_RADIUS } from '@/world/config'
import { locationById, structures, interactables } from '@/world/locations'
import { trees, motion } from '@/world/layout'
import Billboard from './Billboard.vue'
import Ground from './Ground.vue'
import Structure from './Structure.vue'
import Tree from './Tree.vue'
import Fountain from './Fountain.vue'
import InteractBubble from './InteractBubble.vue'
import Avatar from './Avatar.vue'

const store = useGameStore()
const reduceMotion = usePrefersReducedMotion()

const sceneEl = ref(null)
const camEl = ref(null)
const worldEl = ref(null)
const playerRef = ref(null)

// Per-frame state is plain data, not reactive: the loop writes straight to the
// DOM, and only coarse changes (walking, facing, nearby door) reach Vue.
const player = { x: SPAWN.x, y: SPAWN.y }
const camera = createCamera(SPAWN.x, SPAWN.y)
const walking = ref(false)
const facing = ref(1)
let dragOrbit = 0
let lastYaw = NaN

const showBubble = computed(() => store.mode === 'walking' && store.nearby)

function render() {
  const wd = worldEl.value
  const pl = playerRef.value?.el
  if (!wd || !pl) return
  pl.style.setProperty('--x', player.x.toFixed(1))
  pl.style.setProperty('--y', player.y.toFixed(1))
  pl.dataset.x = Math.round(player.x)
  pl.dataset.y = Math.round(player.y)
  wd.style.transform = `rotateX(${camera.tilt}deg) rotateZ(${camera.yaw.toFixed(3)}deg) translate3d(${(-camera.x).toFixed(1)}px, ${(-camera.y).toFixed(1)}px, 0)`
  if (Math.abs(camera.yaw - lastYaw) > 0.005 || Number.isNaN(lastYaw)) {
    wd.style.setProperty('--yaw', `${camera.yaw.toFixed(3)}deg`)
    lastYaw = camera.yaw
  }
}

function update(dt) {
  const active = store.mode === 'walking'
  const input = active ? getMoveVector() : { x: 0, y: 0 }
  const orbit = active ? clamp(getOrbitInput() + dragOrbit, -1, 1) : 0

  const moving = stepPlayer(player, input, camera.yaw, dt, motion)
  if (moving !== walking.value) walking.value = moving
  if (Math.abs(input.x) > 0.15) {
    const f = input.x > 0 ? 1 : -1
    if (f !== facing.value) facing.value = f
  }

  stepCamera(camera, { targetX: player.x, targetY: player.y, turn: input.x, orbit, sway: !reduceMotion.value }, dt)

  const near = nearestLocation(player, interactables, TRIGGER_RADIUS)
  if (near !== store.nearbyLocation) store.setNearby(near)
  render()
}
useGameLoop(update)

useInput({
  onInteract() {
    if (store.mode === 'walking' && store.nearbyLocation) store.open(store.nearbyLocation)
  },
})

// Navbar jumps: move the player to the door, the camera glides after them.
watch(
  () => store.travel,
  (t) => {
    const loc = t && locationById(t.id)
    if (!loc) return
    player.x = loc.stand.x
    player.y = loc.stand.y
    walking.value = false
  },
)
watch(
  () => store.mode,
  (m) => {
    if (m === 'panel') {
      clearInput()
      dragOrbit = 0
      walking.value = false
    }
  },
)

// Responsive camera: zoom and perspective follow the size of the scene.
function applyView() {
  const el = sceneEl.value
  if (!el) return
  const { width, height } = el.getBoundingClientRect()
  if (!width || !height) return
  const v = computeView(width, height)
  camera.tilt = v.tilt
  el.style.setProperty('--persp', `${v.perspective}px`)
  camEl.value.style.setProperty('--zoom', v.zoom)
  camEl.value.style.setProperty('--anchor-y', `${v.anchorY * 100}%`)
  worldEl.value.style.setProperty('--tilt', `${v.tilt}deg`)
}
let ro = null
onMounted(() => {
  applyView()
  render()
  ro = new ResizeObserver(applyView)
  ro.observe(sceneEl.value)
})
onBeforeUnmount(() => {
  ro && ro.disconnect()
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', onDragEnd)
  window.removeEventListener('pointercancel', onDragEnd)
})

// Drag (or swipe) sideways to orbit a little; it springs back on release.
let drag = null
function onPointerDown(e) {
  if (e.button > 0 || drag) return
  drag = { id: e.pointerId, x: e.clientX }
  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', onDragEnd)
  window.addEventListener('pointercancel', onDragEnd)
}
function onDragMove(e) {
  if (!drag || e.pointerId !== drag.id) return
  dragOrbit = clamp((e.clientX - drag.x) / (window.innerWidth * 0.3), -1, 1)
}
function onDragEnd(e) {
  if (!drag || e.pointerId !== drag.id) return
  drag = null
  dragOrbit = 0
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', onDragEnd)
  window.removeEventListener('pointercancel', onDragEnd)
}
</script>

<template>
  <div ref="sceneEl" class="scene" data-testid="world-scene" @pointerdown="onPointerDown">
    <div ref="camEl" class="cam">
      <div ref="worldEl" class="world">
        <Ground />
        <Structure v-for="loc in structures" :key="loc.id" :loc="loc" />
        <Tree v-for="t in trees" :key="t.id" :x="t.x" :y="t.y" :scale="t.s" :kind="t.kind" />
        <Fountain />
        <Billboard ref="playerRef" :x="SPAWN.x" :y="SPAWN.y" :w="44" :h="66" :shadow="36" data-testid="player">
          <Avatar :walking="walking" :facing="facing" />
        </Billboard>
        <InteractBubble v-if="showBubble" :key="store.nearby.id" :loc="store.nearby" @activate="store.open(store.nearby.id)" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.scene {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--water);
  perspective: var(--persp, 1000px);
  perspective-origin: 50% 32%;
  touch-action: none;
  -webkit-user-select: none;
  user-select: none;
}
.cam {
  position: absolute;
  left: 50%;
  top: var(--anchor-y, 60%);
  width: 0;
  height: 0;
  transform-style: preserve-3d;
  transform: scale(var(--zoom, 1));
}
.world {
  position: absolute;
  left: 0;
  top: 0;
  width: 0;
  height: 0;
  transform-style: preserve-3d;
  will-change: transform;
}
</style>
