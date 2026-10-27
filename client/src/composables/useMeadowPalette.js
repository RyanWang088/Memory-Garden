import { watch, onBeforeUnmount } from 'vue'
import { createMeadowPalette } from '@/lib/meadowPalette'

// Keeps the canvas colours in step with the sky.
//   look     = ref/computed of { mood, weather } (weather.look)
//   onChange = called on every crossfade frame; GardenBed passes requestRender
export function useMeadowPalette(look, onChange) {
  const palette = createMeadowPalette({ look: look.value, onChange })
  watch(look, ({ mood, weather }) => palette.setLook(mood, weather))
  onBeforeUnmount(() => palette.dispose())
  return { palette }
}