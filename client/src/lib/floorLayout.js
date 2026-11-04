import { seeded } from './shuffle.js'

export const CELL_SIZE = 100, GRID_COLS = 15, GRID_ROWS = 20
export const GRID_WIDTH = CELL_SIZE * GRID_COLS

const TAU = Math.PI * 2

// ---- rolling hills ----
export const HILL_GAP = CELL_SIZE * 2             // depth between hill crests
export const HILL_SAMPLE_GAP = CELL_SIZE * 0.3    // x spacing when tracing a crest

// Each crest is the same three-wave ridge scenery.js draws (amplitudes 1 : .45 : .2, frequencies ~1 : 2.3 : 5.1),
// laid out in world units. Neighbouring hills share a phase drift, so crests roll in parallel and never cross:
// worst-case spacing is HILL_GAP - ~100, still positive.
const HILL_AMP = 65
const RIDGE_WAVES = [
  { amp: 1,     wavelength: 1900,  drift: 1.7, offset: 0 },
  { amp: 0.45, wavelength: 830,  drift: 3.1, offset: 1.3 },
  { amp: 0.2,  wavelength: 370,  drift: 5.3, offset: 2.9 },
]
export const hillEdgeDepth = (hill, worldX) => {
  let wobble = 0
  for (const w of RIDGE_WAVES) wobble += w.amp * Math.sin((worldX / w.wavelength) * TAU + hill * w.drift + w.offset)
  return hill * HILL_GAP + HILL_AMP * wobble
}

// ---- scatter: flower dots and margin trees ----
export const SCATTER_DEPTH = 3000
export const SCATTER_MIN_X = -300, SCATTER_MAX_X = GRID_WIDTH + 300  // overscan: far rows show wider than the grid
const FLOWER_COUNT = 1500
const TREE_MARGIN = 70   // trees stay this far outside the grid, so nothing stands where a plant can go

// Theme variables for the dot colours (the white appears twice, like the weighting in scenery.js).
// The renderer resolves these to real colours; floorLayout only stores the index.
export const FLOWER_VARS = ['--paper', '--paper', '--berry-soft', '--butter', '--lilac', '--berry', '--butter-soft']

// The hill whose visible face a point sits on: between the crest of the next hill in front and its own crest.
// Props are painted right after their hill, so a nearer ridge always hides them properly.
export function hillOf(worldX, depth) {
  let hill = Math.floor(depth / HILL_GAP) - 2
  while (hillEdgeDepth(hill, worldX) < depth) hill++
  return hill
}

function buildProps() {
  const rand = seeded(7), out = []
  const width = SCATTER_MAX_X - SCATTER_MIN_X

  for (let n = 0; n < FLOWER_COUNT; n++) {
    const d = rand() * SCATTER_DEPTH, x = SCATTER_MIN_X + rand() * width
    out.push({ k: 'flower', x, d, s: 1 + rand(), c: Math.floor(rand() * FLOWER_VARS.length) })
  }

  // Shrubs down both margins.
  for (const side of [-1, 1]) {
    for (let d = 30; d < SCATTER_DEPTH; d += 70 + rand() * 90) {
      const reach = rand() * (SCATTER_MAX_X - GRID_WIDTH - TREE_MARGIN)
      const x = side < 0 ? -TREE_MARGIN - reach : GRID_WIDTH + TREE_MARGIN + reach
      out.push({ k: 'tree', type: 'shrub', x, d, s: 0.8 + rand() * 0.8 })
    }
  }

  const byHill = new Map()
  for (const p of out) {
    const hill = hillOf(p.x, p.d)
    if (!byHill.has(hill)) byHill.set(hill, [])
    byHill.get(hill).push(p)
  }
  for (const list of byHill.values()) list.sort((a, b) => b.d - a.d)  // far first within a hill
  return byHill
}

export const PROPS_BY_HILL = buildProps()