<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { seeded } from '@/lib/floorLayout'

// Butterflies, fireflies and (optionally) falling petals drifting over the garden stage.
// They float in screen space, they don't roll with the hills. theme.css already styles .scenery .bfly / .flies / .petal
// and shows or hides them per data-mood (butterflies fade out at night; fireflies glow at dusk and night),
// so this component only supplies the markup and positions.
//   mood = 'morning' | 'day' | 'dusk' | 'night' (the same mood the meadow palette shows)
const props = defineProps({
  mood: { type: String, default: 'day' },
  butterflies: { type: Number, default: 3 },
  fireflies: { type: Number, default: 34 },   // phones get about half
  petals: { type: Number, default: 0 },
})

// wing colours as theme variables: [light, deep]
const WINGS = [
  ['color-mix(in srgb, var(--berry) 55%, #fff)', 'var(--berry)'],
  ['var(--butter)', 'var(--butter-deep)'],
  ['var(--lilac)', 'color-mix(in srgb, var(--lilac) 65%, var(--ink))'],
]

const phone = matchMedia('(max-width: 599px)')
const compact = ref(phone.matches)
const syncCompact = () => { compact.value = phone.matches }
onMounted(() => phone.addEventListener('change', syncCompact))
onBeforeUnmount(() => phone.removeEventListener('change', syncCompact))

// one seeded pass, so positions are the same every visit
const scene = computed(() => {
  const r = seeded(106)
  const butterflies = Array.from({ length: props.butterflies }, (_, i) => {
    const duration = 16 + r() * 12
    return {
      id: i, light: WINGS[i % WINGS.length][0], deep: WINGS[i % WINGS.length][1],
      style: { left: `${8 + r() * 60}%`, top: `${30 + r() * 38}%`, animationDuration: `${duration}s`, animationDelay: `${-r() * 20}s` },
    }
  })
  const fireflies = Array.from({ length: props.fireflies }, (_, i) => ({
    id: i,
    style: {
      left: `${r() * 100}%`, top: `${20 + r() * 76}%`,   // over the field, below the horizon
      '--x1': `${(r() - 0.5) * 120}px`, '--y1': `${(r() - 0.5) * 90}px`,
      '--x2': `${(r() - 0.5) * 160}px`, '--y2': `${(r() - 0.5) * 120}px`,
      '--d': `${7 + r() * 8}s`,
      animationDelay: `${-r() * 10}s, ${-r() * 2}s`,
    },
  }))
  const petals = Array.from({ length: props.petals }, (_, i) => {
    const duration = 10 + r() * 12
    return {
      id: i,
      style: {
        left: `${r() * 110}%`, '--drift': `${-10 - r() * 25}vw`,
        animationDuration: `${duration}s`, animationDelay: `${-r() * duration}s`,
        ...(r() < 0.4 ? { background: 'var(--butter-soft)' } : {}),
      },
    }
  })
  return { butterflies, fireflies, petals }
})

const visibleFireflies = computed(() => {
  const all = scene.value.fireflies
  return compact.value ? all.slice(0, Math.round(all.length * 0.53)) : all
})
</script>

<template>
  <div class="scenery critters" :data-mood="mood" aria-hidden="true" data-testid="critters">
    <div v-for="b in scene.butterflies" :key="`b${b.id}`" class="bfly" :style="b.style">
      <svg viewBox="-13 -11 26 22">
        <g class="wing">
          <path d="M0 0C-4-10-14-12-12-3-11 3-4 3 0 0Z" stroke-width="1" :style="{ fill: b.light, stroke: b.deep }" />
          <path d="M0 0C-3 6-10 10-10 5-10 2-5 1 0 0Z" :style="{ fill: b.deep }" />
          <path d="M0 0C4-10 14-12 12-3 11 3 4 3 0 0Z" stroke-width="1" :style="{ fill: b.light, stroke: b.deep }" />
          <path d="M0 0C3 6 10 10 10 5 10 2 5 1 0 0Z" :style="{ fill: b.deep }" />
        </g>
        <rect x="-1" y="-6" width="2" height="11" rx="1" style="fill: var(--ink)" />
      </svg>
    </div>

    <div class="flies">
      <i v-for="f in visibleFireflies" :key="`f${f.id}`" :style="f.style"></i>
    </div>

    <i v-for="p in scene.petals" :key="`p${p.id}`" class="petal" :style="p.style"></i>
  </div>
</template>

<style scoped>
/* theme.css gives .scenery position: fixed, z-index: -1 and a sky gradient: this turns it into a clear overlay on the stage.
   z-index sits above the plants (<= 2000) and below the name bubbles (10000) and the drag ghost (9000). */
.critters.scenery { position: absolute; z-index: 2500; background: none; }

/* nothing to see, so nothing to animate (same trick Skybox uses for dry rain) */
.critters:not([data-mood='dusk'], [data-mood='night']) .flies i { animation-play-state: paused; }
.critters[data-mood='night'] .bfly,
.critters[data-mood='night'] .bfly .wing { animation-play-state: paused; }

@media (prefers-reduced-motion: reduce) {
  .critters .bfly, .critters .bfly .wing, .critters .flies i, .critters .petal { animation: none; }
  .critters .petal { display: none; }
}
</style>