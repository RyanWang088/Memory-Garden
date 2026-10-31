<script setup>
import SproutIcon from './SproutIcon.vue'
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { usePomodoroStore } from '@/stores/pomodoro'
import { useUiStore } from '@/stores/ui'

// Mini timer that floats over other pages while a session runs. Drag it anywhere; it remembers where.
const pomo = usePomodoroStore()
const route = useRoute()

// shown on every page except Focus; the – button hides it until the user opens Focus again
const hidden = ref(false)
watch(() => route.name, (name) => { if (name === 'pomodoro') hidden.value = false })
const visible = computed(() => pomo.phase === 'running' && route.name !== 'pomodoro' && !hidden.value)

const caption = computed(() => (pomo.mode === 'focus'
  ? `Focus ${pomo.current.number}/${pomo.focusTotal}`
  : `Break ${pomo.current.number}/${pomo.breakTotal}`))

/* ---------- dragging ---------- */
const MARGIN = 16 // gap kept between the player and the screen edge
const STORAGE_KEY = 'sproutly.focusPlayer.pos'

const box = ref(null)
const pos = ref(loadPos()) // top-left corner in px; null = default bottom-right corner
const dragging = ref(false)
let grab = null // where the pointer grabbed it, so it doesn't jump

function loadPos() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) } catch { return null }
}
function savePos() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(pos.value)) } catch { /* private mode: just don't remember */ }
}

// keeps the whole player inside the window
function clamp(x, y) {
  const w = box.value.offsetWidth, h = box.value.offsetHeight
  return {
    x: Math.min(Math.max(MARGIN, x), window.innerWidth - w - MARGIN),
    y: Math.min(Math.max(MARGIN, y), window.innerHeight - h - MARGIN),
  }
}

function onPointerDown(e) {
  if (e.button !== 0 || e.target.closest('button, a')) return // buttons and the link still click normally
  const rect = box.value.getBoundingClientRect()
  grab = { dx: e.clientX - rect.left, dy: e.clientY - rect.top }
  dragging.value = true
  box.value.setPointerCapture(e.pointerId) // keep following the pointer even if it moves fast
}
function onPointerMove(e) {
  if (!grab) return
  pos.value = clamp(e.clientX - grab.dx, e.clientY - grab.dy)
}
function onPointerUp() {
  if (!grab) return
  grab = null
  dragging.value = false
  savePos()
}

// keep it on screen after a resize
function keepOnScreen() {
  if (pos.value && box.value) pos.value = clamp(pos.value.x, pos.value.y)
}
watch(visible, async (shown) => {
  if (!shown) return
  await nextTick() // wait until the player is shown before measuring it
  keepOnScreen()
})
/* ---------- let seed drags pass through the player, so the garden under it can still be planted ---------- */
const ui = useUiStore()
const browserDrag = ref(false) // any drag-and-drop in progress (the seed packet uses it)
const passThrough = computed(() => browserDrag.value || ui.seedPicked)
const dragStarted = () => { browserDrag.value = true }
const dragFinished = () => { browserDrag.value = false }

onMounted(() => {
  window.addEventListener('resize', keepOnScreen)
  window.addEventListener('dragstart', dragStarted)
  window.addEventListener('dragend', dragFinished)
  window.addEventListener('drop', dragFinished)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', keepOnScreen)
  window.removeEventListener('dragstart', dragStarted)
  window.removeEventListener('dragend', dragFinished)
  window.removeEventListener('drop', dragFinished)
})
</script>

<template>
  <aside
    v-if="visible" ref="box" class="focus-player" :class="[pomo.mode, { dragging, 'pass-through': passThrough }]"
    :style="pos ? { left: `${pos.x}px`, top: `${pos.y}px` } : null"
    aria-label="Focus timer" data-testid="focus-player"
    @pointerdown="onPointerDown" @pointermove="onPointerMove" @pointerup="onPointerUp" @pointercancel="onPointerUp"
  >
    <div class="d-flex align-items-center gap-3">
      <div class="flex-fill">
        <div class="text-label-caption">{{ caption }}<span v-if="!pomo.running"> · paused</span></div>
        <div class="time" data-testid="focus-player-time">{{ pomo.label }}</div>
      </div>
      <button
        type="button" class="toggle" :aria-label="pomo.running ? 'Pause' : 'Resume'" data-testid="focus-player-toggle"
        @click="pomo.running ? pomo.pause() : pomo.resume()"
      ><SproutIcon :glyph="pomo.running ? 'pause' : 'play'" :size="16" /></button>
      <div class="d-flex flex-column align-items-center gap-1 align-self-start">
        <RouterLink :to="{ name: 'pomodoro' }" class="open" aria-label="Open the Focus page" title="Open the Focus page">↗</RouterLink>
        <button
          type="button" class="open hide" aria-label="Hide the timer" title="Hide (it comes back after you visit Focus)"
          data-testid="focus-player-hide" @click="hidden = true"
        ><SproutIcon glyph="minus" :size="16" /></button>
      </div>
    </div>
    <div class="bar" aria-hidden="true"><span :style="{ width: `${(1 - pomo.progress) * 100}%` }"></span></div>
  </aside>
</template>

<style scoped>
.focus-player {
  position: fixed;
  right: 16px;   /* default corner; left/top from dragging take over once moved */
  bottom: calc(var(--dock-h) + 34px); /* sits above the bottom dock */
  z-index: 1040; /* above the sticky navbar */
  width: 220px;
  padding: 12px 14px 10px;
  border: 0;
  border-radius: 20px;
  background: var(--sheet);
  box-shadow: 0 10px 30px -8px var(--shadow-card);
  cursor: grab;
  touch-action: none; /* on phones, dragging moves the player instead of scrolling the page */
  user-select: none;
}
.focus-player[style] { right: auto; bottom: auto; }
.focus-player.dragging { cursor: grabbing; box-shadow: 0 16px 36px -8px var(--shadow); }
/* a seed is being planted: fade and let the pointer reach the garden underneath */
.focus-player.pass-through { pointer-events: none; opacity: .4; transition: opacity .15s; }

.time {
  font-family: var(--f-display);
  font-weight: 500;
  font-size: 28px;
  line-height: 32px;
  font-variant-numeric: tabular-nums;
}

.toggle {
  width: 40px;
  height: 40px;
  flex: none;
  border: 0;
  border-radius: 50%;
  background: var(--berry);
  color: #fff;
  font-size: 14px;
  display: grid; place-items: center;
  box-shadow: 0 3px 0 var(--berry-deep);
  transition: transform .1s;
}
.toggle:active { transform: translateY(2px); box-shadow: 0 1px 0 var(--berry); }
.open { color: var(--bark-muted); text-decoration: none; font-size: 18px; }
.hide { display: grid; place-items: center; padding: 0; border: 0; background: none; }
.open:hover { color: var(--bark); }

/* progress bar: butter while focusing, green on a break */
.bar { height: 6px; margin-top: 8px; border-radius: var(--r-pill); background: var(--peri-soft); overflow: hidden; }
.bar span { display: block; height: 100%; background: var(--butter-deep); transition: width .25s linear; }
.focus-player.break .bar span { background: var(--mint-deep); }
</style>
