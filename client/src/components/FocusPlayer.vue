<script setup>
import SproutIcon from './SproutIcon.vue'
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { usePomodoroStore } from '@/stores/pomodoro'
import { useUiStore } from '@/stores/ui'

// Mini timer that floats over every page while a session runs, so users can keep studying elsewhere.
// Drag it anywhere (except by its buttons); it stays on screen and remembers where it was left.
const pomo = usePomodoroStore()
const route = useRoute()

// the Focus page already shows the big ring, so the mini player only appears on the other pages
const visible = computed(() => pomo.phase === 'running' && route.name !== 'pomodoro')

const caption = computed(() => (pomo.mode === 'focus'
  ? `Focus ${pomo.current.number}/${pomo.focusTotal}`
  : `Break ${pomo.current.number}/${pomo.breakTotal}`))

/* ---------- dragging ---------- */
const MARGIN = 16 // gap kept between the player and the screen edge
const STORAGE_KEY = 'sproutly.focusPlayer.pos'

const box = ref(null)
const pos = ref(loadPos()) // top-left corner in px; null = default bottom-right corner
const dragging = ref(false)
let grab = null // where inside the player the pointer picked it up, so it doesn't jump

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
  box.value.setPointerCapture(e.pointerId) // keep getting moves even if the pointer outruns the box
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

// a smaller window (or a position saved on a bigger screen) could leave it off screen
function keepOnScreen() {
  if (pos.value && box.value) pos.value = clamp(pos.value.x, pos.value.y)
}
watch(visible, async (shown) => {
  if (!shown) return
  await nextTick() // wait for the player to exist before measuring it
  keepOnScreen()
})
/* ---------- let seeds through ----------
   While a seed is dragged (or tapped and waiting for a spot) the drop goes to whatever is under the
   pointer. Over the player that was the player, so the garden spot below looked unplantable.
   pointer-events: none lets the drag reach the garden instead. */
const ui = useUiStore()
const browserDrag = ref(false) // any HTML drag-and-drop in progress (the seed packet uses it)
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
      <RouterLink :to="{ name: 'pomodoro' }" class="open" aria-label="Open the Focus page" title="Open the Focus page">↗</RouterLink>
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
  background: var(--paper);
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
.open { color: var(--bark-muted); text-decoration: none; font-size: 18px; align-self: flex-start; }
.open:hover { color: var(--bark); }

/* progress: peach while focusing, grey on a break (same as the big ring) */
.bar { height: 6px; margin-top: 8px; border-radius: 999px; background: var(--peri-soft); overflow: hidden; }
.bar span { display: block; height: 100%; background: var(--butter-deep); transition: width .25s linear; }
.focus-player.break .bar span { background: var(--mint-deep); }
</style>
