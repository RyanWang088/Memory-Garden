<script setup>
defineProps({ stage: Number, flower: String, wilting: Boolean, ghost: Boolean, blocked: Boolean })
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
.ghost { pointer-events: none; z-index: 9000 !important; }
.ghost::before { pointer-events: none; }
.ghost .sprite { opacity: .6; }
.ghost.blocked .sprite { filter: grayscale(1) sepia(1) hue-rotate(-40deg) saturate(4); }
</style>
