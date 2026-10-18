<script setup>
defineProps({ stage: Number, wilting: Boolean, ghost: Boolean, blocked: Boolean })
const sprite = s => new URL(`../assets/foliage/stages/plant-stage-${s}.svg`, import.meta.url).href
const ghostSprite = new URL('../assets/foliage/tulip.svg', import.meta.url).href
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
    <img class="sprite" :src="ghost ? ghostSprite : sprite(stage)" alt="" draggable="false" />
  </div>
</template>

<style scoped>
.plant {
  position: absolute; left: 0; top: 0; width: 0; height: 0; display: none; will-change: transform;
  clip-path: inset(-1000px -1000px var(--clipped, 0px) -1000px);
}
.plant::before {
  position: absolute; bottom: -40px; left: -130px; width: 300px; height: 300px;
  content: ''; cursor: pointer; pointer-events: auto;
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
  position: absolute; left: calc(var(--sprite-size) / -2); bottom: 0; width: var(--sprite-size); height: var(--sprite-size);
  transform-origin: 50% 100%; cursor: pointer; transition: filter .3s, transform .3s;
  animation: plantSway 4s ease-in-out infinite;
}
:global(.is-scrolling) .sprite { animation-play-state: paused; }
.shadow {
  position: absolute; left: calc(var(--sprite-size) / -4.5); bottom: -6px;
  width: calc(var(--sprite-size) / 2.2); height: calc(var(--sprite-size) / 8); border-radius: 50%; background: var(--shadow);
}
.plant[data-stage="2"][data-wilting] .sprite { filter: sepia(.8) saturate(.7); }
.ghost { pointer-events: none; z-index: 9000 !important; }
.ghost::before { pointer-events: none; }
.ghost .sprite { opacity: .6; }
.ghost.blocked .sprite { filter: grayscale(1) sepia(1) hue-rotate(-40deg) saturate(4); }
</style>
