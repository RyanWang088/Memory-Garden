<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useGardenStore } from '@/stores/garden'
import { useUiStore } from '@/stores/ui'

const garden = useGardenStore()
const ui = useUiStore()

const CELL = 100, COL = 15, ROW = 40     // grid: 15 x 40 cells, 100 world-px per plant
const GW = COL * CELL                    // grid width in world px
const L = 1500                           // scroll travel (px)
const SPR = 200, BOTTOM = 24, HALF_PI = Math.PI / 2   // SPR = sprite box in px (square); drives CSS + clipping
const STAGE_K = [0.55, 0.8, 1]           // sprout / seedling / bloom size
const SEED_MIME = 'application/x-sproutly-seed'

/* ---- look & feel knobs ----
   FILL     grid width at the front edge, as a share of the view width
   FAR_X    horizontal spread at the horizon (1 = no convergence, 0 = all columns meet in the middle)
   FAR_S    sprite size at the horizon (independent of FAR_X, so the field stays wide while plants shrink)
   FLOOR_W  drawn floor is wider than the grid so land always reaches both screen edges */
const FILL = 0.96, FAR_X = 0.5, FAR_S = 0.35, FLOOR_W = GW * 1.6

/* Optional hand-drawn floor: drop src/assets/floor.png (or .jpg/.webp/.svg).
   Map: image width = FLOOR_W world px, image height = ROW*CELL world px (aspect 2400 x 4000 at defaults).
   glob returns {} when the file doesn't exist, so the build never breaks. */
const floorUrl = Object.values(
  import.meta.glob('../assets/floor.{png,jpg,webp,svg}', { eager: true, query: '?url', import: 'default' })
)[0]
let floorImg = null
if (floorUrl) { floorImg = new Image(); floorImg.onload = () => schedule(); floorImg.src = floorUrl }

/* ---------- handlers ---------- */
function onDrop(e) {
  const raw = e.dataTransfer.getData(SEED_MIME)
  const cell = cellFromEvent(e)
  clearGhost()
  if (!raw || !cell || occupied.value.has(`${cell.c},${cell.r}`)) return
  // modal collects title + cards, then garden.plantSeed() receives col/row with them
  console.log(cell.r, cell.c)
  ui.openCreate({ ...JSON.parse(raw), col: cell.c, row: cell.r })
}

function onPlantClick(seed) {
  // Watering can  -> open the review modal. Shovel -> TODO: remove plant (confirm first).
  if (ui.activeTool === 'shovel') return
  ui.openReview(seed.id)
}

/* ---------- camera: plain object, deliberately NOT reactive ---------- */
const cam = { W: 400, H: 700, u: 1, baseY: 0, R: 0, hy: 0, s: 0 }
const scrollerEl = ref(null), trackEl = ref(null), stageEl = ref(null)
const canvasEl = ref(null), ghostEl = ref(null)
const plantEls = new Map()
let ghostCell = null, queued = false, ro

const occupied = computed(() => new Set(garden.seeds.map(s => `${s.col},${s.row}`)))
const bindPlant = (id, el) => (el ? plantEls.set(id, el) : plantEls.delete(id))

const xk = c => FAR_X + (1 - FAR_X) * Math.max(0, c)   // horizontal spread factor at depth (c = cos θ)
const sk = c => FAR_S + (1 - FAR_S) * Math.max(0, c)   // sprite size factor at depth

function measure() {
  const { clientWidth: W, clientHeight: H } = scrollerEl.value
  cam.W = W; cam.H = H
  cam.u = (W * FILL) / GW                // front edge of the grid spans FILL of the view, at any width
  cam.baseY = H - BOTTOM
  cam.R = cam.baseY * 0.82
  cam.hy = cam.baseY - cam.R             // horizon
  trackEl.value.style.height = H + L + 'px'
  stageEl.value.style.height = H + 'px'
  syncScroll()
}
function syncScroll() {
  cam.s = Math.min(L, Math.max(0, L - scrollerEl.value.scrollTop))  // scroll up = travel forward
  schedule()
}
function schedule() {
  if (queued) return
  queued = true
  requestAnimationFrame(() => { queued = false; render() })
}

/* world (x, v) -> screen; writes into `o`. false = fully hidden behind the curve */
function project(wx, v, k, o) {
  const th = (v - cam.s) / cam.R
  if (th < -0.3) return false
  const c = Math.cos(th)
  const y = cam.baseY - cam.R * Math.sin(th), sc = cam.u * sk(c) * k
  const lc = th > HALF_PI ? (cam.hy - y) / sc : 0   // <0: base still behind the horizon
  if (lc < -SPR) return false
  o.x = cam.W / 2 + (wx - GW / 2) * cam.u * xk(c)
  o.y = y; o.sc = sc; o.cut = Math.max(0, -lc); o.z = 2000 - Math.round(th * 500)
  return true
}
function toCell(px, py) {                 // screen -> grid cell (inverse of project)
  const ys = cam.baseY - py
  if (ys < 0 || ys > cam.R * 0.97) return null
  const th = Math.asin(ys / cam.R)
  const wx = GW / 2 + (px - cam.W / 2) / (cam.u * xk(Math.cos(th)))
  const c = Math.floor(wx / CELL), r = Math.floor((cam.s + cam.R * th) / CELL)
  return c < 0 || c >= COL || r < 0 || r >= ROW ? null : { c, r }
}

function render() {
  drawFloor()
  const o = {}
  for (const seed of garden.seeds) {
    const el = plantEls.get(seed.id)
    if (!el) continue
    const ok = project((seed.col + 0.5) * CELL, (seed.row + 0.5) * CELL, STAGE_K[seed.stage] ?? 1, o)
    el.style.display = ok ? 'block' : 'none'
    if (!ok) continue
    el.style.transform = `translate3d(${o.x}px,${o.y}px,0) scale(${o.sc})`
    el.style.zIndex = o.z
    el.style.setProperty('--cut', o.cut + 'px')   // CSS clips the part below the horizon
    el.classList.toggle('hid', o.cut > 0)
  }
  placeGhost()
}

/* Floor: the drawn image is sliced into thin world-rows; each slice is squashed to its
   curved height and width. Same maths as the plants, so art and plants stay locked together. */
function drawFloor() {
  const c = canvasEl.value, { W, H, R, hy, baseY, u, s } = cam, dpr = window.devicePixelRatio || 1
  if (c.width !== W * dpr || c.height !== H * dpr) { c.width = W * dpr; c.height = H * dpr }
  const g = c.getContext('2d')
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H)
  g.fillStyle = '#7fb85e'; g.fillRect(0, hy, W, H - hy)           // flat backing / fallback
  if (!floorImg || !floorImg.naturalWidth) return
  const iw = floorImg.naturalWidth, ky = floorImg.naturalHeight / (ROW * CELL)
  const STEP = 8, hw = (FLOOR_W / 2) * u
  const vEnd = Math.min(ROW * CELL, s + HALF_PI * R)
  for (let v = Math.floor(Math.max(0, s - 0.3 * R) / STEP) * STEP; v < vEnd; v += STEP) {
    const t1 = (v - s) / R, t2 = Math.min(HALF_PI, (v + STEP - s) / R)
    const y1 = baseY - R * Math.sin(t1), y2 = baseY - R * Math.sin(t2)
    const w = hw * xk(Math.cos((t1 + t2) / 2))
    g.drawImage(floorImg, 0, v * ky, iw, Math.max(1, STEP * ky), W / 2 - w, y2, w * 2, y1 - y2 + 1)
  }
}

/* ---------- drag preview ---------- */
function cellFromEvent(e) {
  const r = stageEl.value.getBoundingClientRect()
  return toCell(e.clientX - r.left, e.clientY - r.top)
}
function onDragOver(e) {
  if (!e.dataTransfer.types.includes(SEED_MIME)) return
  e.preventDefault()
  e.dataTransfer.dropEffect = 'copy'
  if (e.clientY - scrollerEl.value.getBoundingClientRect().top < 90) scrollerEl.value.scrollTop -= 14 // reach the back
  ghostCell = cellFromEvent(e)
  schedule()
}
function onDragLeave(e) { if (!stageEl.value.contains(e.relatedTarget)) clearGhost() }
function clearGhost() { ghostCell = null; schedule() }
function placeGhost() {
  const g = ghostEl.value, o = {}
  if (!ghostCell || !project((ghostCell.c + 0.5) * CELL, (ghostCell.r + 0.5) * CELL, 1, o)) {
    g.style.display = 'none'; return
  }
  g.style.display = 'block'
  g.style.transform = `translate3d(${o.x}px,${o.y}px,0) scale(${o.sc})`
  g.style.setProperty('--cut', o.cut + 'px')
  g.classList.toggle('bad', occupied.value.has(`${ghostCell.c},${ghostCell.r}`))
}

/* ---------- lifecycle ---------- */
watch(() => garden.seeds, schedule, { deep: true, flush: 'post' })
onMounted(() => {
  ro = new ResizeObserver(measure)
  ro.observe(scrollerEl.value)
  measure()
  scrollerEl.value.scrollTop = L          // start at the front edge of the field
  syncScroll()
})
onBeforeUnmount(() => ro?.disconnect())
</script>

<template>
  <div ref="scrollerEl" class="scroller" :style="{ '--spr': SPR + 'px' }" @scroll.passive="syncScroll">
    <div ref="trackEl" class="track">
      <div
        ref="stageEl"
        class="stage"
        :data-tool="ui.activeTool"
        @dragover="onDragOver"
        @dragleave="onDragLeave"
        @drop.prevent="onDrop"
      >
        <canvas ref="canvasEl"></canvas>

        <div
          v-for="seed in garden.seeds"
          :key="seed.id"
          :ref="el => bindPlant(seed.id, el)"
          class="plant"
          @click="onPlantClick(seed)"
        >
          <div class="shadow"></div>
          <img class="spr" src="../assets/foliage/flower.svg" alt="" draggable="false" />
        </div>

        <div ref="ghostEl" class="plant ghost">
          <img class="spr" src="../assets/foliage/flower.svg" alt="" draggable="false" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scroller { height: 100%; overflow-y: auto; overscroll-behavior: contain; }
.track { position: relative; }
.stage { position: sticky; top: 0; overflow: hidden; user-select: none; }
canvas { position: absolute; inset: 0; width: 100%; height: 100%; }

.plant { position: absolute; left: 0; top: 0; width: 0; height: 0; display: none; will-change: transform; }
.spr {
  position: absolute; left: calc(var(--spr) / -2); bottom: 0; width: var(--spr); height: var(--spr);
  transform-origin: 50% 100%; cursor: pointer; transition: filter .3s, transform .3s;
  clip-path: inset(-40px -40px var(--cut, 0px) -40px);   /* hides the part still behind the horizon */
}
.shadow { position: absolute; left: calc(var(--spr) / -4.5); bottom: -6px; width: calc(var(--spr) / 2.2); height: calc(var(--spr) / 8); border-radius: 50%; background: rgba(0,0,0,.2); }
.hid .shadow { display: none; }

.ghost { pointer-events: none; z-index: 9000; }
.ghost .spr { opacity: .6; }
.ghost.bad .spr { filter: grayscale(1) sepia(1) hue-rotate(-40deg) saturate(4); }

.stage[data-tool="watering"] .spr { cursor: url('/cursors/watering-can.svg') 6 6, pointer; }
.stage[data-tool="shovel"] .spr { cursor: url('/cursors/shovel.svg') 6 6, crosshair; }
</style>
