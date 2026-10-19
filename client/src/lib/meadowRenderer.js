import {
  GRID_WIDTH, HILL_GAP, HILL_SAMPLE_GAP, RIM_COLOR, PATH_COLOR, PATH_EDGE_COLOR, PATH_STEP, PATH_EDGE_WIDTH,
  PROPS, STONES, STONE_SHADOW_COLOR,
  fogColor, hillEdgeDepth, pathCenterX, pathHalfWidth,
} from './floorLayout.js'
import { HALF_PI, BOTTOM_MARGIN, FAR_SPREAD, FAR_SIZE } from './gardenCamera.js'
import { drawLog } from './logSprite.js'

const TAU = Math.PI * 2

// The meadow is drawn on two canvases. The caller has already set the DPR transform and cleared each one.
//   cam    = createGardenCamera() result
//   assets = { logImg: Image|null }

// depths on screen, from just below the front edge to the horizon
function visibleDepths(camera) {
  const { radius, scale, scrollPos } = camera
  return { firstDepth: scrollPos - (BOTTOM_MARGIN * 2) / scale, lastDepth: scrollPos + (HALF_PI * radius) / scale }
}

// Ground: hills, path and cobblestones. Changes only when the camera moves.
export function drawGround(ctx, cam) {
  const { camera, depthToAngle } = cam
  const { viewWidth, viewHeight, horizonY, frontY } = camera
  const floorAngle = depth => Math.min(HALF_PI, depthToAngle(depth))
  const { firstDepth, lastDepth } = visibleDepths(camera)

  // far-distance base colour: the pale end of the ramp
  ctx.fillStyle = fogColor(0)
  ctx.fillRect(0, horizonY, viewWidth, viewHeight - horizonY)

  drawHills(ctx, cam, { span: frontY - horizonY, firstDepth, lastDepth, floorAngle })
  drawPath(ctx, cam, { firstDepth, lastDepth, floorAngle })
  drawStones(ctx, cam, { firstDepth, lastDepth, floorAngle })
}

// Props: grass tufts, flower dots and logs, on a canvas above the ground. Redrawn every frame while the grass
// sways; time (seconds) sets the sway, 0 = still.
export function drawMeadowProps(ctx, cam, assets = {}, time = 0) {
  drawProps(ctx, cam, assets, visibleDepths(cam.camera), time)
}

function drawHills(ctx, cam, { span, firstDepth, lastDepth, floorAngle }) {
  const { camera, screenX, screenY } = cam
  const { horizonY, viewHeight, viewWidth, scale, centerX } = camera
  const halfVisible = viewWidth / (2 * scale * FAR_SPREAD)
  const x0 = Math.floor((centerX - halfVisible) / HILL_SAMPLE_GAP) * HILL_SAMPLE_GAP
  const x1 = centerX + halfVisible + HILL_SAMPLE_GAP
  const aFront = floorAngle(firstDepth)

  const traceCrest = (hill) => {
    for (let x = x0; x <= x1; x += HILL_SAMPLE_GAP) {
      const a = floorAngle(hillEdgeDepth(hill, x))
      ctx.lineTo(screenX(x, a), screenY(a))
    }
  }

  // far hills first, nearer ones paint over them
  for (let hill = Math.ceil((lastDepth + 150) / HILL_GAP); hill >= Math.floor(firstDepth / HILL_GAP); hill--) {
    const mid = hillEdgeDepth(hill, GRID_WIDTH / 2)
    if (mid < firstDepth - 100) continue
    const y = screenY(floorAngle(mid)), t = (y - horizonY) / span
    const y0 = Math.max(horizonY, Math.min(viewHeight, y))

    const g = ctx.createLinearGradient(0, y0, 0, y0 + span * 0.3)
    g.addColorStop(0, fogColor(t)); g.addColorStop(1, fogColor(t + 0.3))
    ctx.fillStyle = g
    ctx.beginPath(); traceCrest(hill)
    ctx.lineTo(screenX(x1, aFront), screenY(aFront)); ctx.lineTo(screenX(x0, aFront), screenY(aFront))
    ctx.fill()

    ctx.strokeStyle = RIM_COLOR; ctx.lineWidth = 1.4
    ctx.beginPath(); traceCrest(hill); ctx.stroke()
  }
}

function drawPath(ctx, cam, { firstDepth, lastDepth, floorAngle }) {
  const { screenX, screenY } = cam
  for (const [color, outline] of [[PATH_EDGE_COLOR, PATH_EDGE_WIDTH], [PATH_COLOR, 0]]) {
    ctx.fillStyle = color
    for (let d = Math.floor(firstDepth / PATH_STEP) * PATH_STEP; d < lastDepth; d += PATH_STEP) {
      const n = d + PATH_STEP + 1
      const c0 = pathCenterX(d), c1 = pathCenterX(n)
      const h0 = pathHalfWidth(d) + outline, h1 = pathHalfWidth(n) + outline
      const a0 = floorAngle(d), a1 = floorAngle(n)
      ctx.beginPath()
      ctx.moveTo(screenX(c0 - h0, a0), screenY(a0)); ctx.lineTo(screenX(c0 + h0, a0), screenY(a0))
      ctx.lineTo(screenX(c1 + h1, a1), screenY(a1)); ctx.lineTo(screenX(c1 - h1, a1), screenY(a1))
      ctx.fill()
    }
  }
}

// Cobblestones: flat ellipses on the floor, sized in world units so they shrink and squash with distance.
// Each gets a darker copy just below it as its shadow.
function drawStones(ctx, cam, { firstDepth, lastDepth, floorAngle }) {
  const { screenX, screenY } = cam
  for (let i = STONES.length - 1; i >= 0; i--) {
    const s = STONES[i]
    if (s.d < firstDepth || s.d > lastDepth) continue
    const a = floorAngle(s.d)
    if (a < -0.05 || a > HALF_PI * 0.985) continue
    const cx = screenX(s.x, a), cy = screenY(a)
    const rx = (screenX(s.x + s.rx, a) - screenX(s.x - s.rx, a)) / 2
    const ry = Math.abs(screenY(floorAngle(s.d - s.rz)) - screenY(floorAngle(s.d + s.rz))) / 2
    if (ry < 0.5) continue
    ctx.fillStyle = STONE_SHADOW_COLOR
    ctx.beginPath(); ctx.ellipse(cx, cy + ry * 0.35, rx, ry, 0, 0, TAU); ctx.fill()
    ctx.fillStyle = s.c
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU); ctx.fill()
  }
}

// Tuft: three upward strokes whose bases are spaced apart so each blade reads on its own.
const TUFT_BLADES = [
  // base x, tip x, height factor
  [-5, -8, 0.85],
  [0, 0.5, 1.1],
  [5, 8.5, 0.8],
]

// Sway of a tuft's tips, in blade units: a quick flutter that varies by position, plus a slow breeze
// rolling across the meadow. Blades bend in proportion to their height.
const swayAt = (p, time) =>
  time && 1.6 * Math.sin(time * 1.8 + p.x * 0.013 + p.d * 0.007) + 1.2 * Math.sin(time * 0.7 + p.x * 0.004)

function drawProps(ctx, cam, assets, { firstDepth, lastDepth }, time) {
  const { camera, depthToAngle, screenX, screenY, shrinkTo } = cam
  const { scale } = camera
  ctx.lineCap = 'round'
  // PROPS is sorted near -> far; paint far first
  for (let i = PROPS.length - 1; i >= 0; i--) {
    const p = PROPS[i]
    if (p.d < firstDepth || p.d > lastDepth) continue
    const a = depthToAngle(p.d)
    if (a < -0.05 || a > HALF_PI * 0.985) continue
    const px = screenX(p.x, a), py = screenY(a)
    const far = shrinkTo(FAR_SIZE, a), u = scale * far * p.s

    if (p.k === 'tuft') {
      const h = 20 * u, sway = swayAt(p, time)
      ctx.strokeStyle = `rgba(84,128,42,${0.3 + 0.5 * Math.cos(a)})`
      ctx.lineWidth = Math.max(0.8, 1.3 * far * p.s)
      ctx.beginPath()
      for (const [bx, tx, hf] of TUFT_BLADES) {
        ctx.moveTo(px + bx * u * 0.5, py)
        ctx.lineTo(px + (tx + sway * hf) * u * 0.5, py - h * hf)
      }
      ctx.stroke()
    } else if (p.k === 'flower') {
      ctx.fillStyle = p.c
      ctx.beginPath(); ctx.arc(px, py - 2 * u, Math.max(1.1, 4 * u), 0, TAU); ctx.fill()
    } else if (p.k === 'log') {
      drawLog(ctx, assets.logImg, px, py, u)
    }
  }
}