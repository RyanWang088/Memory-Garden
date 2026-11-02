<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useFlowerStore } from '@/stores/flower'
import { useToastStore } from '@/stores/toast'
import { SEED_COLORS } from '@/lib/tagColors'
import { foliageUrl } from '@/lib/plantSprites'
import { burst } from '@/lib/burst'
import coinSvg from '@/assets/ui/coin.svg'

const ui = useUiStore()
const flower = useFlowerStore()
const toast = useToastStore()

const HOLD_MS = 250      // touch/pen: how long to hold the flower before it can be dragged
const DRAG_THRESHOLD = 8 // px: moving this far before the hold ends is a scroll, after it is a drag

const root = ref(null)
const chosenId = ref(null)     // the packet the user selected; it shows the swatches and its flower is the drag handle
const armedId = ref(null)      // the flower that has been held long enough to drag
const justBought = ref(null)

const TAPES = ['', 'is-leaf', 'is-butter']
const tapeOf = (n) => TAPES[n % TAPES.length]

const owned = computed(() => flower.flowers.filter((s) => s.status === 'owned'))
// the "active" packet is the one you chose, or none
const activeId = computed(() => (owned.value.some((s) => s.id === chosenId.value) ? chosenId.value : null))

// the active packet previews the petal colour you pick
const art = (seed) => foliageUrl(`${seed.id}-${seed.id === activeId.value ? ui.selectedSeedColor : 'pink'}-4`)
const short = (seed) => Math.max(0, seed.price - flower.coins)
const pct = (seed) => (seed.price > 0 ? Math.min(100, Math.round((flower.coins / seed.price) * 100)) : 100)
const isPicked = (seed) => ui.seedPicked && ui.selectedSeedFlower === seed.id

function pick(seed) {
  chosenId.value = seed.id
  ui.selectedSeedFlower = seed.id
}

// start every visit to the shed with nothing selected, so a scroll can't start a drag
watch(() => ui.shedOpen, (open) => { if (!open) chosenId.value = null })

// Select first, then drag the selected packet's flower. A touch must hold for HOLD_MS first, and moving
// before that cancels the press so the shed scrolls normally. A mouse is armed immediately.
let press = null

function onPressStart(e, seed) {
  if (seed.id !== activeId.value) return
  if (e.pointerType === 'mouse' && e.button !== 0) return
  press = { seed, x: e.clientX, y: e.clientY, armed: e.pointerType === 'mouse', timer: null }
  if (!press.armed) press.timer = setTimeout(armPress, HOLD_MS)
  e.currentTarget.setPointerCapture(e.pointerId) // keep receiving moves even if the pointer leaves the flower
}

function armPress() {
  if (!press) return
  press.armed = true
  armedId.value = press.seed.id
  navigator.vibrate?.(15) // small buzz where supported
}

function onPressMove(e) {
  if (!press) return
  if (Math.hypot(e.clientX - press.x, e.clientY - press.y) < DRAG_THRESHOLD) return
  if (!press.armed) return endPress() // moved before the hold finished: the user is scrolling
  const { seed } = press
  endPress()
  startDrag(seed, e.pointerId)
}

function endPress() {
  clearTimeout(press?.timer)
  press = null
  armedId.value = null
}

// once armed, stop the browser from turning the same touch into a scroll
function onTouchMove(e) {
  if (press?.armed && e.cancelable) e.preventDefault()
}

// useSeedDrag (in the garden) takes over from here and follows this pointer
function startDrag(seed, pointerId) {
  pick(seed) // the garden plants whatever is in ui.selectedSeedFlower, so make sure it matches
  ui.seedDragPointerId = pointerId
  ui.seedPicked = true
  ui.shedOpen = false
}

async function buy(seed) {
  if (flower.buying !== null) return
  if (seed.status === 'too-expensive') {
    toast.show({
      type: 'warning',
      title: 'Not enough coins',
      message: `You need ${seed.price - flower.coins} more coins to unlock ${seed.name}.`,
    })
    return
  }

  if (!await flower.buy(seed.id)) {
    const error = flower.error.toLowerCase()
    const message = error.includes('insufficient_coins') || error.includes('not enough')
      ? 'You don’t have enough coins for this seed.'
      : error.includes('already_owned') || error.includes('already own')
        ? 'You already own this seed.'
        : error.includes('unknown_flower') || error.includes('not sold')
          ? 'This seed is no longer available.'
          : error.includes('not_authenticated') || error.includes('log in')
            ? 'Please log in again to buy seeds.'
            : 'We couldn’t unlock this seed. Please try again.'
    toast.show({ type: 'warning', title: 'Seed purchase failed', message })
    return
  }

  toast.show({
    type: 'success',
    title: 'New plant species unlocked',
    message: `${seed.id.charAt(0).toUpperCase() + seed.id.slice(1).toLowerCase()} now yours forever`,
  })

  // the new packet pops in, takes the swatches and bursts into leaves
  chosenId.value = seed.id
  justBought.value = seed.id
  setTimeout(() => { if (justBought.value === seed.id) justBought.value = null }, 1400)
  await nextTick()
  const face = root.value?.querySelector(`[data-testid="seed-${seed.id}"]`)
  if (face) burst(face)
}

onMounted(() => flower.load())
</script>

<template>
  <section ref="root" class="shed-seeds" data-testid="shed-seeds">
    <header class="d-grid gap-2 pb-3 border-bottom">
      <span class="sp-eyebrow">Potting Bench</span>
      <h3 class="m-0 fs-3">Plant a <em>new seed</em></h3>
      <p class="small text-body-secondary m-0">Select a packet, then drag it onto the field to start a new deck.</p>
    </header>

    <p v-if="flower.loading && !flower.catalog.length" class="text-body-small" role="status">
      Loading seeds…
    </p>
    <p v-if="flower.error && !flower.catalog.length" class="alert alert-danger py-2 mb-3" role="alert">
      {{ flower.error }}
    </p>
    <div v-if="!flower.loading && !flower.flowers.length && !flower.error" class="product-empty text-center p-4">
      <span class="d-block mb-2" aria-hidden="true">🌱</span>
      <p class="text-body-small m-0">No seeds are available right now. Please check back soon.</p>
    </div>

    <div v-if="flower.flowers.length" class="sp-packet-grid">
      <div v-for="(seed, n) in flower.flowers" :key="seed.id" class="sp-reveal" :style="{ '--i': Math.min(n, 8) }">
        <!-- owned: tap to select; only the selected (active) packet opens its swatch drawer and can be dragged by its flower -->
        <article
          v-if="seed.status === 'owned'" class="sp-packet"
          :class="{ 'is-active': activeId === seed.id, 'is-picked': isPicked(seed), 'is-new': justBought === seed.id }"
        >
          <span class="sp-tape" :class="tapeOf(n)" aria-hidden="true"></span>
          <div
            class="packet-face" role="button" tabindex="0"
            :aria-pressed="activeId === seed.id" :aria-label="`${seed.name} seed`"
            :data-testid="`seed-${seed.id}`"
            @click="pick(seed)" @keydown.enter.space.prevent="pick(seed)"
          >
            <span
              class="sp-packet-art" :class="{ 'is-armed': armedId === seed.id }" :data-testid="`drag-${seed.id}`"
              @pointerdown="onPressStart($event, seed)" @pointermove="onPressMove"
              @pointerup="endPress" @pointercancel="endPress"
              @touchmove="onTouchMove" @contextmenu.prevent
            >
              <img :src="art(seed)" alt="" draggable="false" /><span class="sp-ledge"></span>
            </span>
            <span class="sp-packet-name">{{ seed.name }} seed</span>
          </div>
          <span class="sp-chip owned-chip">{{ seed.price === 0 ? 'Free' : 'Owned' }}</span>

          <div class="sp-drawer" :class="{ 'is-open': activeId === seed.id }">
            <div>
              <p class="swatch-label">Petal colour · {{ ui.selectedSeedColor }}</p>
              <div class="sp-swatches" role="group" aria-label="Choose plant color">
                <button
                  v-for="(color, k) in SEED_COLORS" :key="color" type="button" class="sp-swatch"
                  :class="`swatch-${color}`" :style="{ '--k': k }" :aria-pressed="ui.selectedSeedColor === color"
                  :aria-label="`${color} plant color`" :title="color" @click="ui.selectedSeedColor = color"
                ></button>
              </div>
              <p class="drag-hint"><span class="d-md-none">↑ Hold, then drag</span><span class="d-none d-md-inline">← Drag</span> the flower to the field</p>
            </div>
          </div>
        </article>

        <!-- locked: greyed packet with a lock and a price -->
        <article v-else class="sp-packet is-locked">
          <span class="sp-tape" :class="tapeOf(n)" aria-hidden="true"></span>
          <div class="sp-packet-art">
            <img :src="art(seed)" alt="" draggable="false" />
            <span class="sp-ledge"></span>
            <span class="sp-lock" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
            </span>
          </div>
          <span class="sp-packet-name">{{ seed.name }} seed</span>
          <div v-if="seed.status === 'too-expensive'" class="sp-short">
            <div class="sp-meter-bar" role="progressbar" :aria-valuenow="flower.coins" aria-valuemin="0" :aria-valuemax="seed.price" :aria-label="`${seed.name} savings`"><i :style="{ width: `${pct(seed)}%` }"></i></div>
            <small>{{ short(seed) }} more coin{{ short(seed) === 1 ? '' : 's' }}</small>
          </div>
          <button
            class="sp-btn sp-btn-sm buy-btn" :class="seed.status === 'too-expensive' ? 'sp-btn-ghost' : 'sp-btn-butter'" type="button"
            :disabled="flower.buying !== null" :aria-label="`Buy ${seed.name} for ${seed.price} coins`"
            :data-testid="`buy-${seed.id}`" @click="buy(seed)"
          >
            <img :src="coinSvg" width="22" height="22" alt="" />{{ flower.buying === seed.id ? 'Buying…' : seed.price }}
          </button>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped>
.packet-face { position: relative; display: flex; flex-direction: column; align-items: center; gap: 4px; width: 100%; border-radius: 10px; cursor: pointer; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; outline: none; touch-action: pan-y; }
/* the selected packet's flower is the drag handle; it scrolls like the rest of the shed until a touch hold arms it */
.sp-packet.is-active .sp-packet-art { cursor: grab; }
.sp-packet.is-active .sp-packet-art:active { cursor: grabbing; }
.sp-packet-art.is-armed { transform: scale(1.08); transition: transform .2s var(--spring); }
.packet-face:focus-visible { box-shadow: 0 0 0 3px color-mix(in srgb, var(--leaf) 35%, transparent); }

.owned-chip { padding: .1em .7em; font-size: .72rem; background: var(--leaf-soft); border-color: var(--leaf); color: var(--leaf-deep); }
.owned-chip::before { content: ""; width: 9px; height: 9px; background: var(--leaf); border-radius: 0 100% 0 100%; transform: rotate(-10deg); }

/* swatch drawer (only ever open on the active packet) */
.swatch-label { margin: 8px 0 8px; font-family: var(--f-hand); font-size: 1.15rem; line-height: 1; color: var(--ink-soft); text-transform: capitalize; }
.swatch-red { --sw: var(--berry); }
.swatch-yellow { --sw: var(--butter); }
.swatch-pink { --sw: var(--margin); }
.swatch-purple { --sw: var(--lilac); }
.sp-drawer.is-open .sp-swatch { animation: pop-in .45s var(--spring) both; animation-delay: calc(var(--k) * 55ms + 160ms); }
.drag-hint { margin: 12px 0 2px; font-family: var(--f-hand); font-size: 1.1rem; line-height: 1; color: var(--berry-deep); }

/* just bought: the packet pops in */
.sp-packet.is-new { animation: pack-pop .8s var(--spring); }
@keyframes pack-pop {
  0% { transform: scale(.6) rotate(-8deg); box-shadow: 0 0 0 0 var(--butter); }
  60% { transform: scale(1.06) rotate(2deg); box-shadow: 0 0 0 10px color-mix(in srgb, var(--butter) 45%, transparent); }
  100% { box-shadow: 0 0 0 0 transparent; }
}

/* locked packet */
.is-locked .sp-packet-art img { filter: grayscale(.85) brightness(0.1); opacity: .5; }
.sp-lock { position: absolute; z-index: 2; top: 6%; right: 6%; width: 30px; height: 30px; display: grid; place-items: center; border-radius: 50%; background: var(--berry); color: var(--sheet); box-shadow: 0 3px 0 var(--berry-deep); }
.is-locked:hover .sp-lock { animation: lock-shake .5s ease; }
@keyframes lock-shake { 20% { transform: rotate(-14deg); } 40% { transform: rotate(12deg); } 60% { transform: rotate(-8deg); } 80% { transform: rotate(5deg); } }
</style>