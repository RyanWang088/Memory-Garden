export const CELL_SIZE = 100, GRID_COLS = 15, GRID_ROWS = 20
export const GRID_WIDTH = CELL_SIZE * GRID_COLS

// ---- rolling hills ----
export const HILL_GAP = CELL_SIZE * 2            // depth between hill crests
export const HILL_WOBBLE = CELL_SIZE * 0.5       // how far a crest drifts forward/back along x
export const HILL_SAMPLE_GAP = CELL_SIZE * 0.5   // x spacing when tracing a crest
export const RIM_COLOR = 'rgba(255,252,222,.4)'  // faint light line on each crest

// pale yellow (far) -> deep green (near)
const FOG_STOPS = [
  [0, '#CFE27F'], [0.17, '#A9D466'], [0.44, '#A2D263'], [0.72, '#86C150'], [1, '#6CAE45'],
].map(([t, hex]) => [t, [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))])

export function fogColor(t) {
  t = Math.max(0, Math.min(1, t))
  for (let i = 1; i < FOG_STOPS.length; i++) {
    if (t <= FOG_STOPS[i][0]) {
      const [t0, a] = FOG_STOPS[i - 1], [t1, b] = FOG_STOPS[i], k = (t - t0) / (t1 - t0)
      return 'rgb(' + a.map((v, j) => Math.round(v + (b[j] - v) * k)).join(',') + ')'
    }
  }
  return 'rgb(' + FOG_STOPS[FOG_STOPS.length - 1][1].join(',') + ')'
}

// ---- path ----
export const PATH_COLOR = '#E7C9A5', PATH_EDGE_COLOR = '#C8A27F'
export const PATH_STEP = 16, PATH_EDGE_WIDTH = 8

export const wave = (distance, wavelength, phase) => Math.sin(distance / wavelength + phase)

export const hillEdgeDepth = (hill, worldX) =>
  hill * HILL_GAP + HILL_WOBBLE * (wave(worldX, CELL_SIZE * 12, hill * 1.7) + 0.5 * wave(worldX, CELL_SIZE * 5, hill * 3.1))

export const pathCenterX = depth =>
  GRID_WIDTH / 2 + CELL_SIZE * 1.4 * (wave(depth, CELL_SIZE * 6, 0) + 0.5 * wave(depth, CELL_SIZE * 2.3, 1.3))

export const pathHalfWidth = depth =>
  CELL_SIZE * (1.05 + 0.55 * (0.6 * wave(depth, CELL_SIZE * 4.1, 0.4) + 0.4 * wave(depth, CELL_SIZE * 1.7, 2.2)))

export const onPathAt = (worldX, depth, margin = 0) =>
  Math.abs(worldX - pathCenterX(depth)) < pathHalfWidth(depth) + margin

export const isOnPath = (col, row) => {
  const depth = (row + 0.5) * CELL_SIZE
  return Math.abs((col + 0.5) * CELL_SIZE - pathCenterX(depth)) < pathHalfWidth(depth) + CELL_SIZE / 2
}

// ---- props: grass tufts, flower dots, mushroom logs ----
export const SCATTER_DEPTH = 3000
export const SCATTER_MIN_X = -300, SCATTER_MAX_X = GRID_WIDTH + 300  // overscan: far rows show wider than the grid
export const FLOWER_COLORS = ['#FFE484', '#FFB5A7', '#E0A93A', '#F27A8E', '#E6EBFF']

// Fixed log spots (world x, depth). Move these around freely.
export const LOG_SPOTS = [
  { x: 1276, d: 250 },
  { x: 120, d: 640 },
  { x: 1265, d: 1030 },
  { x: 630, d: 1420 },
  { x: 1005, d: 1810 },
  { x: 1022, d: 2200 },
  { x: 241, d: 2590 },
]

const seeded = a => () => {
  a |= 0; a = a + 0x6D2B79F5 | 0
  let t = Math.imul(a ^ a >>> 15, 1 | a)
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
  return ((t ^ t >>> 14) >>> 0) / 4294967296
}

function buildProps() {
  const rand = seeded(7), out = [], width = SCATTER_MAX_X - SCATTER_MIN_X
  for (let n = 0; n < 1125; n++) {
    const d = rand() * SCATTER_DEPTH, x = SCATTER_MIN_X + rand() * width
    if (!onPathAt(x, d, 28)) out.push({ k: 'tuft', x, d, s: 0.8 + rand() * 0.5 })
  }
  for (let n = 0; n < 450; n++) {
    const d = rand() * SCATTER_DEPTH, x = SCATTER_MIN_X + rand() * width
    if (!onPathAt(x, d, 28)) out.push({ k: 'flower', x, d, s: 0.8 + rand() * 0.4, c: FLOWER_COLORS[n % FLOWER_COLORS.length] })
  }
  for (const { x, d } of LOG_SPOTS) out.push({ k: 'log', x, d, s: 1 })
  return out.sort((a, b) => a.d - b.d)
}

export const PROPS = buildProps()

// ---- cobblestones on the path ----
export const STONE_COLORS = ['#D3C3AD', '#C9B79E', '#DDCFBB', '#BFAC93']
export const STONE_SHADOW_COLOR = '#A88F72'
const STONE_GAP = 34 // world distance between stone centres, along and across the path

// Staggered rows of stones (like brickwork) inside the path's edges, with a few left out so the sand shows.
function buildStones() {
  const rand = seeded(11), out = []
  for (let row = 0, d = STONE_GAP / 2; d < SCATTER_DEPTH; row++, d += STONE_GAP) {
    const center = pathCenterX(d), half = pathHalfWidth(d) - STONE_GAP * 0.45
    for (let x = -half + (row % 2 ? STONE_GAP / 2 : 0); x <= half; x += STONE_GAP) {
      if (rand() < 0.12) continue
      out.push({
        x: center + x + (rand() - 0.5) * 6, d: d + (rand() - 0.5) * 6,
        rx: 11 + rand() * 4, rz: 9 + rand() * 4, // half width / half depth in world units
        c: STONE_COLORS[Math.floor(rand() * STONE_COLORS.length)],
      })
    }
  }
  return out // near -> far
}

export const STONES = buildStones()