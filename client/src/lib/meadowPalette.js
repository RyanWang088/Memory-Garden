import { FLOWER_VARS } from './floorLayout.js'

export const FADE_MS = 6000   // same as the 6s --fade the garden's sky uses

// Colour vector layout: five hill colours, tree, tree2, then the flower opacity.
const TREE = 15, TREE2 = 18, FLOWER_ALPHA = 21, VEC_LENGTH = 22
const HILL_COLORS = 5

export function parseColor(text) {
  const s = String(text ?? '').trim()
  let m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s)
  if (m) {
    const hex = m[1].length === 3 ? [...m[1]].map(c => c + c).join('') : m[1]
    return [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16))
  }
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(s)              // registered <color>, plain values
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])]
  m = /^color\(\s*srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/i.exec(s)             // registered <color>, color-mix() results
  return m ? [m[1], m[2], m[3]].map(v => Number(v) * 255) : null
}

// Build the colour vector for one look. `read(name)` returns a CSS variable's value as text.
// It reads the weather-graded --g-* tokens, so the canvas gets exactly the colours the DOM sky paints.
export function lookVector(read) {
  const rgb = name => {
    const c = parseColor(read(name))
    if (!c) console.warn(`[meadow] ${name} is missing or not a colour; is theme.css loaded?`)
    return c ?? [128, 128, 128]
  }
  const hills = Array.from({ length: HILL_COLORS }, (_, i) => rgb(`--g-h${i + 1}`)).flat()
  const alpha = parseFloat(read('--fl-o'))
  return Float64Array.from([...hills, ...rgb('--g-tree'), ...rgb('--tree2'), Number.isFinite(alpha) ? alpha : 1])
}

// ---- browser readers (theme.css is the single source of truth) ----
const lookCache = new Map()

// One throwaway probe per look, created already carrying its attributes. Switching them on a single probe would
// catch the CSS transitions mid-flight and read the wrong colour.
export function readLook(mood, weather) {
  const key = `${mood}|${weather}`
  if (lookCache.has(key)) return lookCache.get(key)
  const probe = document.createElement('div')
  probe.dataset.mood = mood
  if (weather) probe.dataset.weather = weather
  probe.style.cssText = 'visibility:hidden;width:0;height:0;position:fixed;'
  document.body.append(probe)
  const style = getComputedStyle(probe)
  const vec = lookVector(name => style.getPropertyValue(name))
  probe.remove()
  lookCache.set(key, vec)
  return vec
}

export function readFlowerColors() {
  const style = getComputedStyle(document.documentElement)
  const get = (name, fallback) => style.getPropertyValue(name).trim() || fallback
  return { list: FLOWER_VARS.map(name => get(name, '#fff')), eye: get('--butter-deep', '#D99E2B') }
}

const smooth = k => k * k * (3 - 2 * k)

// What drawMeadow reads. Colours are strings ready for ctx.fillStyle; setLook() crossfades to a new mood and weather.
export function createMeadowPalette({
  look = { mood: 'night', weather: 'sunny' }, onChange = () => {}, read = readLook, flowerColors = readFlowerColors(),
} = {}) {
  const current = Float64Array.from(read(look.mood, look.weather))
  let target = `${look.mood}|${look.weather}`, from = null, to = null, startedAt = 0, duration = 1, raf = 0

  const css = o => `rgb(${Math.round(current[o])},${Math.round(current[o + 1])},${Math.round(current[o + 2])})`

  function step(now) {
    raf = 0
    const k = Math.min(1, (now - startedAt) / duration)
    const e = smooth(k)
    for (let i = 0; i < VEC_LENGTH; i++) current[i] = from[i] + (to[i] - from[i]) * e
    onChange()
    if (k < 1) raf = requestAnimationFrame(step)
  }

  return {
    get look() { return target },
    flowers: flowerColors.list,
    flowerEye: flowerColors.eye,
    get flowerAlpha() { return current[FLOWER_ALPHA] },
    get tree() { return css(TREE) },
    get tree2() { return css(TREE2) },
    // flat colour for a hill at screen depth t (0 = horizon, 1 = front): five evenly spaced stops
    ramp(t) {
      const f = Math.max(0, Math.min(1, t)) * (HILL_COLORS - 1)
      const i = Math.min(HILL_COLORS - 2, Math.floor(f)), k = f - i, a = i * 3, b = a + 3
      const c = j => Math.round(current[a + j] + (current[b + j] - current[a + j]) * k)
      return `rgb(${c(0)},${c(1)},${c(2)})`
    },

    setLook(mood, weather, { instant = false } = {}) {
      const key = `${mood}|${weather}`
      if (key === target && !raf) return
      target = key
      from = Float64Array.from(current)
      to = read(mood, weather)
      const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
      duration = instant || reduced ? 1 : FADE_MS
      startedAt = performance.now()
      if (!raf) raf = requestAnimationFrame(step)
    },

    dispose() { cancelAnimationFrame(raf); raf = 0 },
  }
}