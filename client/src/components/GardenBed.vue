<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useGardenStore } from '@/stores/garden'
import { useUiStore } from '@/stores/ui'
import { useToastStore } from '@/stores/toast'
import { useWeatherStore } from '@/stores/weather'
import { CELL_SIZE } from '@/lib/floorLayout'
import { createGardenCamera, SCROLL_RANGE } from '@/lib/gardenCamera'
import { drawMeadow } from '@/lib/meadowRenderer'
import { useSeedDrag } from '@/composables/useSeedDrag'
import { useMeadowPalette } from '@/composables/useMeadowPalette'
import PlantSprite from './PlantSprite.vue'
import PlantReviewActions from './PlantReviewActions.vue'
import Modal from './Modal.vue'

const garden = useGardenStore()   // garden.gardenSeeds: { id, col, row, mastery, last_reviewed }, the plants still in the garden
const ui = useUiStore()
const route = useRoute()
const router = useRouter()
const toast = useToastStore()
const PLANT_SPRITE_SIZE = 170

// Opening the garden: only the plant we are scrolling to keeps a pending stage-up. Runs before the first render,
// so plants never flash their new stage early.
garden.keepOnlyGrowth(route.query.scrollTo)
console.log('[growth] garden opened', route.query.scrollTo, JSON.stringify(garden.growthRecords))
const cam = createGardenCamera()
const { camera, measure: measureCamera, updateScroll: updateCameraScroll, worldToScreen, screenToCell, screenPoint } = cam

const scrollerEl = ref(null), stageEl = ref(null), canvasEl = ref(null), ghostRef = ref(null)
const ghostBlocked = ref(false)
const plantingSeedId = ref(null)
const plantElements = new Map()
const plantInfoElements = new Map()
const plantOverlayElements = new Map()
let renderQueued = false, resizeObserver, scrollIdleTimer, hoverHideTimer

// the canvas, the plants and the critters all follow the same look as the sky (mood + weather), and crossfade with it
const { look } = storeToRefs(useWeatherStore())
const { palette } = useMeadowPalette(look, requestRender)

const occupiedCells = computed(() => new Set(garden.gardenSeeds.map(seed => `${seed.col},${seed.row}`)))
const registerPlant = (id, el) => (el ? plantElements.set(id, el) : plantElements.delete(id))
const registerPlantInfo = (id, el) => (el ? plantInfoElements.set(id, el) : plantInfoElements.delete(id))
const registerPlantOverlay = (id, el) => (el ? plantOverlayElements.set(id, el) : plantOverlayElements.delete(id))

// Only one plant label is open at a time: a hovered plant wins over the selected one.
const hoveredPlantId = ref(null)
const isPlantInfoVisible = id => hoveredPlantId.value === id || ui.selectedGardenSeedId === id
const areReviewActionsVisible = id => ui.selectedGardenSeedId === id
const isPlantGrowing = id => Boolean(garden.growthRecords[id])
const isPlantAlertVisible = seed => seed.alert && !areReviewActionsVisible(seed.id) && !isPlantGrowing(seed.id)
const isPlantOverlayVisible = seed => isPlantInfoVisible(seed.id) || areReviewActionsVisible(seed.id) || isPlantAlertVisible(seed)
const plantOverlayBottom = stage => stage === 1 || stage === 8 ? 40 : stage === 2 || stage === 7 ? 65 : stage === 3 || stage === 6 ? 110 : 170
function onPlantPointerEnter(id, event) {
  if (event.pointerType !== 'touch') {
    clearTimeout(hoverHideTimer)
    hoveredPlantId.value = id
  }
}

function scheduleHoverClear(id) {
  clearTimeout(hoverHideTimer)
  hoverHideTimer = setTimeout(() => {
    if (hoveredPlantId.value === id) hoveredPlantId.value = null
  }, 180)
}

function onPlantPointerLeave(id, event) {
  const next = event.relatedTarget
  if (next instanceof Element && next.closest('.plant-review-actions')) return
  scheduleHoverClear(id)
}

function measureView() {
  const { clientWidth: viewWidth, clientHeight: viewHeight } = scrollerEl.value
  measureCamera(viewWidth, viewHeight)

  const cssVars = {
    '--view-width': viewWidth, '--view-height': viewHeight,
    '--content-width': camera.contentWidth, '--scroll-range': SCROLL_RANGE,
    '--horizon-y': camera.horizonY,
  }
  for (const [name, px] of Object.entries(cssVars)) scrollerEl.value.style.setProperty(name, px + 'px')
  updateScroll()
}

function updateScroll() {
  const { scrollTop, scrollLeft } = scrollerEl.value
  updateCameraScroll(scrollTop, scrollLeft)
  scrollerEl.value.classList.add('is-scrolling')
  clearTimeout(scrollIdleTimer)
  scrollIdleTimer = setTimeout(() => scrollerEl.value?.classList.remove('is-scrolling'), 120)
  requestRender()
}

function requestRender() {
  if (renderQueued) return
  renderQueued = true
  requestAnimationFrame(() => { renderQueued = false; render() })
}

function render() {
  drawFloor()
  for (const seed of garden.gardenSeeds) {
    const el = plantElements.get(seed.id)
    if (el) placeSprite(el, seed.col, seed.row)
    // the name bubble only needs a position while it is showing
    if (isPlantInfoVisible(seed.id)) {
      const infoEl = plantInfoElements.get(seed.id)
      if (infoEl) placePlantInfo(infoEl, seed.col, seed.row)
    }
    const overlayEl = plantOverlayElements.get(seed.id)
    if (overlayEl) {
      if (isPlantOverlayVisible(seed)) placePlantOverlay(overlayEl, seed.col, seed.row)
      else hideSprite(overlayEl)
    }
  }
  updateGhost()
}

// What was last written to each sprite. Only `transform` changes every frame; display, z-index and the clip
// are written when they actually change, so scrolling doesn't invalidate style on every plant every frame.
const placed = new WeakMap()

function placedState(el) {
  if (!placed.has(el)) placed.set(el, { display: '', z: null, clipped: null })
  return placed.get(el)
}

// every show/hide goes through here so the cache above never disagrees with the DOM
function setDisplay(el, display) {
  const last = placedState(el)
  if (last.display === display) return
  el.style.display = display
  last.display = display
}
const hideSprite = el => setDisplay(el, 'none')

function placeSprite(el, col, row) {
  const visible = worldToScreen((col + 0.5) * CELL_SIZE, (row + 0.5) * CELL_SIZE)
  setDisplay(el, visible ? 'block' : 'none')
  if (!visible) return

  const last = placedState(el)
  const { x, y, scale, clipped } = screenPoint
  el.style.transform = `translate3d(${x}px,${y}px,0) scale(${scale})`
  // plants are depth-sorted by row and that order never changes while scrolling, so z-index is just the row
  const z = 2000 - row
  if (last.z !== z) { el.style.zIndex = z; last.z = z }
  if (last.clipped !== clipped) { el.style.setProperty('--clipped', clipped + 'px'); last.clipped = clipped }
}

function placePlantInfo(el, col, row) {
  const visible = worldToScreen((col + 0.5) * CELL_SIZE, (row + 0.5) * CELL_SIZE)
  el.style.display = visible ? 'block' : 'none'
  if (!visible) return
  const { x, y, scale } = screenPoint
  el.style.setProperty('--plant-height', `${scale * PLANT_SPRITE_SIZE}px`)
  el.style.transform = `translate3d(${x}px,${y + 8}px,0) translateX(-50%)`
  el.style.zIndex = 10000
}

function placePlantOverlay(el, col, row) {
  const visible = worldToScreen((col + 0.5) * CELL_SIZE, (row + 0.5) * CELL_SIZE)
  setDisplay(el, visible ? 'block' : 'none')
  if (!visible) return
  const last = placedState(el)
  if (el.classList.contains('has-review-actions')) {
    if (last.z !== null) {
      el.style.removeProperty('z-index')
      last.z = null
    }
  } else {
    const z = 2000 - row
    if (last.z !== z) { el.style.zIndex = z; last.z = z }
  }
  const { x, y, scale } = screenPoint
  el.style.transform = `translate3d(${x}px,${y}px,0) scale(${scale})`
}

// the scrollLeft that centres the plant horizontally once the garden is scrolled to `top`
// (asks the camera where the plant would land, then puts the camera back)
function leftFor(seed, top) {
  const { scrollTop, scrollLeft } = scrollerEl.value
  updateCameraScroll(top, scrollLeft)
  const visible = worldToScreen((seed.col + 0.5) * CELL_SIZE, (seed.row + 0.5) * CELL_SIZE)
  const { x, scale } = screenPoint
  updateCameraScroll(scrollTop, scrollLeft)
  if (!visible) return scrollLeft // the camera can't place it, so keep the current position instead of using a stale x
  const left = scrollLeft + (x - camera.viewWidth / 2) / (scale || 1)
  return Math.max(0, Math.min(camera.contentWidth - camera.viewWidth, left))
}

function scrollSettled(el, { idleMs = 500, maxMs = 2000 } = {}) {
  return new Promise((resolve) => {
    let idleTimer, capTimer

    const done = () => {
      clearTimeout(idleTimer)
      clearTimeout(capTimer)
      el.removeEventListener('scroll', waitForIdle)
      resolve()
    }
    const waitForIdle = () => {
      clearTimeout(idleTimer)
      idleTimer = setTimeout(done, idleMs)
    }

    el.addEventListener('scroll', waitForIdle, { passive: true })
    capTimer = setTimeout(done, maxMs)
    waitForIdle()
  })
}

// Plays the plant's stage-up once the camera has stopped, so the celebration happens in front of the user
async function revealGrowth(seedId) {
  await scrollSettled(scrollerEl.value)
  garden.releaseGrowth(seedId)
}

async function revealPlanting(seedId) {
  await scrollSettled(scrollerEl.value)
  if (route.query.planted === seedId) plantingSeedId.value = seedId
}

function finishPlanting(seedId) {
  if (plantingSeedId.value !== seedId) return
  plantingSeedId.value = null
  const query = { ...route.query }
  delete query.planted
  router.replace({ name: 'garden', query })
}

function scrollToSeed() {
  const seedId = route.query.scrollTo
  if (typeof seedId !== 'string') return

  const seed = garden.gardenSeeds.find(item => item.id === seedId)
  if (!seed || !scrollerEl.value || camera.radius <= 0) return

  const targetY = camera.viewHeight * 0.68
  const sine = Math.max(-1, Math.min(1, (camera.frontY - targetY) / camera.radius))
  const angle = Math.asin(sine)
  const depth = (seed.row + 0.5) * CELL_SIZE
  const targetScrollPos = Math.max(0, Math.min(SCROLL_RANGE, depth - (angle * camera.radius) / camera.scale))
  const top = SCROLL_RANGE - targetScrollPos
  scrollerEl.value.scrollTo({ top, left: leftFor(seed, top), behavior: 'smooth' })
  ui.selectGardenSeed(seedId)
  revealGrowth(seedId)
  if (route.query.planted === seedId) revealPlanting(seedId)
  const query = { ...route.query }
  delete query.scrollTo
  router.replace({ name: 'garden', query })
}

function drawFloor() {
  const canvas = canvasEl.value
  if (!canvas) return
  const { viewWidth, viewHeight } = camera
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
  if (canvas.width !== viewWidth * pixelRatio || canvas.height !== viewHeight * pixelRatio) {
    canvas.width = viewWidth * pixelRatio
    canvas.height = viewHeight * pixelRatio
  }
  const ctx = canvas.getContext('2d')
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  ctx.clearRect(0, 0, viewWidth, viewHeight)
  drawMeadow(ctx, cam, palette)
}

// the whole grid is plantable now that the path is gone; only taken cells are blocked
const isBlocked = (col, row) => occupiedCells.value.has(`${col},${row}`)

const { updateGhost } = useSeedDrag({
  scrollerEl, stageEl, ghostRef, ghostBlocked,
  screenToCell, isBlocked, placeSprite, hideSprite, requestRender,
})

// ---- opening and deleting plants ----
const seedToDelete = ref(null)
const deletingSeed = ref(false)
const deleteError = ref('')

function onPlantClick(seed, event) {
  if (event && !event.target.closest('.sprite')) return
  if (ui.activeTool === 'shovel') {
    seedToDelete.value = seed
    deleteError.value = ''
    return
  }
  if (ui.activeTool === 'shears') {
    router.push({ name: 'seed-edit', params: { id: seed.id } })
    return
  }
  ui.selectGardenSeed(seed.id)
}

function startReview(seedId, routeName) {
  router.push({ name: routeName, params: { id: seedId } })
}

function cancelDelete() {
  if (deletingSeed.value) return
  seedToDelete.value = null
  deleteError.value = ''
}

async function confirmDelete() {
  if (!seedToDelete.value || deletingSeed.value) return
  deletingSeed.value = true
  deleteError.value = ''
  try {
    const title = seedToDelete.value.title
    await garden.deleteSeed(seedToDelete.value.id)
    seedToDelete.value = null
    toast.show({
      type: 'success',
      title: 'Plant removed',
      message: `${title} and its flashcards were deleted.`,
    })
  } catch (error) {
    deleteError.value = error instanceof Error ? error.message : String(error)
  } finally {
    deletingSeed.value = false
  }
}

watch(() => garden.gardenSeeds, () => {
  requestRender()
  scrollToSeed()
}, { deep: true, flush: 'post' })
watch(() => route.query.scrollTo, scrollToSeed, { flush: 'post' })
// a plant label or its review controls that just started showing needs its position before it fades in
watch([hoveredPlantId, () => ui.selectedGardenSeedId], requestRender, { flush: 'post' })

onMounted(() => {
  resizeObserver = new ResizeObserver(measureView)
  resizeObserver.observe(scrollerEl.value)
  measureView()
  scrollerEl.value.scrollTop = SCROLL_RANGE
  scrollerEl.value.scrollLeft = (camera.contentWidth - camera.viewWidth) / 2
  updateScroll()
  render()
  scrollToSeed()
})
onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  clearTimeout(scrollIdleTimer)
  clearTimeout(hoverHideTimer)
  garden.clearGrowth()
})
</script>

<template>
  <div ref="scrollerEl" class="scroller" @scroll.passive="updateScroll">
    <div class="track">
      <div
        ref="stageEl"
        class="stage"
        :data-tool="ui.activeTool"
        :data-mood="look.mood"
        :data-weather="look.weather"
      >
        <canvas ref="canvasEl" data-testid="meadow"></canvas>

        <PlantSprite
          v-for="seed in garden.gardenSeeds"
          :key="seed.id"
          :id="seed.id"
          :ref="c => registerPlant(seed.id, c?.$el)"
          :label="`Open ${seed.title}`"
          :stage="garden.stageOf(seed)"
          :flower="seed.flower"
          :color="seed.color"
          :wilting="garden.isWilted(seed)"
          :growth="garden.growthRecords[seed.id]"
          :planting="plantingSeedId === seed.id"
          :class="{ 'is-highlighted': ui.selectedGardenSeedId === seed.id }"
          @pointerenter="onPlantPointerEnter(seed.id, $event)"
          @pointerleave="onPlantPointerLeave(seed.id, $event)"
          @select="onPlantClick(seed, $event)"
          @grown="garden.finishGrowth(seed.id)"
          @planted="finishPlanting(seed.id)"
          @click="onPlantClick(seed, $event)"
          @keydown.enter.space.prevent="onPlantClick(seed)"
        />
        <div
          v-for="seed in garden.gardenSeeds"
          :key="`info-${seed.id}`"
          :ref="el => registerPlantInfo(seed.id, el)"
          :data-seed-id="seed.id"
          class="plant-info"
        >
          <div class="plant-info-content">
            <div class="plant-info-details" :class="{ 'is-visible': isPlantInfoVisible(seed.id) }" :aria-hidden="!isPlantInfoVisible(seed.id)">
              <p class="plant-title sp-display">{{ seed.title }}</p>
              <em class="plant-mastery">Mastery {{ Math.round(seed.mastery ?? 0) }}%</em>
            </div>
          </div>
        </div>
        <div
          v-for="seed in garden.gardenSeeds"
          :key="`overlay-${seed.id}`"
          :ref="el => registerPlantOverlay(seed.id, el)"
          class="plant-overlay"
          :class="{ 'has-review-actions': areReviewActionsVisible(seed.id) && !isPlantGrowing(seed.id) }"
        >
          <PlantReviewActions
            v-if="areReviewActionsVisible(seed.id) && !isPlantGrowing(seed.id)"
            :style="{ '--plant-overlay-bottom': `${plantOverlayBottom(garden.stageOf(seed))}px` }"
            @review="startReview(seed.id, $event)"
          />
          <span
            v-else-if="isPlantAlertVisible(seed)"
            class="alert-mark"
            title="Revise this soon"
            data-testid="plant-alert"
            :style="{ '--plant-overlay-bottom': `${plantOverlayBottom(garden.stageOf(seed))}px` }"
          >
            <img src="../assets/ui/droplet.svg" alt="">
          </span>
        </div>
        <PlantSprite ref="ghostRef" ghost :blocked="ghostBlocked" />
      </div>
    </div>
  </div>
  <Modal
    :open="seedToDelete !== null"
    :title="`Delete ${seedToDelete?.title ?? 'plant'}?`"
    message="This permanently removes the plant and all of its flashcards."
    confirm-text="Delete plant"
    :busy="deletingSeed"
    :error="deleteError"
    variant="danger"
    @confirm="confirmDelete"
    @cancel="cancelDelete"
  />
</template>

<style scoped>
.scroller { height: 100%; overflow: auto; overscroll-behavior: contain; scrollbar-width: none; }
.track { width: var(--content-width); height: calc(var(--view-height) + var(--scroll-range)); }
.stage { position: sticky; top: 0; left: 0; width: var(--view-width); height: var(--view-height); overflow: hidden; user-select: none; }
canvas { position: absolute; inset: 0; width: 100%; height: 100%; }

.plant-info { position: absolute; top: 0; left: 0; pointer-events: none; }
.plant-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 0;
  height: 0;
  pointer-events: none;
}
.plant-overlay.has-review-actions { z-index: 10001; }
.alert-mark {
  position: absolute;
  left: -25px;
  bottom: var(--plant-overlay-bottom, 170px);
  width: 50px;
  height: 50px;
  border-radius: 50%;
  animation: alertBob 1.6s ease-in-out infinite;
}
@keyframes alertBob { 50% { transform: translateY(-4px); } }
:global(.is-scrolling) .alert-mark { animation-play-state: paused; }
.plant-info-content { position: absolute; top: 0; left: 0; width: 0; height: 0; }
.plant-info-details {
  position: absolute; top: 0; left: 0; display: flex; flex-direction: column; align-items: center; gap: 1px;
  width: max-content; max-width: min(240px, 80vw); padding: 5px 12px 6px;
  border-radius: 12px; background: color-mix(in srgb, var(--sheet) 90%, transparent); box-shadow: var(--shadow-1);
  opacity: 0; visibility: hidden; transform: translate(-50%, 6px);
  transition: opacity .2s ease, transform .35s var(--spring), visibility 0s linear .35s;
}
.plant-info-details.is-visible {
  opacity: 1; visibility: visible; transform: translate(-50%, 0);
  transition: opacity .2s ease, transform .35s var(--spring), visibility 0s;
}
.plant-title { max-width: 100%; font-size: .95rem; line-height: 1.25; text-align: center; overflow-wrap: anywhere; }
.plant-mastery {
  color: var(--ink-soft); font-family: var(--f-body); font-size: .65rem; font-style: normal;
  font-weight: 800; letter-spacing: .12em; text-transform: uppercase; white-space: nowrap;
}
</style>