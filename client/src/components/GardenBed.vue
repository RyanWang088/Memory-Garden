<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGardenStore } from '@/stores/garden'
import { useUiStore } from '@/stores/ui'
import { useToastStore } from '@/stores/toast'
import { CELL_SIZE, isOnPath } from '@/lib/floorLayout'
import { createGardenCamera, SCROLL_RANGE } from '@/lib/gardenCamera'
import { drawMeadow } from '@/lib/meadowRenderer'
import { loadLogSprite } from '@/lib/logSprite'
import PlantSprite from './PlantSprite.vue'
import Modal from './Modal.vue'
import { useSeedDrag } from '@/composables/useSeedDrag'
// import backdropUrl from '@/assets/backdrop.png'

const garden = useGardenStore()   // garden.seeds: { id, col, row, mastery, last_reviewed }
const ui = useUiStore()
const route = useRoute()
const router = useRouter()
const toast = useToastStore()
const seedToDelete = ref(null)
const deletingSeed = ref(false)
const deleteError = ref('')

const cam = createGardenCamera()
const { camera, measure: measureCamera, updateScroll: updateCameraScroll, worldToScreen, screenToCell, screenPoint } = cam

const stageById = { get: id => garden.stageOf(garden.seeds.find(s => s.id === id)) }

const scrollerEl = ref(null), stageEl = ref(null), canvasEl = ref(null), ghostRef = ref(null)
const plantElements = new Map()
const plantInfoElements = new Map()
const hoveredPlantInfoId = ref(null)
const ghostBlocked = ref(false)
let renderQueued = false, resizeObserver
let scrollIdleTimer

// meadow art: the backdrop sits behind the canvas; the log is drawn as a sprite
const meadowAssets = { logImg: loadLogSprite(() => requestRender()) }

const occupiedCells = computed(() => new Set(garden.seeds.map(seed => `${seed.col},${seed.row}`)))
const registerPlant = (id, el) => (el ? plantElements.set(id, el) : plantElements.delete(id))
const registerPlantInfo = (id, el) => (el ? plantInfoElements.set(id, el) : plantInfoElements.delete(id))
const isPlantInfoVisible = id => hoveredPlantInfoId.value === id || ui.selectedGardenSeedId === id

function onPlantPointerEnter(id) {
  hoveredPlantInfoId.value = id
}

function onPlantPointerLeave(id) {
  if (hoveredPlantInfoId.value === id) hoveredPlantInfoId.value = null
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
  for (const seed of garden.seeds) {
    const el = plantElements.get(seed.id)
    const infoEl = plantInfoElements.get(seed.id)
    if (el) placeSprite(el, seed.col, seed.row)
    if (infoEl) placePlantInfo(infoEl, seed.col, seed.row)
  }
  updateGhost()
}

function placeSprite(el, col, row) {
  const visible = worldToScreen((col + 0.5) * CELL_SIZE, (row + 0.5) * CELL_SIZE)
  el.style.display = visible ? 'block' : 'none'
  if (!visible) return
  const { x, y, scale, clipped, zIndex } = screenPoint
  el.style.transform = `translate3d(${x}px,${y}px,0) scale(${scale})`
  el.style.setProperty('--inverse-plant-scale', String(1 / scale))
  el.style.setProperty('--plant-label-gap', `${8 / scale}px`)
  el.style.zIndex = zIndex
  el.style.setProperty('--clipped', clipped + 'px')
}

function placePlantInfo(el, col, row) {
  const visible = worldToScreen((col + 0.5) * CELL_SIZE, (row + 0.5) * CELL_SIZE)
  el.style.display = visible ? 'flex' : 'none'
  if (!visible) return
  const { x, y } = screenPoint
  el.style.transform = `translate3d(${x}px,${y + 8}px,0) translateX(-50%)`
  el.style.zIndex = 10000
}

function scrollToSeed() {
  const seedId = route.query.scrollTo
  if (typeof seedId !== 'string') return

  const seed = garden.seeds.find(item => item.id === seedId)
  if (!seed || !scrollerEl.value || camera.radius <= 0) return

  const targetY = camera.viewHeight * 0.68
  const sine = Math.max(-1, Math.min(1, (camera.frontY - targetY) / camera.radius))
  const angle = Math.asin(sine)
  const depth = (seed.row + 0.5) * CELL_SIZE
  const targetScrollPos = Math.max(0, Math.min(SCROLL_RANGE, depth - (angle * camera.radius) / camera.scale))
  scrollerEl.value.scrollTo({ top: SCROLL_RANGE - targetScrollPos, behavior: 'smooth' })
  ui.selectGardenSeed(seedId)
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
  drawMeadow(ctx, cam, meadowAssets)
}

function isBlocked(col, row) {
  return isOnPath(col, row) || occupiedCells.value.has(`${col},${row}`)
}

const seedDrag = useSeedDrag({
  scrollerEl,
  stageEl,
  ghostRef,
  ghostBlocked,
  screenToCell,
  isBlocked,
  placeSprite,
  requestRender,
})
const { updateGhost, onDragOver, onDragLeave, onDrop } = seedDrag

function onPlantClick(seed, event) {
  if (event && !event.target.closest('.sprite')) return
  if (ui.activeTool === 'shovel') {
    seedToDelete.value = seed
    deleteError.value = ''
    return
  }
  router.push({ name: 'seed-review', params: { id: seed.id } })
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

watch(() => garden.seeds, () => {
  requestRender()
  scrollToSeed()
}, { deep: true, flush: 'post' })
watch(() => route.query.scrollTo, scrollToSeed, { flush: 'post' })
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
        <!-- <img class="backdrop" :src="backdropUrl" alt="" draggable="false" /> -->
        <canvas ref="canvasEl"></canvas>

        <PlantSprite
          v-for="seed in garden.seeds"
          :key="seed.id"
          :id="seed.id"
          :ref="c => registerPlant(seed.id, c?.$el)"
          :stage="stageById.get(seed.id)"
          :flower="seed.flower"
          :color="seed.color"
          :wilting="garden.isWilted(seed)"
          :alert="seed.alert"
          :class="{ 'is-highlighted': ui.selectedGardenSeedId === seed.id }"
          role="button" tabindex="0" :aria-label="`Open ${seed.title}`"
          @pointerenter="onPlantPointerEnter(seed.id)"
          @pointerleave="onPlantPointerLeave(seed.id)"
          @click="onPlantClick(seed, $event)"
          @keydown.enter.space.prevent="onPlantClick(seed)"
        />
        <div
          v-for="seed in garden.seeds"
          :key="`info-${seed.id}`"
          :ref="el => registerPlantInfo(seed.id, el)"
          class="plant-info"
        >
          <div class="plant-info-details" :class="{ 'is-visible': isPlantInfoVisible(seed.id) }" :aria-hidden="!isPlantInfoVisible(seed.id)">
            <p class="p-1 text-body-strong text-center my-auto">{{ seed.title }}</p>
          </div>
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
    @confirm="confirmDelete"
    @cancel="cancelDelete"
  />
</template>

<style scoped>
.scroller { height: 100%; overflow: auto; overscroll-behavior: contain;scrollbar-width: none; }
.track { width: var(--content-width); height: calc(var(--view-height) + var(--scroll-range)); }
.stage { position: sticky; top: 0; left: 0; width: var(--view-width); height: var(--view-height); overflow: hidden; user-select: none; }
/* .backdrop {
  position: absolute; left: 0; bottom: calc(100% - var(--horizon-y)); width: 100%; height: auto;
  pointer-events: none;
} */
canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
.plant-info {
  position: absolute; top: 0; left: 0; pointer-events: none;
}
.plant-info-details {
  position: absolute; top: 0; left: 50%; width: max-content; max-width: 200px;
  padding: 6px 12px; border-radius: 999px; background: var(--cream);
  opacity: 0; visibility: hidden; transform: translate(-50%, -6px);
  transition: opacity .2s ease, transform .35s var(--spring), visibility 0s linear .35s;
}
.plant-info-details.is-visible {
  opacity: 1; visibility: visible; transform: translate(-50%, 0);
  transition: opacity .2s ease, transform .35s var(--spring), visibility 0s;
}
.plant-info-details::after {
  position: absolute; top: -7px; left: 50%; width: 0; height: 0;
  border-bottom: 8px solid var(--cream);
  border-right: 8px solid transparent; border-left: 8px solid transparent;
  content: ''; transform: translateX(-50%);
}
</style>