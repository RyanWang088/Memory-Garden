import {
  GRID_WIDTH, HILL_GAP, HILL_SAMPLE_GAP, PROPS_BY_HILL, hillEdgeDepth, seeded,
} from './floorLayout.js'
import { HALF_PI, BOTTOM_MARGIN, FAR_SPREAD, FAR_SIZE } from './gardenCamera.js'

const TAU = Math.PI * 2
const BLADE_GAP = 30            // world units between grass blades along a crest
const BACKDROP_PARALLAX = 0.12  // how far the horizon ridges follow sideways panning

// Draws the whole meadow. The caller has already set the DPR transform and cleared the canvas.
//   cam     = createGardenCamera() result
//   palette = createMeadowPalette() result: ramp(t), tree, tree2, far, flowers[], flowerEye, flowerAlpha
export function drawMeadow(ctx, cam, palette) {
  const { camera, depthToAngle, screenX, screenY } = cam
  const { viewWidth, viewHeight, radius, horizonY, frontY, scale, scrollPos, centerX } = camera
  const span = frontY - horizonY
  const floorAngle = depth => Math.min(HALF_PI, depthToAngle(depth))

  drawBackdrop(ctx, camera, palette)

  // far-distance base colour, flush with the horizon ridge above it
  ctx.fillStyle = palette.ramp(0)
  ctx.fillRect(0, horizonY, viewWidth, viewHeight - horizonY)

  const firstDepth = scrollPos - (BOTTOM_MARGIN * 2) / scale
  const lastDepth = scrollPos + (HALF_PI * radius) / scale
  const halfVisible = viewWidth / (2 * scale * FAR_SPREAD)
  const x0 = Math.floor((centerX - halfVisible) / HILL_SAMPLE_GAP) * HILL_SAMPLE_GAP
  const x1 = centerX + halfVisible + HILL_SAMPLE_GAP
  const aFront = floorAngle(firstDepth)
  const frame = { span, firstDepth, lastDepth, floorAngle, x0, x1, viewWidth, treeA: palette.tree, treeB: palette.tree2 }

  // far hills first; each is flat-filled, gets a grass fringe along its crest, then its own flowers and trees
  // are painted before the next hill in front covers whatever it should
  for (let hill = Math.ceil((lastDepth + 100) / HILL_GAP); hill >= Math.floor(firstDepth / HILL_GAP); hill--) {
    const mid = hillEdgeDepth(hill, GRID_WIDTH / 2)
    if (mid < firstDepth - 120) continue
    const y = screenY(floorAngle(mid)), t = (y - horizonY) / span

    ctx.fillStyle = palette.ramp(t)
    ctx.beginPath()
    for (let x = x0; x <= x1; x += HILL_SAMPLE_GAP) {
      const a = floorAngle(hillEdgeDepth(hill, x))
      ctx.lineTo(screenX(x, a), screenY(a))
    }
    ctx.lineTo(screenX(x1, aFront), screenY(aFront)); ctx.lineTo(screenX(x0, aFront), screenY(aFront))
    ctx.fill()

    drawFringe(ctx, cam, hill, frame)
    drawBand(ctx, cam, palette, PROPS_BY_HILL.get(hill), frame)
  }
}

// cheap deterministic noise for per-blade variation, stable between frames
function hash(a, b) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

// grass blades standing on the crest, in the hill's own colour so they read as its silhouette (fillStyle is still set)
function drawFringe(ctx, cam, hill, { floorAngle, x0, x1 }) {
  const { camera, screenX, screenY, shrinkTo } = cam
  const midAngle = floorAngle(hillEdgeDepth(hill, GRID_WIDTH / 2))
  if (midAngle >= HALF_PI * 0.97) return
  const u0 = camera.scale * shrinkTo(FAR_SIZE, midAngle)
  if (u0 < 0.26) return                       // blades would be under 2px: skip the far hills
  const step = u0 < 0.5 ? 2 : 1

  ctx.beginPath()
  for (let j = Math.floor(x0 / BLADE_GAP); j <= Math.ceil(x1 / BLADE_GAP); j += step) {
    const x = (j + hash(hill, j * 3) * 0.8) * BLADE_GAP
    const a = floorAngle(hillEdgeDepth(hill, x))
    if (a >= HALF_PI) continue
    const u = camera.scale * shrinkTo(FAR_SIZE, a)
    const px = screenX(x, a), py = screenY(a) + 2 * u
    const h = (15 + hash(hill, j * 3 + 1) * 28) * u, lean = (hash(hill, j * 3 + 2) - 0.5) * 30 * u, w = Math.max(0.8, 5 * u)
    ctx.moveTo(px - w, py)
    ctx.quadraticCurveTo(px + lean / 2, py - h * 0.6, px + lean, py - h)
    ctx.quadraticCurveTo(px + lean / 3, py - h * 0.4, px + w, py)
  }
  ctx.fill()
}

function drawBand(ctx, cam, palette, props, { firstDepth, lastDepth, viewWidth, treeA, treeB }) {
  if (!props) return
  const { camera, depthToAngle, screenX, screenY, shrinkTo } = cam
  const { scale } = camera

  for (const p of props) {                    // already sorted far -> near
    if (p.d < firstDepth || p.d > lastDepth) continue
    const a = depthToAngle(p.d)
    if (a < -0.05 || a > HALF_PI * 0.985) continue
    const px = screenX(p.x, a)
    if (px < -160 || px > viewWidth + 160) continue
    const py = screenY(a)
    const u = scale * shrinkTo(FAR_SIZE, a) * p.s

    if (p.k === 'flower') {
      const r = Math.max(0.9, 4.6 * u)
      ctx.globalAlpha = palette.flowerAlpha
      ctx.fillStyle = palette.flowers[p.c]
      ctx.beginPath(); ctx.arc(px, py - r, r, 0, TAU); ctx.fill()
      if (r > 2.6) { ctx.fillStyle = palette.flowerEye; ctx.beginPath(); ctx.arc(px, py - r, r * 0.35, 0, TAU); ctx.fill() }
      ctx.globalAlpha = 1
    } else {
      for (const [dx, dy, rx, ry, alt] of p.blobs) {
        ctx.fillStyle = alt ? treeB : treeA
        ctx.beginPath(); ctx.ellipse(px + dx * u, py - dy * u, rx * u, ry * u, 0, 0, TAU); ctx.fill()
      }
    }
  }
}

// ---- horizon backdrop: two ridges and a tree line standing above the horizon ----
// Infinitely far, so vertical scrolling never moves it; it only drifts a little with sideways panning.
// Geometry is seeded and rebuilt only when the stage size changes; colours are read fresh every frame so it crossfades.
let backdrop = null

function buildBackdrop(viewWidth, horizonY) {
  const rand = seeded(11)
  const room = Math.max(24, horizonY - 4)           // all the sky height the camera leaves above the horizon
  const pad = viewWidth * 0.12
  const ridge = (base, amp, freq) => {
    const waves = [0, 1, 2].map(k => ({ a: amp * [1, 0.45, 0.2][k], f: freq * [1, 2.3, 5.1][k], p: rand() * TAU }))
    const step = Math.max(24, viewWidth / 40), pts = []
    for (let x = -pad - step; x <= viewWidth + pad + step; x += step) {
      let y = base
      for (const w of waves) y -= w.a * Math.sin(((x + pad) / (viewWidth + 2 * pad)) * TAU * w.f + w.p)
      pts.push([x, y])
    }
    return pts
  }
  const far = ridge(horizonY - room * 0.5, room * 0.07, 0.8)
  const near = ridge(horizonY - room * 0.22, room * 0.06, 1.3)

  const yAt = (pts, x) => {
    for (let i = 0; i < pts.length - 1; i++) {
      if (x >= pts[i][0] && x <= pts[i + 1][0]) return pts[i][1] + (pts[i + 1][1] - pts[i][1]) * ((x - pts[i][0]) / (pts[i + 1][0] - pts[i][0]))
    }
    return pts[pts.length - 1][1]
  }
  const sizeK = Math.min(1, Math.max(0.45, room / 160))
  const trees = []                                  // [cx, cy, rx, ry, alt]
  for (let t = 0; t < Math.round((viewWidth + 2 * pad) / 70); t++) {
    const x = -pad + rand() * (viewWidth + 2 * pad)
    const y = yAt(near, x) + 6
    const s = (0.6 + rand() * 0.9) * sizeK
    if (rand() < 0.22) { trees.push([x, y - 34 * s, 9 * s, 38 * s, 1]); continue }
    const n = 3 + Math.floor(rand() * 3)
    for (let k = 0; k < n; k++) {
      const r = (13 + rand() * 9) * s
      trees.push([x + (k - n / 2) * 11 * s + rand() * 6, y - (12 + rand() * 22) * s, r, r, k % 2])
    }
  }
  return { key: `${viewWidth}|${horizonY}`, far, near, trees, bottom: horizonY + 4 }
}

function tracePath(ctx, pts, bottom) {
  ctx.beginPath()
  ctx.moveTo(pts[0][0], bottom); ctx.lineTo(pts[0][0], pts[0][1])
  for (let i = 0; i < pts.length - 1; i++) {      // Catmull-Rom -> bezier, same smoothing as scenery.js
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2
    ctx.bezierCurveTo(
      p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6,
      p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6,
      p2[0], p2[1],
    )
  }
  ctx.lineTo(pts[pts.length - 1][0], bottom)
  ctx.closePath()
}

function drawBackdrop(ctx, camera, palette) {
  const { viewWidth, horizonY, panX } = camera
  if (!backdrop || backdrop.key !== `${viewWidth}|${horizonY}`) backdrop = buildBackdrop(viewWidth, horizonY)

  ctx.save()
  ctx.translate(-panX * BACKDROP_PARALLAX, 0)
  ctx.fillStyle = palette.far; tracePath(ctx, backdrop.far, backdrop.bottom); ctx.fill()
  ctx.fillStyle = palette.ramp(0); tracePath(ctx, backdrop.near, backdrop.bottom); ctx.fill()
  for (const alt of [0, 1]) {
    ctx.fillStyle = alt ? palette.tree2 : palette.tree
    ctx.beginPath()
    for (const [cx, cy, rx, ry, a] of backdrop.trees) {
      if (a !== alt) continue
      ctx.moveTo(cx + rx, cy); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU)
    }
    ctx.fill()
  }
  ctx.restore()
}