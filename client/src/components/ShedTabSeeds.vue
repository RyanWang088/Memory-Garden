<script setup>
import { onMounted, ref } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useFlowerStore } from '@/stores/flower'
import { useToastStore } from '@/stores/toast'
import { tagStyle } from '@/lib/tagColors'
import { SEED_COLORS } from '@/lib/tagColors'
import { plantSpriteUrl, BLOOM_STAGE } from '@/lib/plantSprites'
import coinSvg from '@/assets/ui/coin.svg'

const ui = useUiStore()
const flower = useFlowerStore()
const toast = useToastStore()
const pickedSeedId = ref(null)

const flowerImage = (seed) => plantSpriteUrl(BLOOM_STAGE, seed.id)

// 1x1 transparent pixel: replaces the browser's own drag picture, so only the garden's ghost shows.
const blankDragImage = new Image()
blankDragImage.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

function onDragStart(e, seed) {
  pickedSeedId.value = seed.id
  if (e.dataTransfer) {
    e.dataTransfer.setData('application/x-sproutly-seed', JSON.stringify({ flower: seed.id }))
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setDragImage(blankDragImage, 0, 0)
  } else {
    ui.seedDragPointerId = e.pointerId
  }
  ui.seedPicked = true
  ui.shedOpen = false
}

function onDragEnd() {
  ui.seedPicked = false
  ui.seedDragPointerId = null
  pickedSeedId.value = null
}

function onPointerDown(e, seed) {
  if (e.pointerType === 'touch') {
    e.preventDefault()
    onDragStart(e, seed)
  }
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
}

onMounted(() => flower.load())
</script>

<template>
  <section class="product" data-testid="shed-seeds">
    <header class="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
      <h3 class="m-0">Plant a new seed</h3>
      <p class="text-body-small m-0">
        Drag a plant to the field to create a new deck of flashcards
      </p>
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

    <div v-if="flower.flowers.length" class="row row-cols-2 g-3">
      <div v-for="seed in flower.flowers" :key="seed.id" class="col">
        <button
          v-if="seed.status === 'owned'"
          type="button"
          class="product-card packet d-flex flex-column align-items-center gap-2 p-2"
          :class="{ 'is-picked': ui.seedPicked && pickedSeedId === seed.id }"
          :aria-pressed="ui.seedPicked && pickedSeedId === seed.id"
          :data-testid="`seed-${seed.id}`"
          draggable="true"
          @dragstart="onDragStart($event, seed)"
          @dragend="onDragEnd"
          @pointerdown="onPointerDown($event, seed)"
        >
          <span class="product-art d-flex justify-content-center align-items-center">
            <img class="packet-art" :src="flowerImage(seed)" alt="" draggable="false" />
          </span>
          <span class="text-label-field product-name">{{ seed.name }} seed</span>
          <span class="tag-pill" :style="tagStyle('mint')">
            {{ seed.price === 0 ? 'Free' : 'Owned' }}
          </span>
          <div
          v-if="seed.status === 'owned'"
          class="swatches d-flex flex-wrap justify-content-center gap-2 mt-1"
          role="group"
          aria-label="Choose plant color"
        >
          <button
            v-for="color in SEED_COLORS"
            :key="color"
            type="button"
            class="swatch"
            :class="[`swatch--${color}`, { active: ui.selectedSeedColor === color }]"
            :aria-pressed="ui.selectedSeedColor === color"
            :aria-label="`${color} plant color`"
            :title="color"
            @click="ui.selectedSeedColor = color"
          ></button>
        </div>

        </button>

        <article v-else class="product-card d-flex flex-column align-items-center gap-2 p-2">
          <div class="product-art product-locked d-flex justify-content-center align-items-center">
            <img class="packet-art" :src="flowerImage(seed)" :alt="seed.name" draggable="false" />
            <span class="position-absolute text-display" aria-hidden="true">🔒</span>
          </div>
          <span class="text-label-field product-name">{{ seed.name }} seed</span>
          <button
            class="btn btn-secondary text-button"
            type="button"
            :disabled="flower.buying !== null"
            :aria-label="`Buy ${seed.name} for ${seed.price} coins`"
            :data-testid="`buy-${seed.id}`"
            @click="buy(seed)"
          >
            <img src="../assets/ui/coin.svg" width="30px">{{ flower.buying === seed.id ? 'Buying…' : seed.price }}
          </button>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* petal colour picker: round swatches instead of text buttons (same ui.selectedSeedColor) */
.swatch {
  width: 22px; height: 22px; padding: 0;
  border: 2px solid var(--paper); border-radius: 50%;
  box-shadow: 0 0 0 2px var(--linen);
  cursor: pointer;
  transition: transform .2s var(--spring), box-shadow .15s;
}
.swatch:hover { transform: scale(1.15); }
.swatch.active { box-shadow: 0 0 0 3px var(--bark); transform: scale(1.12); }
.swatch:focus-visible { outline: 3px solid var(--periwinkle); outline-offset: 2px; }
/* petal colours sampled from the flower art */
.swatch--red { background: #E8566C; }
.swatch--white { background: #FFFFFF; box-shadow: 0 0 0 2px var(--linen), inset 0 0 0 1px var(--linen); }
.swatch--white.active { box-shadow: 0 0 0 3px var(--bark); }
.swatch--purple { background: #A58BE8; }
.swatch--yellow { background: var(--butter); }
.swatch--pink { background: #F7A3C0; }

.packet { cursor: grab; }
.packet:hover .packet-art { animation: wiggle .6s ease-in-out; }
@keyframes wiggle { 30% { transform: rotate(-5deg); } 60% { transform: rotate(4deg); } }
</style>
