<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { seeded } from '@/lib/shuffle.js'

// Butterflies, fireflies and (optionally) falling petals, used by every scene. They float in screen space.
// theme.css styles .critters .bfly / .flies / .petal and shows or hides them per mood (butterflies fade out at night,
// fireflies glow at dusk and night), so this only supplies markup and positions.
//   mood      the mood this scene shows
//   weather   optional; butterflies stay in when it rains
//   fliesFrom where fireflies start, % from the top (the horizon is lower on a page than on the garden stage)
const props = defineProps({
  mood: { type: String, default: 'day' },
  weather: { type: String, default: undefined },
  seed: { type: Number, default: 7 },
  butterflies: { type: Number, default: 3 },
  fireflies: { type: Number, default: 34 },   // phones get about half
  petals: { type: Number, default: 0 },
  fliesFrom: { type: Number, default: 40 },
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
  const r = seeded(props.seed + 7)
  const butterflies = Array.from({ length: props.butterflies }, (_, i) => ({
    light: WINGS[i % WINGS.length][0], deep: WINGS[i % WINGS.length][1],
    style: { left: `${8 + r() * 60}%`, top: `${30 + r() * 35}%`, animationDuration: `${16 + r() * 12}s`, animationDelay: `${-r() * 20}s` },
  }))
  const fireflies = Array.from({ length: props.fireflies }, () => ({
    left: `${r() * 100}%`, top: `${props.fliesFrom + r() * (96 - props.fliesFrom)}%`,
    '--x1': `${(r() - 0.5) * 120}px`, '--y1': `${(r() - 0.5) * 90}px`,
    '--x2': `${(r() - 0.5) * 160}px`, '--y2': `${(r() - 0.5) * 120}px`,
    '--d': `${7 + r() * 8}s`,
    animationDelay: `${-r() * 10}s, ${-r() * 2}s`,
  }))
  const petals = Array.from({ length: props.petals }, () => {
    const duration = 10 + r() * 12
    return {
      left: `${r() * 110}%`, '--drift': `${-10 - r() * 25}vw`, animationDuration: `${duration}s`, animationDelay: `${-r() * duration}s`,
      ...(r() < 0.4 ? { background: 'var(--butter-soft)' } : {}),
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
  <div class="critters" :data-mood="mood" :data-weather="weather" aria-hidden="true" data-testid="critters">
    <div v-for="(b, i) in scene.butterflies" :key="`b${i}`" class="bfly" :style="b.style">
      <svg viewBox="-13 -11 26 22" aria-hidden="true">
        <g class="wing" style="will-change: transform; transform-origin: center;">
          <path d="M0 0C-4-10-14-12-12-3c1 6 8 6 12 3ZM0 0c4-10 14-12 12-3-1 6-8 6-12 3Z" stroke-width="1"
            :style="{ fill: b.light, stroke: b.deep }" />
          <path d="M0 0C-3 6-10 10-10 5c0-3 5-4 10-5ZM0 0c3 6 10 10 10 5 0-3-5-4-10-5Z" :style="{ fill: b.deep }" />
          <rect x="-1" y="-6" width="2" height="11" rx="1" style="fill: var(--ink)" />
        </g>
      </svg>
    </div>

    <div class="flies">
      <i v-for="(f, i) in visibleFireflies" :key="`f${i}`" :style="f"></i>
    </div>

    <i v-for="(p, i) in scene.petals" :key="`p${i}`" class="petal" :style="p"></i>
  </div>
</template>

<style scoped>
/* nothing to see, so nothing to animate (same trick the rain uses when it is dry) */
.critters:not([data-mood='dusk'], [data-mood='night']) .flies i {
  animation-play-state: paused;
}

.critters[data-mood='night'] :is(.bfly, .bfly .wing),
.critters:is([data-weather='rainy'], [data-weather='stormy']) :is(.bfly, .bfly .wing) {
  animation-play-state: paused;
}

@media (prefers-reduced-motion: reduce) {

  .critters .bfly,
  .critters .bfly .wing,
  .critters .flies i,
  .critters .petal {
    animation: none;
  }

  .critters .petal {
    display: none;
  }
}
</style>