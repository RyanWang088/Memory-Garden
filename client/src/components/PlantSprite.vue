<script setup>
// alert: one of the top 6 seeds to revise next (worked out by the server), shown as a "!" above the plant
defineProps({ stage: Number, flower: String, wilting: Boolean, alert: Boolean, ghost: Boolean, blocked: Boolean })
const sprites = import.meta.glob('../assets/foliage/*.svg', { eager: true, query: '?url', import: 'default' })
const sprite = (stage, flower) => {
  const name = stage === 1 ? 'seed' : stage === 2 ? 'sprout' : `${flower || 'tulip'}-${stage}`
  return sprites[`../assets/foliage/${name}.svg`]
}
const ghostSprite = sprites['../assets/foliage/seed.svg']
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
    <img class="sprite" :src="ghost ? ghostSprite : sprite(stage, flower || 'tulip')" alt="" draggable="false" />
    <span v-if="alert && !ghost" class="alert-mark" title="Revise this soon" data-testid="plant-alert">!</span>
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
  0% {
    transform: rotate(0deg);
  }
  25% {
    transform: rotate(3deg);
  }
  75% {
    transform: rotate(-3deg);
  }
  100% {
    transform: rotate(0deg);
  }
}
.sprite {
  position: absolute; left: -75px; bottom: 0; width: 150px; height: 150px;
  transform-origin: 50% 100%; cursor: pointer; transition: filter .3s, transform .3s;
  animation: plantSway 4s ease-in-out infinite;
}
:global(.is-scrolling) .sprite { animation-play-state: paused; }
.shadow {
  position: absolute; left: -33.33px; bottom: -6px;
  width: 68.18px; height: 18.75px; border-radius: 50%; background: var(--shadow);
}
.plant[data-stage="2"][data-wilting] .sprite { filter: sepia(.8) saturate(.7); }
.plant[data-stage="3"][data-wilting] .sprite { filter: sepia(.5) saturate(1.6) hue-rotate(-25deg) brightness(1.08); }
/* "!" bubble, sitting just above the top of each stage's sprite */
.alert-mark {
  position: absolute; left: -13px; bottom: 150px; width: 26px; height: 26px; border-radius: 50%;
  display: grid; place-items: center; pointer-events: none;
  background: var(--berry); color: var(--paper); border: 2px solid var(--paper); box-shadow: 0 2px 4px var(--shadow-card);
  font-weight: 800; font-size: 16px; line-height: 1;
  animation: alertBob 1.6s ease-in-out infinite;
}
.plant[data-stage="1"] .alert-mark { bottom: 40px; }
.plant[data-stage="2"] .alert-mark { bottom: 65px; }
.plant[data-stage="3"] .alert-mark { bottom: 105px; }
@keyframes alertBob {
  50% { transform: translateY(-4px); }
}
:global(.is-scrolling) .alert-mark { animation-play-state: paused; }
.ghost { pointer-events: none; z-index: 9000 !important; }
.ghost::before { pointer-events: none; }
.ghost .sprite { opacity: .6; }
.ghost.blocked .sprite { filter: grayscale(1) sepia(1) hue-rotate(-40deg) saturate(4); }
</style>
