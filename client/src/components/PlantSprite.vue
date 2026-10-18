<script setup>
import { computed } from 'vue'

const props = defineProps(['stage', 'flower', 'wilting', 'ghost', 'blocked','color'])

const sprites = import.meta.glob('../assets/foliage/*.svg', { eager: true, query: '?url', import: 'default' })
const url = name => sprites[`../assets/foliage/${name}.svg`]

// shared by every plant type: 1 seed, 2 sprout, 8 stub.  Per flower: 3-7 (tulip-4, tulip-yellow-4 ...)
const SHARED = { 1: 'seed', 2: 'sprout', 8: 'stub' }
const spriteName = (stage, flower,color) => SHARED[stage] ?? `${flower}-${color}-${stage}`

const src = computed(() =>
  props.ghost
    ? url('seed')
    : url(spriteName(props.stage, props.flower,props.color)) ?? url(spriteName(props.stage, 'tulip')) // missing art -> tulip, never a broken image
)
</script>

<template>
  <div
    class="plant"
    :class="{ ghost, blocked }"
    :data-stage="ghost ? undefined : stage"
    :data-wilting="wilting || undefined"
    data-testid="plant"
  >
    <div class="shadow"></div>
    <!-- .sprite never changes: it owns the sway, the click target and the stage-2 browning.
         Only the <img> inside is swapped, and <Transition> animates old -> new. -->
    <div class="sprite">
      <Transition name="stage">
        <img :key="src" class="art" :class="ghost ? '' : `st-${stage}`" :src="src" alt="" draggable="false" />
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.plant {
  position: absolute; left: 0; top: 0; width: 0; height: 0; display: none; will-change: transform;
  clip-path: inset(-1000px -1000px var(--clipped, 0px) -1000px);
}
.plant::before {
  position: absolute; bottom: -40px; left: -130px; width: 300px; height: 300px;
}
@keyframes plantSway {
  0% { transform: rotate(0deg); }
  25% { transform: rotate(3deg); }
  75% { transform: rotate(-3deg); }
  100% { transform: rotate(0deg); }
}
.sprite {
  position: absolute; left: -75px; bottom: 0; width: 150px; height: 150px;
  transform-origin: 50% 96%; cursor: pointer;
  transition: filter .9s ease;                      /* the sprout browns gradually, not in a snap */
  animation: plantSway 4s ease-in-out infinite;
}
:global(.is-scrolling) .sprite { animation-play-state: paused; }

.art { position: absolute; inset: 0; width: 100%; height: 100%; display: block; transform-origin: 50% 96%; }
/* CHANGE ANIMATION LTR TO ADD TIME DELAY PLUS SPARKLE SAME SPARKLE WILL ALSO TRIGGER UPON SEED PLANT */
/* ---- stage change: the new picture fades + springs in ON TOP of the old one, then the old one is removed.
        (old stays opaque until the new one has arrived, so you never see two stems at half opacity) ---- */
.stage-enter-active { transition: opacity .5s ease, transform .7s cubic-bezier(.34, 1.56, .64, 1); }
.stage-enter-from { opacity: 0; transform: scale(.8); }
.stage-leave-active { transition: opacity .01s .55s; }
.stage-leave-to { opacity: 0; }
/* wilting stages slump into place instead of popping */
.stage-enter-from.st-5, .stage-enter-from.st-6, .stage-enter-from.st-7 { transform: rotate(-4deg) scale(.97); }

@media (prefers-reduced-motion: reduce) {
  .stage-enter-active, .stage-leave-active, .sprite { transition-duration: .01s; transition-delay: 0s; }
}

.shadow {
  position: absolute; left: -33.33px; bottom: -6px;
  width: 68.18px; height: 18.75px; border-radius: 50%; background: var(--shadow);
}

/* a wilting sprout never moves to a new stage: it just turns brown. Tune the filter to taste. */
.plant[data-stage="2"][data-wilting] .sprite { filter: sepia(1) saturate(.75) brightness(.88); }

.ghost { pointer-events: none; z-index: 9000 !important; }
.ghost::before { pointer-events: none; }
.ghost .sprite { opacity: .6; }
.ghost.blocked .sprite { filter: grayscale(1) sepia(1) hue-rotate(-40deg) saturate(4); }
</style>