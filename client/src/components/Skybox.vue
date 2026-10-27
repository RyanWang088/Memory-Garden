<script setup>
import { storeToRefs } from 'pinia'
import { useWeatherStore } from '@/stores/weather'
import SkyLayer from './SkyLayer.vue'

// The garden's sky: the shared SkyLayer driven by the live weather, plus the weather effects.
// Colour is never layered on: SkyLayer grades its own tokens by weather, so there is no veil or tint here.
const { look, sun } = storeToRefs(useWeatherStore())
</script>

<template>
  <SkyLayer :mood="look.mood" :weather="look.weather" :sun="sun" fade="6s" data-testid="sky">
    <div class="lightning"></div>
  </SkyLayer>
  <Teleport to="#sky-front" defer>
    <div class="front">
      <div class="rain" :data-weather="look.weather">
        <i
          v-for="n in 40"
          :key="n"
          :class="{ extra: n > 24 }"
          :style="{ left: `${(n * 37) % 100}%`, animationDelay: `${(n % 7) * -0.2}s` }"
        ></i>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* lightning: invisible except a quick double flicker every 7s, only while stormy */
.lightning { position: absolute; inset: 0; background: var(--paper); opacity: 0; pointer-events: none; }
[data-weather='stormy'] .lightning { animation: flash 7s linear infinite; }
@keyframes flash {
  0%, 88%, 100% { opacity: 0; }
  89%           { opacity: .7; }
  90%           { opacity: .1; }
  92%           { opacity: .5; }
  95%           { opacity: 0; }
}

/* rain falls in front of the garden bed and spans the whole layer, so it also falls through the lower sky */
.front { position: absolute; inset: 0; overflow: hidden; }
.rain { position: absolute; inset: 0; opacity: 0; transition: opacity 3s ease; }
.rain[data-weather='rainy'], .rain[data-weather='stormy'] { opacity: 1; }
.rain i {
  position: absolute; top: -10%; width: 2px; height: 36px;
  background: #6EC1EE; opacity: .6;
  animation: fall .9s linear infinite;
}
.rain:not([data-weather='rainy'], [data-weather='stormy']) i { animation-play-state: paused; }  /* no cost when dry */
@keyframes fall { to { transform: translateY(110vh); } }

/* storm: 16 extra streaks, faster, slanted by wind. The layer is widened to the right
   so streaks blown left still cover the right edge; .front clips the overflow */
.rain:not([data-weather='stormy']) i.extra { display: none; }
.rain[data-weather='stormy'] { right: -30vh; }
.rain[data-weather='stormy'] i { animation-name: fall-wind; animation-duration: .6s; }
@keyframes fall-wind {
  from { transform: translate(0, 0) rotate(15deg); }
  to   { transform: translate(-30vh, 110vh) rotate(15deg); }  /* tan(15deg) * 110vh ~ 30vh, so the streak moves along its own slant */
}

@media (prefers-reduced-motion: reduce) {
  .rain i, .lightning { animation: none !important; }  /* flashing is also an accessibility risk */
}
</style>