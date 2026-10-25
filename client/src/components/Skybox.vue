<script setup>
import { ref, onMounted, nextTick, watchEffect, onBeforeUnmount } from 'vue'
import { useSky } from '@/composables/useSky'
import { useWeatherStore } from '@/stores/weather'
const weather = useWeatherStore()
const { phase, bodyStyle, condition } = useSky()

// Entrance: mount as night, then let the real sky "wake up"
const ready = ref(false)
onMounted(async () => { await nextTick(); requestAnimationFrame(() => (ready.value = true)) })
// lets text drawn straight on the sky (the garden greeting) switch to light ink at dusk and night
watchEffect(() => { document.body.dataset.sky = phase.value })
onBeforeUnmount(() => { delete document.body.dataset.sky })
</script>

<template>
  <div
    class="sky position-absolute top-0 start-0 w-100 h-100"
    :data-phase="ready ? phase : 'night'"
    :data-weather="condition"
    :style="bodyStyle"
    data-testid="sky"
    aria-hidden="true"
  >
    <div class="stars"></div>
    <div class="glow"></div>
    <div class="body"></div>

    <svg class="clouds far" viewBox="0 0 1200 200" preserveAspectRatio="none">
      <ellipse cx="200" cy="90" rx="110" ry="28" /><ellipse cx="680" cy="60" rx="150" ry="32" />
    </svg>
    <svg class="clouds near" viewBox="0 0 1200 200" preserveAspectRatio="none">
      <ellipse cx="420" cy="130" rx="170" ry="38" /><ellipse cx="1000" cy="110" rx="130" ry="30" />
    </svg>

    <div class="veil"></div>
    <div class="lightning"></div>
  </div>
  <Teleport to="#sky-front" defer>
    <div class="front" :data-phase="ready ? phase : 'night'" :data-weather="condition">
      <div class="field-tint"></div>
      <div class="rain">
        <i
          v-for="n in 40"
          :key="n"
          :class="{ extra: n > 24 }"
          :style="{ left: `${(n * 37) % 100}%`, animationDelay: `${(n % 7) * -0.2}s`           }"
        ></i>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
@property --sky-top { syntax: '<color>'; inherits: true; initial-value: transparent; }
@property --sky-bot { syntax: '<color>'; inherits: true; initial-value: transparent; }
@property --ground  { syntax: '<color>'; inherits: true; initial-value: transparent; }
@property --body    { syntax: '<color>'; inherits: true; initial-value: transparent; }
@property --glow    { syntax: '<color>'; inherits: true; initial-value: transparent; }
@property --cloud   { syntax: '<color>'; inherits: true; initial-value: transparent; }
@property --tint    { syntax: '<color>'; inherits: true; initial-value: transparent; }
@property --veil    { syntax: '<color>'; inherits: true; initial-value: transparent; }

.sky {
  z-index: 0; overflow: hidden;
  background: linear-gradient(
    var(--sky-top) 0%,
    var(--sky-bot) 50%,
    var(--ground) 51%
  );
  transition: --sky-top 6s ease, --sky-bot 6s ease, --ground 6s ease,
              --body 6s ease, --glow 6s ease, --cloud 6s ease, --veil 6s ease;
}


/* ---- PHASES: palette vars only ---- */
.sky[data-phase='day'] {
  --sky-top:color-mix(#6EC1EE,var(--periwinkle)) ; --sky-bot: #CFEFFC; --ground: #A9D466;
  --body: var(--cream); --glow: var(--paper); --cloud: var(--paper);
  --glow-o: .0; --star-o: 0; --body-scale: 1;
}
.sky[data-phase='dawn'] {
  --sky-top: #6EC1EE; --sky-bot: var(--peach); --ground: #A9D466;
  --body: var(--butter); --glow: #FFCC85; --cloud: var(--peri-soft);
  --glow-o: 1; --star-o: .3; --body-scale: 1.5;
}
.sky[data-phase='dusk'] {
  --sky-top: #EF95B7; --sky-bot: #FFCC85; --ground: #A9D466;
  --body: var(--cream); --glow: var(--linen); --cloud: var(--peri-soft);
  --glow-o: 1; --star-o: .5; --body-scale: 1.5;
}
.sky[data-phase='night'] {
  --sky-top: #1C2355; --sky-bot: color-mix(in srgb, #6EC1EE 30%, #1C2355); --ground: #A9D466;
  --body: var(--cream); --glow: #6EC1EE; --cloud: var(--shadow-card);
  --glow-o: .25; --star-o: 1; --body-scale: .8;
}

/* ---- WEATHER ---- */
.sky { --veil: var(--bark-muted); }
.sky[data-weather='sunny']  { --veil-o: 0;   --cloud-o: .35; --clear: 1;  --rain-o: 0; }
.sky[data-weather='cloudy'] { --veil-o: .2;  --cloud-o: .9;  --clear: .3; --rain-o: 0; }
.sky[data-weather='rainy']  { --veil-o: .5;  --cloud-o: 1;   --clear: 0;  --rain-o: 1; }
.sky[data-weather='stormy'] { --veil-o: .65; --cloud-o: 1;  --clear: 0;  --rain-o: 1; }

/* ---- LAYERS ---- */
.glow {
  position: absolute; inset: 0;
  background: radial-gradient(ellipse 70% 45% at var(--body-x) 42%, var(--glow), transparent 70%);
  opacity: calc(var(--glow-o) * (.4 + var(--clear) * .6));
  transition: opacity 6s ease;
}

.stars {
  position: absolute; inset: 0 0 50% 0;
  background:
    radial-gradient(1.5px 1.5px at 12% 20%, var(--paper) 50%, transparent),
    radial-gradient(1px 1px at 28% 60%, var(--paper) 50%, transparent),
    radial-gradient(1.5px 1.5px at 47% 30%, var(--paper) 50%, transparent),
    radial-gradient(1px 1px at 63% 70%, var(--paper) 50%, transparent),
    radial-gradient(1.5px 1.5px at 81% 25%, var(--paper) 50%, transparent),
    radial-gradient(1px 1px at 92% 55%, var(--paper) 50%, transparent);
  background-size: 25% 100%;           /* tiles the 6 points into a denser field */
  opacity: calc(var(--star-o) * var(--clear));
  transition: opacity 6s ease;
  animation: twinkle 2s ease-in-out infinite alternate;
}
@keyframes twinkle { to { filter: brightness(.6); } }

.body {
  position: absolute; left: var(--body-x); top: var(--body-y);
  width: 90px; height: 90px; margin: -45px 0 0 -45px; border-radius: 50%;
  background: var(--body);
  box-shadow: 0 0 60px 24px var(--glow);
  transform: scale(var(--body-scale));
  opacity: calc(.4 + var(--clear) * .6);
  transition: left 2s ease, top 2s ease, transform 6s var(--spring), opacity 6s ease;
}

.clouds {
  position: absolute; left: 0; width: 200%; height: 160px;
  fill: var(--cloud); opacity: var(--cloud-o);
  transition: opacity 6s ease;
  animation: drift 120s linear infinite;
}
.clouds.far  { top: 10%; }
.clouds.near { top: 24%; animation-duration: 70s; }
@keyframes drift { to { transform: translateX(-50%); } }

.veil { position: absolute; inset: 0; background: var(--veil); opacity: var(--veil-o); transition: opacity 6s ease; }

/* lightning: invisible except a quick double flicker every 7s, only while stormy */
.lightning { position: absolute; inset: 0; background: var(--paper); opacity: 0; pointer-events: none; }
.sky[data-weather='stormy'] .lightning { animation: flash 7s linear infinite; }
@keyframes flash {
  0%, 88%, 100% { opacity: 0; }
  89%           { opacity: .7; }
  90%           { opacity: .1; }
  92%           { opacity: .5; }
  95%           { opacity: 0; }
}

/* ---- FRONT LAYER (above the garden bed) ---- */
.front {
  position: absolute; inset: 0; overflow: hidden;
  transition: --tint 6s ease;
}

/* time of day: color and strength */
.front[data-phase='day']   { --tint: #fff;    --tint-o: 0; }
.front[data-phase='dawn']  { --tint: #FFCC85; --tint-o: .22; }
.front[data-phase='dusk']  { --tint: #EF95B7; --tint-o: .3; }
.front[data-phase='night'] { --tint: #1C2355; --tint-o: .5; }

.field-tint {
  position: absolute; left: 0; right: 0; bottom: 0;
  top: 50%;                      /* = HORIZON from Step 0; tints the field only */
  background: linear-gradient(
    to bottom,
    transparent 0%,
    var(--tint) 20%
  );  opacity: var(--tint-o);
  transition: opacity 6s ease;
}
/* weather: rain on/off */
.front[data-weather='sunny'],
.front[data-weather='cloudy'] { --rain-o: 0; }
.front[data-weather='rainy'],
.front[data-weather='stormy'] { --rain-o: 1; }

/* rain spans the full front layer so it also falls through the lower sky */
.rain { position: absolute; inset: 0; opacity: var(--rain-o); transition: opacity 3s ease; }
.rain i {
  position: absolute; top: -10%; width: 2px; height: 36px;
  background: #6EC1EE; opacity: .6;
  animation: fall .9s linear infinite;
}
.front:not([data-weather='rainy'], [data-weather='stormy']) .rain i { animation-play-state: paused; }  /* no cost when dry */
@keyframes fall { to { transform: translateY(110vh); } }

/* storm: 16 extra streaks, faster, slanted by wind. The layer is widened to the right
   so streaks blown left still cover the right edge; .front clips the overflow */
.front:not([data-weather='stormy']) .rain i.extra { display: none; }
.front[data-weather='stormy'] .rain { right: -30vh; }
.front[data-weather='stormy'] .rain i { animation-name: fall-wind; animation-duration: .6s; }
@keyframes fall-wind {
  from { transform: translate(0, 0) rotate(15deg); }
  to   { transform: translate(-30vh, 110vh) rotate(15deg); }  /* tan(15deg) * 110vh ~ 30vh, so the streak moves along its own slant */
}

@media (prefers-reduced-motion: reduce) {
  .clouds, .stars, .rain i, .lightning { animation: none !important; }  /* flashing is also an accessibility risk */
  .sky, .sky *, .front, .front * { transition-duration: .01s !important; }
}
</style>