<script setup>
import { computed } from 'vue'
import { plantSpriteUrl } from '@/lib/plantSprites'
import { usePlantGrowth } from '@/composables/usePlantGrowth'
import PlantSparkle from './PlantSparkle.vue'

const props = defineProps({
  stage: Number,
  flower: String,
  color: String,
  wilting: Boolean,
  ghost: Boolean,
  blocked: Boolean,
  alert: Boolean,
  planting: Boolean,
  growth: Object, // a stage-up waiting to be played: { from, to, phase } (garden store)
})
const emit = defineEmits(['grown', 'planted'])

// A plant with a pending stage-up keeps its old look until the garden releases it, then plays the celebration
const { shownStage, growing, reviving, transitionName, tier, fx, burstDone } = usePlantGrowth(props, emit)
const src = computed(() => props.ghost ? plantSpriteUrl(1) : plantSpriteUrl(shownStage.value, props.flower, props.color))
</script>

<template>
  <div
    class="plant"
    :class="{ ghost, blocked, 'is-growing': growing }"
    :data-stage="ghost ? undefined : shownStage"
    :data-wilting="wilting || undefined"
    data-testid="plant"
  >
    <div class="sprite" :class="{ 'is-squashing': fx.squash, 'is-drinking': fx.drink }">
      <Transition :name="transitionName">
        <img :key="src" class="art" :class="ghost ? '' : `st-${shownStage}`" :src="src" alt="" draggable="false" />
      </Transition>
    </div>
    <!-- effects live beside the sprite, not in it, so they don't sway with the plant -->
    <div v-if="growing || planting" class="fx">
      <PlantSparkle v-if="fx.water" watering :burst="false" />
      <PlantSparkle
        v-if="planting"
        tier="small"
        :color="color"
        @done="emit('planted')"
        style="transform: translateY(30px);"
      />
      <PlantSparkle v-else-if="growing && fx.burst" :tier="tier" :color="color" :flash="reviving" @done="burstDone" />
    </div>
    <span v-if="alert && !ghost && !growing" class="alert-mark" title="Revise this soon" data-testid="plant-alert"><img src="../assets/ui/droplet.svg" alt=""></span>
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
.is-highlighted .art { filter: brightness(1.05) drop-shadow(0 0 8px var(--butter-soft)) drop-shadow(0 0 20px var(--butter-deep)); }
/* ---- stage change: the new picture fades + springs in ON TOP of the old one, then the old one is removed.
        (old stays opaque until the new one has arrived, so you never see two stems at half opacity) ---- */
.stage-enter-active { transition: opacity .5s ease, transform .7s cubic-bezier(.34, 1.56, .64, 1); }
.stage-enter-from { opacity: 0; transform: scale(.8); }
.stage-leave-active { transition: opacity .01s .55s; }
.stage-leave-to { opacity: 0; }
/* wilting stages slump into place instead of popping */
.stage-enter-from.st-5, .stage-enter-from.st-6, .stage-enter-from.st-7 { transform: rotate(-4deg) scale(.97); }

/* ---- celebrated stage-up (after a review; beats are timed in composables/usePlantGrowth.js) ---- */
.plant.is-growing { z-index: 5000 !important; } /* above plants in front, so the effects aren't covered */
.fx { position: absolute; left: -85px; bottom: 0; width: 170px; height: 170px; pointer-events: none; }

/* One motion language for every celebration: pivot on the pot, squash and stretch, then the same jelly settle
   (.98 -> 1.01 -> 1 at 75% / 90%). Only the entrance differs. */

/* GROWTH: the new stage rises out of the pot, bottom first; the old one is removed once it is covered */
.grow-enter-active { animation: grow-in 1.25s both; }
@keyframes grow-in {
  0%   { clip-path: inset(100% -60px -60px -60px); transform: scale(.9, .55); animation-timing-function: cubic-bezier(.22, 1, .36, 1); }
  55%  { clip-path: inset(-60px); transform: scale(1.04, 1.08); animation-timing-function: ease-in-out; }
  75%  { clip-path: inset(-60px); transform: scale(.98, .97); animation-timing-function: ease-in-out; }
  90%  { clip-path: inset(-60px); transform: scale(1.01); animation-timing-function: ease-in-out; }
  100% { clip-path: inset(-60px); transform: scale(1); }
}
.grow-leave-active { transition: opacity .01s .7s; }
.grow-leave-to { opacity: 0; }

/* the plant crouches before it grows */
.sprite.is-squashing .art { animation: squash .15s ease-in forwards; }
@keyframes squash { to { transform: scale(1.07, .9); } }

/* revival */
.sprite.is-drinking .art { filter: saturate(1.35) brightness(1.05); transition: filter .7s ease; }
.perk-leave-active { animation: perk-out .45s ease-in both; }
@keyframes perk-out {
  from { filter: saturate(1.35) brightness(1.05); }
  to   { filter: saturate(1.35) brightness(1.05); transform: scale(.92, .75); opacity: 0; }
}
.perk-enter-active { animation: perk-in 1.2s both; }
@keyframes perk-in {
  0%   { opacity: 0; transform: scale(.55, .15); animation-timing-function: cubic-bezier(.22, 1, .36, 1); }
  18%  { opacity: 1; }
  55%  { opacity: 1; transform: scale(1.04, 1.08); animation-timing-function: ease-in-out; }
  75%  { transform: scale(.98, .97); animation-timing-function: ease-in-out; }
  90%  { transform: scale(1.01); animation-timing-function: ease-in-out; }
  100% { opacity: 1; transform: scale(1); }
}
@media (prefers-reduced-motion: reduce) {
  .stage-enter-active, .stage-leave-active, .grow-leave-active, .sprite { transition-duration: .01s; transition-delay: 0s; }
  .grow-enter-active, .perk-enter-active, .perk-leave-active, .sprite.is-squashing .art { animation: none; }
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