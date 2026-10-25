import { computed, ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { createMeadowPalette, MOOD_BY_PHASE } from '@/lib/meadowPalette'

// Keeps the meadow colours in step with the sky.
//   phase    = ref/computed of 'dawn' | 'day' | 'dusk' | 'night' (from useSkyPhase)
//   onChange = called on every crossfade frame; GardenBed passes requestRender
// Returns:
//   palette   what drawMeadow reads
//   mood      the mood the sky is heading to (what tests should assert)
//   shownMood the mood on screen right now: 'night' for the first frame, then `mood`; the critters follow this
//             so fireflies glow while the sky is still waking up and fade out as it brightens
export function useMeadowPalette(phase, onChange) {
  const mood = computed(() => MOOD_BY_PHASE[phase.value] ?? 'day')
  const shownMood = ref('night')
  const palette = createMeadowPalette({ mood: 'night', onChange })

  const show = next => { palette.setMood(next); shownMood.value = next }

  // same entrance as Skybox: start as night, then let the real colours wake up
  onMounted(async () => {
    await nextTick()
    requestAnimationFrame(() => show(mood.value))
  })
  watch(mood, show)
  onBeforeUnmount(() => palette.dispose())

  return { palette, mood, shownMood }
}