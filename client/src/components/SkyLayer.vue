<script setup>
import { computed, watchEffect, onBeforeUnmount } from 'vue'
import { seeded } from '@/lib/shuffle.js'

// The sky for every scene: gradient, stars, sun or moon, clouds. Colours come from the mood tokens in theme.css
// (graded by weather when `weather` is set). The default slot holds whatever stands in front of it.
//   mood    'day' | 'morning' | 'blush' | 'dusk' | 'night'; changing it crossfades
//   weather 'sunny' | 'cloudy' | 'rainy' | 'stormy'. Only the garden sets it; static pages get the plain mood
//   sun     { x, y }: centre of the sun or moon, in % of the sky
//   fade    crossfade length, e.g. '6s' (default 2.5s)
//   page    true: the full-page background. false: a section of the page
const props = defineProps({
  mood: { type: String, default: 'day' },
  weather: { type: String, default: undefined },
  sun: { type: Object, default: () => ({ x: 78, y: 14 }) },
  clouds: { type: Number, default: 5 },
  seed: { type: Number, default: 7 },
  fade: { type: String, default: undefined },
  page: { type: Boolean, default: true },
  label: { type: String, default: '' },
})

// one seeded pass, in the same order the old scenery.js used, so stars and clouds sit where they always did
const scene = computed(() => {
  const r = seeded(props.seed + 99)
  const stars = Array.from({ length: 70 }, () => {
    const style = { left: `${r() * 100}%`, top: `${r() * 100}%`, animationDelay: `${-r() * 3}s` }
    if (r() < 0.2) style.width = style.height = '3px'
    return style
  })
  const clouds = Array.from({ length: props.clouds }, () => {
    const w = 90 + r() * 140, top = 6 + r() * 30, dur = 90 + r() * 120
    return { width: `${w}px`, height: `${w * 0.3}px`, top: `${top}%`, left: '0', animationDuration: `${dur}s`, animationDelay: `${-r() * dur}s`, opacity: (0.55 + r() * 0.4).toFixed(2) }
  })
  return { stars, clouds }
})

// text drawn straight on the page sky switches to light ink at dusk and night (see body[data-sky] in theme.css)
watchEffect(() => { if (props.page) document.body.dataset.sky = props.mood })
onBeforeUnmount(() => { if (props.page) delete document.body.dataset.sky })
</script>

<template>
  <div
    class="scenery"
    :class="{ 'scenery-section': !page }"
    :data-mood="mood"
    :data-weather="weather"
    :style="fade && { '--fade': fade }"
    :role="label ? 'img' : undefined"
    :aria-label="label || undefined"
    :aria-hidden="label ? undefined : 'true'"
  >
    <div class="stars"><i v-for="(style, i) in scene.stars" :key="i" :style="style"></i></div>
    <div class="sun" :style="{ left: `${sun.x}%`, top: `${sun.y}%` }"></div>
    <div class="clouds"><div v-for="(style, i) in scene.clouds" :key="i" class="cloud" :style="style"></div></div>
    <slot />
  </div>
</template>

<style>
.scenery.scenery-section { position: absolute; z-index: 0; }
</style>