import { ref, reactive, computed, watch, onBeforeUnmount } from 'vue'
import { BLOOM_STAGE } from '@/lib/plantSprites'

// When each beat of the celebration happens, in ms after the plant is released. Retime everything here.
//   water   droplets fall onto the plant (a wilted plant also regains its colour: "drink")
//   squash  the plant crouches (growth only)
//   swap    the new stage appears
//   burst   sparkles, petals and glow. For a revival it comes BEFORE the swap so the flash peaks on it and hides the seam
// The celebration ends when the burst reports it is finished. `maxMs` is only a safety net.
export const BEATS = {
  grow:   { water: 0, squash: 650, swap: 800, burst: 1000 },
  revive: { water: 0, burst: 700, swap: 1050 },
  maxMs: 6000,
}

// Bigger stage, bigger reward (see PlantSparkle for what each tier throws)
const TIER_BY_STAGE = { 2: 'small', 3: 'medium', [BLOOM_STAGE]: 'bloom' }

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Runs a stage-up celebration for one PlantSprite.
// `props.growth` is { from, to, phase } from the garden store. Until the garden releases it the plant keeps its old
// look; then the beats above play, and `emit('grown')` tells the garden to clear the record.
//   growth:  the new stage rises out of the pot.
//   revival: a wilted plant (from > BLOOM_STAGE). The wilted sprite is a different pose, not a tilted healthy one,
//            so nothing tries to morph it: it drinks, dissolves into the pot under a flash, and the healthy plant sprouts.
export function usePlantGrowth(props, emit) {
  const landed = ref(false) // the new sprite has been swapped in
  const fx = reactive({ water: false, squash: false, drink: false, burst: false })
  let timers = []
  let finished = false

  const growing = computed(() => props.growth?.phase === 'playing')
  const reviving = computed(() => props.growth?.from > BLOOM_STAGE)
  const shownStage = computed(() => (props.growth && !landed.value ? props.growth.from : props.stage))
  const tier = computed(() => TIER_BY_STAGE[props.growth?.to] ?? 'small')
  const transitionName = computed(() => (!growing.value ? 'stage' : reviving.value ? 'perk' : 'grow'))

  const at = (ms, fn) => timers.push(setTimeout(fn, ms))
  const stop = () => { timers.forEach(clearTimeout); timers = [] }

  // idempotent: whichever comes first, the burst finishing or the safety net
  function finish() {
    if (finished) return
    finished = true
    emit('grown')
  }

  function play() {
    if (prefersReducedMotion()) {
      landed.value = true
      finish()
      return
    }
    const beats = reviving.value ? BEATS.revive : BEATS.grow
    at(beats.water, () => { fx.water = true; fx.drink = reviving.value })
    if (beats.squash !== undefined) at(beats.squash, () => (fx.squash = true))
    at(beats.swap, () => { fx.squash = false; fx.drink = false; landed.value = true })
    at(beats.burst, () => (fx.burst = true))
    at(BEATS.maxMs, finish)
  }

  watch(() => props.growth?.phase, (phase) => { if (phase === 'playing') play() }, { immediate: true })

  // the garden cleared the record: back to normal
  watch(() => props.growth, (growth) => {
    if (growth) return
    stop()
    finished = false
    landed.value = false
    Object.assign(fx, { water: false, squash: false, drink: false, burst: false })
  })

  onBeforeUnmount(stop)

  return { shownStage, growing, reviving, transitionName, tier, fx, burstDone: finish }
}