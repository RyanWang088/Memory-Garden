<script setup>
import { computed } from 'vue'
import { plantSpriteUrl } from '@/lib/plantSprites'

const props = defineProps({
  stage: Number,
  flower: String,
  color: String,
  wilting: Boolean,
  ghost: Boolean,
  blocked: Boolean,
  alert: Boolean,
})
const src = computed(() => props.ghost ? plantSpriteUrl(1) : plantSpriteUrl(props.stage, props.flower, props.color))
</script>

<template>
  <div
    class="plant"
    :class="{ ghost, blocked }"
    :data-stage="ghost ? undefined : stage"
    :data-wilting="wilting || undefined"
    data-testid="plant"
  >
    <div class="sprite">
      <Transition name="stage">
        <img :key="src" class="art" :class="ghost ? '' : `st-${stage}`" :src="src" alt="" draggable="false" />
      </Transition>
    </div>
    <span v-if="alert && !ghost" class="alert-mark" title="Revise this soon" data-testid="plant-alert"><img src="../assets/ui/droplet.svg" alt=""></span>
  </div>
</template>

<style scoped>
.plant {
  position: absolute; left: 0; top: 0; width: 0; height: 0; display: none; will-change: transform;
  filter: var(--mood-filter, none) var(--wx-filter, none); transition: filter 6s ease;   /* night and weather, from the stage's tokens */
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
.sprite{
  position: absolute; left: -85px; bottom: 0; width: 170px; height: 170px;
  transform-origin: 50% 96%; cursor: pointer;
  transition: filter .9s ease;                      /* the sprout browns gradually, not in a snap */
  animation: plantSway 4s ease-in-out infinite;
}
:global(.is-scrolling) .sprite { animation-play-state: paused; }

.art { position: absolute; inset: 0; width: 100%; height: 100%; display: block; transform-origin: 50% 96%; }
.is-highlighted .art { filter: brightness(1.2) drop-shadow(0 0 10px var(--butter-soft)) drop-shadow(0 0 20px var(--butter-deep)); }
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

.plant[data-stage="2"][data-wilting] .sprite,.plant[data-stage="3"][data-wilting] .sprite { 
  filter: sepia(.7) saturate(.75) brightness(.88); 
}

.alert-mark {
  position: absolute; 
  left: -25px; 
  bottom: 170px; 
  width: 50px; 
  height: 50px; 
  border-radius: 50%;
  animation: alertBob 1.6s ease-in-out infinite;
}
.plant[data-stage="1"] .alert-mark { 
  bottom: 40px; 
}
.plant[data-stage="2"] .alert-mark,
.plant[data-stage="8"] .alert-mark { 
  bottom: 65px; 
}
.plant[data-stage="3"] .alert-mark,
.plant[data-stage="7"] .alert-mark { 
  bottom: 95px; 
}
.plant[data-stage="6"] .alert-mark { 
  bottom: 80px; 
}
.plant[data-stage="5"] .alert-mark { 
  bottom: 130px; 
}
.plant[data-stage="4"] .alert-mark { 
  bottom: 170px; /* Full bloom height */
}
@keyframes alertBob {
  50% { transform: translateY(-4px); }
}
:global(.is-scrolling) .alert-mark { animation-play-state: paused; }
.ghost { pointer-events: none; z-index: 9000 !important; }
.ghost::before { pointer-events: none; }
.ghost .sprite { opacity: .6; }
.ghost.blocked .sprite { filter: grayscale(1) sepia(1) hue-rotate(-40deg) saturate(4); }
</style>