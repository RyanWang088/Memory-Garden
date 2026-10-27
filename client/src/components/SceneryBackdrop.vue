<script setup>
import SkyLayer from './SkyLayer.vue'
import DrawnLand from './DrawnLand.vue'
import SceneCritters from './SceneCritters.vue'

// The illustrated meadow behind a static page (or a section when `page` is false), at a fixed mood.
// mood: 'day' | 'morning' | 'blush' | 'dusk' | 'night'; changing it crossfades.
// options, passed to the layer that owns each:
//   sky       sunX, sunY, clouds, seed
//   land      seed, horizon, flowers, tulips, clearCenter
//   critters  butterflies, petals
//   overlay   veil (any CSS background, laid over everything)
defineProps({
  mood: { type: String, default: 'day' },
  options: { type: Object, default: () => ({}) },
  page: { type: Boolean, default: true },
})
</script>

<template>
  <SkyLayer
    :mood="mood" :page="page" :seed="options.seed" :clouds="options.clouds"
    :sun="{ x: options.sunX ?? 78, y: options.sunY ?? 14 }"
  >
    <DrawnLand :options="options" />
    <SceneCritters :mood="mood" :seed="options.seed" :butterflies="options.butterflies" :petals="options.petals" />
    <div v-if="options.veil" class="veil" :style="{ background: options.veil }"></div>
  </SkyLayer>
</template>