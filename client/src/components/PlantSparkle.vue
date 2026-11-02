<script setup>
import { computed, ref, onMounted } from 'vue'

// Plant effects: celebratory bursts or watering drops. Mount an effect to play it.
// The overlay fills the plant's 170px sprite box, so it scales with the plant.
const props = defineProps({
  tier: { type: String, default: 'small' }, // 'small' | 'medium' | 'bloom'
  color: String,                            // plant colour: pink | red | purple | yellow
  flash: Boolean,                           // always show the glow (a revival needs it to hide the sprite swap)
  watering: Boolean,
  burst: { type: Boolean, default: true },
})
const emit = defineEmits(['done'])

const DROPS = [
  { left: '40%', delay: '0ms' },
  { left: '56%', delay: '120ms' },
  { left: '48%', delay: '230ms' },
  { left: '62%', delay: '340ms' },
]

// What each tier throws. `lift` is where the burst starts, as % of the sprite height (taller plant, higher burst).
const TIERS = {
  small:  { lift: 30, sparkles: 6,  petals: 0,  glow: false, rays: false },
  medium: { lift: 45, sparkles: 10, petals: 8,  glow: true,  rays: false },
  bloom:  { lift: 60, sparkles: 16, petals: 18, glow: true,  rays: true },
}
const PETAL_COLORS = { pink: '#f28daa', red: '#e0546a', purple: '#9b7bd9', yellow: '#f2b84b' }

const config = computed(() => TIERS[props.tier] ?? TIERS.small)
const showGlow = computed(() => props.flash || config.value.glow)
const petalColor = computed(() => PETAL_COLORS[props.color] ?? PETAL_COLORS.pink)

const rand = (min, max) => min + Math.random() * (max - min)

// `count` particles fanned evenly around the origin, each with its own reach, size and start delay
function fan(count, { reach, size, delay }) {
  return Array.from({ length: count }, (_, i) => {
    const angle = ((360 / count) * i + rand(-12, 12)) * (Math.PI / 180)
    const distance = rand(...reach)
    return {
      '--x': `${Math.cos(angle) * distance}px`,
      '--y': `${Math.sin(angle) * distance}px`,
      '--size': `${rand(...size)}px`,
      '--delay': `${rand(...delay)}ms`,
      '--spin': `${rand(120, 300)}deg`,
    }
  })
}
const stars = computed(() => fan(config.value.sparkles, { reach: [45, 90], size: [18, 30], delay: [0, 250] }))
const petals = computed(() => fan(config.value.petals, { reach: [55, 110], size: [15, 25], delay: [0, 350] }))

// The burst is over when every particle's animation has ended (each child has exactly one), so retiming the CSS
// can't cut it short.
const burstRoot = ref(null)
let running = 0
onMounted(() => { running = burstRoot.value?.children.length ?? 0 })
const onAnimationEnd = () => { if (--running <= 0) emit('done') }
</script>

<template>
  <div class="effects" aria-hidden="true">
    <div v-if="watering" class="water">
      <i v-for="drop in DROPS" :key="drop.left" class="drop" :style="{ left: drop.left, '--delay': drop.delay }"></i>
      <span class="ripple"></span>
    </div>
    <div
      v-if="burst"
      ref="burstRoot"
      class="sparkle"
      @animationend="onAnimationEnd"
      :style="{ '--lift': `${config.lift}%`, '--petal': petalColor }"
    >
      <span v-if="config.rays" class="rays"></span>
      <span v-if="showGlow" class="glow"></span>
      <i v-for="(star, i) in stars" :key="`star-${i}`" class="star" :style="star"></i>
      <i v-for="(petal, i) in petals" :key="`petal-${i}`" class="petal" :style="petal"></i>
    </div>
  </div>
</template>

<style scoped>
.effects { position: absolute; inset: 0; pointer-events: none; }
.sparkle { position: absolute; left: 50%; bottom: var(--lift); width: 0; height: 0; pointer-events: none; }

.star, .petal {
  position: absolute; left: calc(var(--size) / -2); top: calc(var(--size) / -2);
  width: var(--size); height: var(--size);
}
.star {
  background: var(--butter);
  clip-path: polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%);
  animation: twinkle .9s ease-out var(--delay) both;
}
.petal {
  background: var(--petal); border-radius: 100% 0 100% 0;
  animation: petal 3s cubic-bezier(.2, .7, .3, 1) var(--delay) both;
}

.glow, .rays { position: absolute; border-radius: 50%; }
.glow {
  left: -90px; top: -90px; width: 180px; height: 180px;
  background: radial-gradient(circle, color-mix(in srgb, var(--butter-soft) 70%, transparent), transparent 68%);
  animation: glow 1.3s ease-out both;
}
.rays {
  left: -150px; top: -150px; width: 300px; height: 300px;
  background: repeating-conic-gradient(
    color-mix(in srgb, var(--butter-soft) 85%, transparent) 0 22deg, transparent 22deg 60deg);
  mask-image: radial-gradient(circle, #000 25%, transparent 72%);
  z-index: -1;
  animation: rays 3.2s ease-in-out both;
}
@keyframes rays {
  0%   { rotate: 0deg; scale: .5; opacity: 0; }
  25%  { opacity: .45; scale: 1; }
  80%  { opacity: .45; }
  100% { rotate: 120deg; scale: 1.1; opacity: 0; }
}
@keyframes twinkle {
  0%   { translate: 0 0; scale: 0; }
  40%  { translate: var(--x) var(--y); scale: 1; }
  100% { translate: calc(var(--x) * 1.2) calc(var(--y) * 1.2); scale: 0; rotate: 90deg; }
}
@keyframes petal {
  0%   { translate: 0 0; scale: .3; opacity: 0; }
  15%  { opacity: 1; }
  50%  { translate: var(--x) var(--y); scale: 1; }
  100% { translate: calc(var(--x) * 1.15) calc(var(--y) + 80px); scale: .9; rotate: var(--spin); opacity: 0; }
}
@keyframes glow {
  0%   { scale: .4; opacity: 0; }
  30%  { opacity: .65; }
  100% { scale: 1.3; opacity: 0; }
}

.water { position: absolute; inset: 0; }
.drop {
  position: absolute; top: 0; width: 9px; height: 13px;
  border-radius: 50% 50% 50% 50% / 70% 70% 30% 30%;
  background: #8fcbea;
  animation: fall .55s cubic-bezier(.5, 0, 1, .6) var(--delay) both;
}
@keyframes fall {
  0%   { translate: 0 -30px; opacity: 0; }
  15%  { opacity: 1; }
  85%  { opacity: 1; }
  100% { translate: 0 148px; opacity: 0; scale: .6 1.3; }
}
.ripple {
  position: absolute; left: 50%; bottom: 4%; width: 84px; height: 24px; translate: -50% 0;
  border: 2px solid var(--water, #7cc6e8); border-radius: 50%;
  animation: ripple .9s ease-out .55s both;
}
@keyframes ripple {
  0%   { scale: .2; opacity: .9; }
  100% { scale: 1.5; opacity: 0; }
}
</style>