<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useGardenStore } from '@/stores/garden'
import { useUiStore } from '@/stores/ui'

const garden = useGardenStore()   // garden.seeds: { id, col, row, stage (0 | 1 | 2) }
const ui = useUiStore()
const router = useRouter()

/* ---------- constants (world px unless noted) ---------- */
const CELL_SIZE = 100, GRID_COLS = 15, GRID_ROWS = 20
const GRID_WIDTH = CELL_SIZE * GRID_COLS
const SCROLL_RANGE = 1500            // vertical scroll travel
const PLOT_SIZE = 150              
const SHADOW_ROOM = 30               // px below a plant's base that stay visible, so its shadow isn't clipped
const BOTTOM_MARGIN = 24             // gap between the front row and the bottom of the view
const HALF_PI = Math.PI / 2
const STAGE_SIZE = [0.6, 0.8, 1]    // sprout / seedling / bloom
const SEED_MIME = 'application/x-sproutly-seed'
const EDGE_SCROLL_ZONE = 90          // dragging within this many px of the view edge auto-scrolls

/* ---- look & feel ---- */
const FILL = 0.96                    // on wide screens the grid's front edge spans this share of the view
const MIN_SCALE = 0.6                // narrower screens stop shrinking here and scroll sideways instead
const FAR_SPREAD = 0.8               // horizontal spread at the horizon (1 = parallel columns, 0 = all meet in the middle)
const FAR_SIZE = 0.35                // plant size at the horizon edge

/* ---------- floor layout: watermelon stripes + meandering path ---------- */
const STRIPE_COLORS = ['#97BF54', '#73C34E']
const PATH_COLOR = '#DAB381', PATH_EDGE_COLOR = '#C8B89D'
const STRIPE_THICKNESS = CELL_SIZE * 2, STRIPE_WOBBLE = STRIPE_THICKNESS * 0.2   // wobble < thickness / 3 so neighbouring edges never cross
const STRIPE_SAMPLE_GAP = CELL_SIZE * 0.5, PATH_STEP = 16                        // polygon resolution

const wave = (distance, wavelength, phase) => Math.sin(distance / wavelength + phase)

// each stripe edge is a depth that waves along x: two out-of-sync waves => wavy but never periodic-looking
const stripeEdgeDepth = (stripe, worldX) =>
  stripe * STRIPE_THICKNESS + STRIPE_WOBBLE * (wave(worldX, CELL_SIZE * 7, stripe * 1.7) + 0.5 * wave(worldX, CELL_SIZE * 3, stripe * 3.1))
const pathCenterX = depth =>
  GRID_WIDTH / 2 + CELL_SIZE * 1.4 * (wave(depth, CELL_SIZE * 6, 0) + 0.5 * wave(depth, CELL_SIZE * 2.3, 1.3))
const pathHalfWidth = depth =>                                            // swings between ~0.5 and ~1.6 cells
  CELL_SIZE * (1.05 + 0.55 * (0.6 * wave(depth, CELL_SIZE * 4.1, 0.4) + 0.4 * wave(depth, CELL_SIZE * 1.7, 2.2)))

const camera = { viewWidth: 400, viewHeight: 700, scale: 1, contentWidth: 400, frontY: 0, radius: 0, horizonY: 0, scrollPos: 0, panX: 0, centerX: 0 }
const scrollerEl = ref(null), stageEl = ref(null), canvasEl = ref(null), ghostEl = ref(null)
const plantElements = new Map()
const screenPoint = {}               // reused by every projection: no per-frame allocations
let hoverCell = null, renderQueued = false, resizeObserver

const occupiedCells = computed(() => new Set(garden.seeds.map(seed => `${seed.col},${seed.row}`)))
const registerPlant = (id, el) => (el ? plantElements.set(id, el) : plantElements.delete(id))

/* 1 at the front of the field, easing to `farValue` at the horizon */
const shrinkTo = (farValue, angle) => farValue + (1 - farValue) * Math.max(0, Math.cos(angle))

function measureView() {
  const { clientWidth: viewWidth, clientHeight: viewHeight } = scrollerEl.value
  camera.viewWidth = viewWidth
  camera.viewHeight = viewHeight
  camera.scale = Math.max(MIN_SCALE, (viewWidth * FILL) / GRID_WIDTH)
  camera.contentWidth = GRID_WIDTH * camera.scale + viewWidth * (1 - FILL)   // > viewWidth on phones => horizontal scroll
  camera.frontY = viewHeight - BOTTOM_MARGIN
  camera.radius = camera.frontY * 0.82
  camera.horizonY = camera.frontY - camera.radius

  const cssVars = {
    '--view-width': viewWidth, '--view-height': viewHeight,
    '--content-width': camera.contentWidth, '--scroll-range': SCROLL_RANGE, '--sprite-size': PLOT_SIZE,
  }
  for (const [name, px] of Object.entries(cssVars)) scrollerEl.value.style.setProperty(name, px + 'px')
  updateScroll()
}

function updateScroll() {
  const { scrollTop, scrollLeft } = scrollerEl.value
  camera.scrollPos = Math.min(SCROLL_RANGE, Math.max(0, SCROLL_RANGE - scrollTop))   // scroll up = travel forward
  camera.panX = scrollLeft - (camera.contentWidth - camera.viewWidth) / 2           // 0 when centred
  camera.centerX = GRID_WIDTH / 2 + camera.panX / camera.scale                     // world x at the middle of the view
  requestRender()
}

function requestRender() {
  if (renderQueued) return
  renderQueued = true
  requestAnimationFrame(() => { renderQueued = false; render() })
}

/* ---------- projection: world (x, depth) <-> screen ---------- */
const depthToAngle = depth => ((depth - camera.scrollPos) * camera.scale) / camera.radius
const screenY = angle => camera.frontY - camera.radius * Math.sin(angle)
const screenX = (worldX, angle) =>
  camera.viewWidth / 2 + (worldX - camera.centerX) * camera.scale * shrinkTo(FAR_SPREAD, angle)

/* Writes the sprite's screen position into screenPoint. Returns false when it is fully behind the curve. */
function worldToScreen(worldX, depth, sizeFactor) {
  const angle = depthToAngle(depth)
  if (angle < -0.3) return false
  const y = screenY(angle), size = camera.scale * shrinkTo(FAR_SIZE, angle) * sizeFactor
  const hiddenPx = angle > HALF_PI ? (y - camera.horizonY) / size : -SHADOW_ROOM   // sprite px below the horizon line
  if (hiddenPx > PLOT_SIZE) return false
  Object.assign(screenPoint, { x: screenX(worldX, angle), y, scale: size, clipped: hiddenPx, zIndex: 2000 - Math.round(angle * 500) })
  return true
}

function screenToCell(pixelX, pixelY) {
  const heightAboveFront = camera.frontY - pixelY
  if (heightAboveFront < 0 || heightAboveFront > camera.radius * 0.97) return null
  const angle = Math.asin(heightAboveFront / camera.radius)
  const worldX = camera.centerX + (pixelX - camera.viewWidth / 2) / (camera.scale * shrinkTo(FAR_SPREAD, angle))
  const depth = camera.scrollPos + (camera.radius * angle) / camera.scale
  const col = Math.floor(worldX / CELL_SIZE), row = Math.floor(depth / CELL_SIZE)
  return col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS ? null : { col, row }
}

/* ---------- rendering ---------- */
function render() {
  drawFloor()
  for (const seed of garden.seeds) {
    const el = plantElements.get(seed.id)
    if (el) placeSprite(el, seed.col, seed.row, STAGE_SIZE[seed.stage] ?? 1)
  }
  updateGhost()
}

function placeSprite(el, col, row, sizeFactor) {
  const visible = worldToScreen((col + 0.5) * CELL_SIZE, (row + 0.5) * CELL_SIZE, sizeFactor)
  el.style.display = visible ? 'block' : 'none'
  if (!visible) return
  const { x, y, scale, clipped, zIndex } = screenPoint
  el.style.transform = `translate3d(${x}px,${y}px,0) scale(${scale})`
  el.style.zIndex = zIndex
  el.style.setProperty('--clipped', clipped + 'px')   // CSS clips whatever is still behind the horizon
}

function drawFloor() {
  const canvas = canvasEl.value, { viewWidth, viewHeight, radius, horizonY, scale, scrollPos, centerX } = camera
  const pixelRatio = window.devicePixelRatio || 1
  if (canvas.width !== viewWidth * pixelRatio || canvas.height !== viewHeight * pixelRatio) {
    canvas.width = viewWidth * pixelRatio
    canvas.height = viewHeight * pixelRatio
  }
  const ctx = canvas.getContext('2d')
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  ctx.clearRect(0, 0, viewWidth, viewHeight)
  ctx.fillStyle = STRIPE_COLORS[0]
  ctx.fillRect(0, horizonY, viewWidth, viewHeight - horizonY)

  const firstDepth = scrollPos - (BOTTOM_MARGIN * 2) / scale     // starts below the view's bottom edge: no empty strip
  const lastDepth = scrollPos + (HALF_PI * radius) / scale       // the horizon
  const floorAngle = depth => Math.min(HALF_PI, depthToAngle(depth))

  const fillStrip = (depth0, depth1, left0, right0, left1, right1) => {   // world-space strip -> curved quad
    const angle0 = floorAngle(depth0), angle1 = floorAngle(depth1)
    ctx.beginPath()
    ctx.moveTo(screenX(left0, angle0), screenY(angle0))
    ctx.lineTo(screenX(right0, angle0), screenY(angle0))
    ctx.lineTo(screenX(right1, angle1), screenY(angle1))
    ctx.lineTo(screenX(left1, angle1), screenY(angle1))
    ctx.fill()
  }

  // stripes: horizontal bands across the field, every other one in the second colour, edges waving along x
  const halfVisibleWidth = viewWidth / (2 * scale * FAR_SPREAD)   // world width on screen is widest at the horizon
  const firstX = Math.floor((centerX - halfVisibleWidth) / STRIPE_SAMPLE_GAP) * STRIPE_SAMPLE_GAP   // grid-aligned: no shimmer
  const lastX = centerX + halfVisibleWidth + STRIPE_SAMPLE_GAP
  const lineToWorld = (worldX, depth) => {
    const angle = floorAngle(depth)
    ctx.lineTo(screenX(worldX, angle), screenY(angle))
  }
  ctx.fillStyle = STRIPE_COLORS[1]
  for (let stripe = Math.floor(firstDepth / STRIPE_THICKNESS) - 1; stripe * STRIPE_THICKNESS < lastDepth; stripe++) {
    if (!(stripe & 1)) continue
    ctx.beginPath()                                                            // one polygon per band: top edge, then bottom edge back
    for (let x = firstX; x <= lastX; x += STRIPE_SAMPLE_GAP) lineToWorld(x, stripeEdgeDepth(stripe, x))
    for (let x = lastX; x >= firstX; x -= STRIPE_SAMPLE_GAP) lineToWorld(x, stripeEdgeDepth(stripe + 1, x))
    ctx.fill()
  }

  // path: darker outline pass, then the fill pass
  for (const [color, outline] of [[PATH_EDGE_COLOR, 8], [PATH_COLOR, 0]]) {
    ctx.fillStyle = color
    for (let depth = Math.floor(firstDepth / PATH_STEP) * PATH_STEP; depth < lastDepth; depth += PATH_STEP) {
      const nextDepth = depth + PATH_STEP + 1
      const center0 = pathCenterX(depth), center1 = pathCenterX(nextDepth)
      const half0 = pathHalfWidth(depth) + outline, half1 = pathHalfWidth(nextDepth) + outline
      fillStrip(depth, nextDepth, center0 - half0, center0 + half0, center1 - half1, center1 + half1)
    }
  }
}

/* ---------- interaction ---------- */
function isBlocked(col, row) {
  const depth = (row + 0.5) * CELL_SIZE
  const onPath = Math.abs((col + 0.5) * CELL_SIZE - pathCenterX(depth)) < pathHalfWidth(depth) + CELL_SIZE / 2
  return onPath || occupiedCells.value.has(`${col},${row}`)
}

function cellFromEvent(e) {
  const stage = stageEl.value.getBoundingClientRect()
  return screenToCell(e.clientX - stage.left, e.clientY - stage.top)
}

function cellAtPointer(e) {
  const rect = stageEl.value.getBoundingClientRect()
  if (e.clientX < rect.left || e.clientX >= rect.right || e.clientY < rect.top || e.clientY >= rect.bottom) return null
  return cellFromEvent(e)
}

function dropAt(e) {
  const cell = cellAtPointer(e)
  clearGhost()
  ui.seedPicked = false
  ui.seedDragPointerId = null
  if (!cell || isBlocked(cell.col, cell.row)) return
  router.push({ name: 'seed-create', params: { col: cell.col, row: cell.row } })
}

function onDragOver(e) {
  if (!e.dataTransfer.types.includes(SEED_MIME)) return
  e.preventDefault()
  e.dataTransfer.dropEffect = 'copy'
  const view = scrollerEl.value.getBoundingClientRect()          // edge auto-scroll: reach the back / pan sideways
  if (e.clientY - view.top < EDGE_SCROLL_ZONE) scrollerEl.value.scrollTop -= 14
  scrollerEl.value.scrollLeft += 14 * ((e.clientX > view.right - EDGE_SCROLL_ZONE) - (e.clientX < view.left + EDGE_SCROLL_ZONE))
  hoverCell = cellFromEvent(e)
  requestRender()
}
function onDragLeave(e) { if (!stageEl.value.contains(e.relatedTarget)) clearGhost() }
function clearGhost() { hoverCell = null; requestRender() }

function updateGhost() {
  const ghost = ghostEl.value
  if (!hoverCell) { ghost.style.display = 'none'; return }
  placeSprite(ghost, hoverCell.col, hoverCell.row, 1)
  ghost.classList.toggle('blocked', isBlocked(hoverCell.col, hoverCell.row))
}

function onDrop(e) {
  const rawSeed = e.dataTransfer.getData(SEED_MIME)
  if (rawSeed) dropAt(e)
}

function onPointerMove(e) {
  if (e.pointerId !== ui.seedDragPointerId) return
  e.preventDefault()
  hoverCell = cellAtPointer(e)
  requestRender()
}

function onPointerUp(e) {
  if (e.pointerId !== ui.seedDragPointerId) return
  dropAt(e)
}

function onPointerCancel(e) {
  if (e.pointerId !== ui.seedDragPointerId) return
  clearGhost()
  ui.seedPicked = false
  ui.seedDragPointerId = null
}

function onPlantClick(seed) {
  // Shovel -> TODO: remove plant (confirm first).
  if (ui.activeTool === 'shovel') return
  router.push({ name: 'seed-review', params: { id: seed.id } })
}

/* ---------- lifecycle ---------- */
watch(() => garden.seeds, requestRender, { deep: true, flush: 'post' })
onMounted(() => {
  resizeObserver = new ResizeObserver(measureView)
  resizeObserver.observe(scrollerEl.value)
  window.addEventListener('pointermove', onPointerMove, { passive: false })
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerCancel)
  measureView()
  scrollerEl.value.scrollTop = SCROLL_RANGE                                        // start at the front edge
  scrollerEl.value.scrollLeft = (camera.contentWidth - camera.viewWidth) / 2      // start centred
  updateScroll()
  render()                                                                         // draw now: no empty first frame
})
onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerCancel)
})
</script>

<template>
  <div ref="scrollerEl" class="scroller" @scroll.passive="updateScroll">
    <div class="track">
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
          :ref="el => registerPlant(seed.id, el)"
          class="plant"
          @click="onPlantClick(seed)"
        >
          <h2 >{{seed.title}}</h2>
          <div class="shadow"></div>
          <img class="sprite" src="../assets/foliage/tulip.svg" alt="" draggable="false" />
        </div>

        <div ref="ghostEl" class="plant ghost">
          <img class="sprite" src="../assets/foliage/tulip.svg" alt="" draggable="false" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scroller { height: 100%; overflow: auto; overscroll-behavior: contain; }
.track { width: var(--content-width); height: calc(var(--view-height) + var(--scroll-range)); }
.stage { position: sticky; top: 0; left: 0; width: var(--view-width); height: var(--view-height); overflow: hidden; user-select: none; }
canvas { position: absolute; inset: 0; width: 100%; height: 100%; }

/* the wrapper is a 0x0 box at the plant's base; clip-path hides whatever is still behind the horizon
   (--clipped = sprite px below the horizon line; negative leaves room for the shadow) */
.plant {
  position: absolute; left: 0; top: 0; width: 0; height: 0; display: none; will-change: transform;
  clip-path: inset(-1000px -1000px var(--clipped, 0px) -1000px);
}
.sprite {
  position: absolute; left: calc(var(--sprite-size) / -2); bottom: 0; width: var(--sprite-size); height: var(--sprite-size);
  transform-origin: 50% 100%; cursor: pointer; transition: filter .3s, transform .3s;
}
.shadow {
  position: absolute; left: calc(var(--sprite-size) / -4.5); bottom: -6px;
  width: calc(var(--sprite-size) / 2.2); height: calc(var(--sprite-size) / 8); border-radius: 50%; background: var(--shadow);
}

.ghost { pointer-events: none; z-index: 9000 !important; }   /* translucent pending plant when dragging across canvasadd */
.ghost .sprite { opacity: .6; }
.ghost.blocked .sprite { filter: grayscale(1) sepia(1) hue-rotate(-40deg) saturate(4); }

</style>