<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { mountScenery } from '@/lib/scenery'

// The illustrated meadow behind a page (or a section when `page` is false).
// mood: 'day' | 'morning' | 'blush' | 'dusk' | 'night'; changing it crossfades the sky.
// options: drawing options (seed, horizon, tulips, butterflies, petals, clouds, sunX, sunY, veil, clearCenter)
const props = defineProps({
  mood: { type: String, default: 'day' },
  options: { type: Object, default: () => ({}) },
  page: { type: Boolean, default: true },
})
const el = ref(null)
let scene = null

onMounted(() => {
  scene = mountScenery(el.value, { ...props.options, mood: props.mood, page: props.page })
})
watch(() => props.mood, (m) => scene?.setMood(m))
onBeforeUnmount(() => scene?.destroy())
</script>

<template>
  <div ref="el" class="scenery" :class="{ 'scenery-section': !page }" aria-hidden="true"></div>
</template>

<style>
.scenery.scenery-section { position: absolute; z-index: 0; }
</style>
