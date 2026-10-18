export const CELL_SIZE = 100, GRID_COLS = 15, GRID_ROWS = 20
export const GRID_WIDTH = CELL_SIZE * GRID_COLS

export const STRIPE_COLORS = ['#97BF54', '#73C34E']
export const PATH_COLOR = '#DAB381', PATH_EDGE_COLOR = '#C8B89D'
export const STRIPE_THICKNESS = CELL_SIZE * 2, STRIPE_WOBBLE = STRIPE_THICKNESS * 0.2
export const STRIPE_SAMPLE_GAP = CELL_SIZE * 0.5, PATH_STEP = 16

export const wave = (distance, wavelength, phase) => Math.sin(distance / wavelength + phase)

export const stripeEdgeDepth = (stripe, worldX) =>
  stripe * STRIPE_THICKNESS + STRIPE_WOBBLE * (wave(worldX, CELL_SIZE * 7, stripe * 1.7) + 0.5 * wave(worldX, CELL_SIZE * 3, stripe * 3.1))

export const pathCenterX = depth =>
  GRID_WIDTH / 2 + CELL_SIZE * 1.4 * (wave(depth, CELL_SIZE * 6, 0) + 0.5 * wave(depth, CELL_SIZE * 2.3, 1.3))

export const pathHalfWidth = depth =>
  CELL_SIZE * (1.05 + 0.55 * (0.6 * wave(depth, CELL_SIZE * 4.1, 0.4) + 0.4 * wave(depth, CELL_SIZE * 1.7, 2.2)))

export const isOnPath = (col, row) => {
  const depth = (row + 0.5) * CELL_SIZE
  return Math.abs((col + 0.5) * CELL_SIZE - pathCenterX(depth)) < pathHalfWidth(depth) + CELL_SIZE / 2
}
