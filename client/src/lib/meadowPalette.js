import { FLOWER_VARS } from './floorLayout.js'

// Skybox phase -> the mood block in theme.css (.scenery[data-mood=...]) that supplies --h1..--h5, --tree, --tree2, --fl-o.
// 'blush' is deliberately absent: it stays in theme.css for other pages, the garden just doesn't use it.
export const MOOD_BY_PHASE = Object.freeze({ dawn: 'morning', day: 'day', dusk: 'dusk', night: 'night' })

export const FADE_MS = 6000   // same as the 6s colour transitions in Skybox.vue

// Colour vector layout: five hill colours, tree, tree2, far ridge (r,g,b each), then the flower opacity.
const TREE = 15, TREE2 = 18, FAR = 21, FLOWER_ALPHA = 24, VEC_LENGTH = 25
const HILL_COLORS = 5

export function parseColor(text) {
  const s = String(text ?? '').trim()
  let m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s)
  if (m) {
    const hex = m[1].length === 3 ? [...m[1]].map(c => c + c).join('') : m[1]
    return [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16))
  }
  // registered <color> properties (--s-mid) come back from getComputedStyle as rgb()
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(s)
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}

// Build the colour vector for one mood. `read(name)` returns a CSS variable's value as text.
export function moodVector(read) {
  const rgb = name => {
    const c = parseColor(read(name))
    if (!c) console.warn(`[meadow] ${name} is missing or not a colour; is theme.css loaded?`)
    return c ?? [128, 128, 128]
  }
  const hills = Array.from({ length: HILL_COLORS }, (_, i) => rgb(`--h${i + 1}`)).flat()
  const mid = rgb('--s-mid')
  // the farthest ridge above the horizon fades toward the sky: half h1, half sky
  const far = hills.slice(0, 3).map((c, i) => c + (mid[i] - c) * 0.5)
  const alpha = parseFloat(read('--fl-o'))
  return Float64Array.from([...hills, ...rgb('--tree'), ...rgb('--tree2'), ...far, Number.isFinite(alpha) ? alpha : 1])
}

// ---- browser readers (theme.css is the single source of truth) ----
const moodCache = new Map()

// One throwaway probe per mood, created already carrying its data-mood. Switching data-mood on a single probe
// would catch the 2.5s --s-mid transition mid-flight and read the wrong colour.
export function readMood(mood) {
  if (moodCache.has(mood)) return moodCache.get(mood)
  const probe = document.createElement('div')
  probe.className = 'scenery'
  probe.dataset.mood = mood
  probe.style.cssText = 'visibility:hidden;width:0;height:0;'
  document.body.append(probe)
  const style = getComputedStyle(probe)
  const vec = moodVector(name => style.getPropertyValue(name))
  probe.remove()
  moodCache.set(mood, vec)
  return vec
}

export function readFlowerColors() {
  const style = getComputedStyle(document.documentElement)
  const get = (name, fallback) => style.getPropertyValue(name).trim() || fallback
  return { list: FLOWER_VARS.map(name => get(name, '#fff')), eye: get('--butter-deep', '#D99E2B') }
}

const smooth = k => k * k * (3 - 2 * k)

// What drawMeadow reads. Colours are strings ready for ctx.fillStyle; setMood() crossfades to a new mood.
export function createMeadowPalette({
  mood = 'night', onChange = () => {}, read = readMood, flowerColors = readFlowerColors(),
} = {}) {
  const current = Float64Array.from(read(mood))
  let target = mood, from = null, to = null, startedAt = 0, duration = 1, raf = 0

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
    get mood() { return target },
    flowers: flowerColors.list,
    flowerEye: flowerColors.eye,
    get flowerAlpha() { return current[FLOWER_ALPHA] },
    get tree() { return css(TREE) },
    get tree2() { return css(TREE2) },
    get far() { return css(FAR) },

    // flat colour for a hill at screen depth t (0 = horizon, 1 = front): five evenly spaced stops
    ramp(t) {
      const f = Math.max(0, Math.min(1, t)) * (HILL_COLORS - 1)
      const i = Math.min(HILL_COLORS - 2, Math.floor(f)), k = f - i, a = i * 3, b = a + 3
      const c = j => Math.round(current[a + j] + (current[b + j] - current[a + j]) * k)
      return `rgb(${c(0)},${c(1)},${c(2)})`
    },

    setMood(next, { instant = false } = {}) {
      if (next === target && !raf) return
      target = next
      from = Float64Array.from(current)
      to = read(next)
      const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
      duration = instant || reduced ? 1 : FADE_MS
      startedAt = performance.now()
      if (!raf) raf = requestAnimationFrame(step)
    },

    dispose() { cancelAnimationFrame(raf); raf = 0 },
  }
}