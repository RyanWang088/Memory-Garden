import { 
  GRID_WIDTH, HILL_GAP, HILL_SAMPLE_GAP, PROPS_BY_HILL, hillEdgeDepth,
} from './floorLayout.js'
import { seeded } from './shuffle.js'
import { HALF_PI, BOTTOM_MARGIN, FAR_SPREAD, FAR_SIZE } from './gardenCamera.js'
import treeSvg from '@/assets/foliage/meadow-tree.svg?raw'
import shrubSvg from '@/assets/foliage/meadow-shrub.svg?raw'

const TAU = Math.PI * 2
const BLADE_GAP = 25          // world units between grass blades along a crest
const BACKDROP_PARALLAX = 0.12  // how far the horizon ridges follow sideways panning
const FLOWER_START = -.1        // no flowers above this fraction of the way down the ground (0 = horizon, 1 = bottom)
const FLOWER_FULL = 0.8         // every flower is drawn by here
const FLOWER_NIGHT_MIX = 0.7    // at full night, how far flowers are mixed toward the hill colour (0..1)
const FLOWER_MAX_MIX = 0.85     // never mix further than this, or the flowers vanish into the hill
const SPRITES = {
  tree: parseSprite(treeSvg),
  shrub: parseSprite(shrubSvg),
}

function parseSprite(svg) {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
  const root = doc.documentElement
  const viewBox = root.getAttribute('viewBox').split(/\s+/).map(Number)
  const paths = [...root.querySelectorAll('path[data-tone]')]
    .filter(element => element.getAttribute('data-tone') !== 'outline'
      && !(element.hasAttribute('stroke-width') && !element.hasAttribute('fill')))
    .map(element => ({
      path: new Path2D(element.getAttribute('d')),
      tone: element.getAttribute('data-tone'),
      fill: element.getAttribute('fill') !== 'none',
      opacity: Number(element.getAttribute('opacity')) || 1,
    }))
  return { x: viewBox[0], y: viewBox[1], width: viewBox[2], height: viewBox[3], paths }
}

// ---- colour mixing ----
const colorCache = new Map()
function parseColor(c) {
  let v = colorCache.get(c)
  if (v) return v
  if (c[0] === '#') {
    const h = c.length === 4 ? c.slice(1).split('').map(x => x + x).join('') : c.slice(1, 7)
    v = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16))
  } else {
    v = (c.match(/-?[\d.]+(?:e-?\d+)?/g) || [0, 0, 0]).slice(0, 3).map(Number)
    if (c.startsWith('color(')) v = v.map(n => n * 255)
  }
  if (colorCache.size > 500) colorCache.clear()
  colorCache.set(c, v)
  return v
}
function mixColor(a, b, t) {
  const A = parseColor(a), B = parseColor(b)
  return `rgb(${Math.round(A[0] + (B[0] - A[0]) * t)},${Math.round(A[1] + (B[1] - A[1]) * t)},${Math.round(A[2] + (B[2] - A[2]) * t)})`
}

export function drawMeadow(ctx, cam, palette) {
  const { camera, depthToAngle, screenX, screenY } = cam
  const { viewWidth, viewHeight, radius, horizonY, frontY, scale, scrollPos, centerX } = camera
  const span = frontY - horizonY
  const floorAngle = depth => Math.min(HALF_PI, depthToAngle(depth))

  drawBackdrop(ctx, camera, palette)

  ctx.fillStyle = palette.ramp(0)
  ctx.fillRect(0, horizonY, viewWidth, viewHeight - horizonY)

  const firstDepth = scrollPos - (BOTTOM_MARGIN * 2) / scale
  const lastDepth = scrollPos + (HALF_PI * radius) / scale
  const halfVisible = viewWidth / (2 * scale * FAR_SPREAD)
  const x0 = Math.floor((centerX - halfVisible) / HILL_SAMPLE_GAP) * HILL_SAMPLE_GAP
  const x1 = centerX + halfVisible + HILL_SAMPLE_GAP
  const aFront = floorAngle(firstDepth)
  const frame = {
    span, horizonY, firstDepth, lastDepth, floorAngle, x0, x1, viewWidth,
    treeFill: palette.tree, treeShade: palette.ramp(1), treeHighlight: palette.ramp(0.6),
  }

  for (let hill = Math.ceil((lastDepth + 100) / HILL_GAP); hill >= Math.floor(firstDepth / HILL_GAP); hill--) {
    const mid = hillEdgeDepth(hill, GRID_WIDTH / 2)
    if (mid < firstDepth - 120) continue
    const y = screenY(floorAngle(mid))
    const rawT = (y - horizonY) / span
    const t = Math.min(1, Math.pow(rawT, 0.6))
    ctx.fillStyle = palette.ramp(t)
    ctx.beginPath()
    for (let x = x0; x <= x1; x += HILL_SAMPLE_GAP) {
      const a = floorAngle(hillEdgeDepth(hill, x))
      ctx.lineTo(screenX(x, a), screenY(a))
    }
    ctx.lineTo(screenX(x1, aFront), screenY(aFront)); ctx.lineTo(screenX(x0, aFront), screenY(aFront))
    ctx.fill()

    drawFringe(ctx, cam, hill, frame)
    drawBand(ctx, cam, palette, PROPS_BY_HILL.get(hill), frame, palette.ramp(t))
  }
}

function hash(a, b) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

function drawFringe(ctx, cam, hill, { floorAngle, x0, x1 }) {
  const { camera, screenX, screenY, shrinkTo } = cam
  const midAngle = floorAngle(hillEdgeDepth(hill, GRID_WIDTH / 2))
  if (midAngle >= HALF_PI * 0.97) return
  const u0 = camera.scale * shrinkTo(FAR_SIZE, midAngle)
  if (u0 < 0.26) return
  const step = u0 < 0.5 ? 2 : 1

  ctx.beginPath()
  for (let j = Math.floor(x0 / BLADE_GAP); j <= Math.ceil(x1 / BLADE_GAP); j += step) {
    const x = (j + hash(hill, j * 3) * 0.8) * BLADE_GAP
    const a = floorAngle(hillEdgeDepth(hill, x))
    if (a >= HALF_PI) continue
    const u = camera.scale * shrinkTo(FAR_SIZE, a)
    const px = screenX(x, a), py = screenY(a) + 2 * u
    const h = (15 + hash(hill, j * 3 + 1) * 25) * u, lean = (hash(hill, j * 3 + 2) - 0.5) * 20 * u, w = Math.max(0.8, 3 * u)
    ctx.moveTo(px - w, py)
    ctx.quadraticCurveTo(px + lean / 2, py - h * 0.6, px + lean, py - h)
    ctx.quadraticCurveTo(px + lean / 3, py - h * 0.4, px + w, py)
  }
  ctx.fill()
}

function drawBand(ctx, cam, palette, props, { span, horizonY, firstDepth, lastDepth, viewWidth, treeFill, treeShade, treeHighlight }, hillColor) {
  if (!props) return
  const { camera, depthToAngle, screenX, screenY, shrinkTo } = cam
  const { scale } = camera

  const night = 1 - Math.min(1, Math.max(0, (palette.flowerAlpha - 0.55) / 0.45))
  const mix = Math.min(FLOWER_MAX_MIX, night * FLOWER_NIGHT_MIX + (palette.wxK || 0))
  const petals = palette.flowers.map(c => mixColor(c, hillColor, mix))
  const eye = mixColor(palette.flowerEye, hillColor, mix)

  for (let i = 0; i < props.length; i++) {
    const p = props[i]
    if (p.d < firstDepth || p.d > lastDepth) continue
    const a = depthToAngle(p.d)
    if (a < -0.05 || a > HALF_PI * 0.985) continue
    const px = screenX(p.x, a)
    if (px < -160 || px > viewWidth + 160) continue
    const py = screenY(a)
    const u = scale * shrinkTo(FAR_SIZE, a) * p.s

    if (p.k === 'flower') {
      const rawT = (py - horizonY) / span
      const k = Math.min(1, Math.max(0, (rawT - FLOWER_START) / (FLOWER_FULL - FLOWER_START)))
      if (hash(i, 7) >= k * k) continue

      const r = Math.max(0.9, 4.6 * u)
      ctx.fillStyle = petals[p.c]
      ctx.beginPath(); ctx.arc(px, py - r, r, 0, TAU); ctx.fill()

      if (r > 2.6) {
        ctx.fillStyle = eye
        ctx.beginPath(); ctx.arc(px, py - r, r * 0.35, 0, TAU)
        ctx.fill()
      }
    } else {
      const width = 108 * u
      const height = 64 * u
      drawSprite(ctx, SPRITES.shrub, px, py, width, height, treeFill, treeShade, treeHighlight)
    }
  }
}

let backdrop = null

function drawSprite(ctx, sprite, x, baseline, width, height, fill, shade, highlight, tree2) {
  ctx.save()
  ctx.translate(x - width / 2, baseline - height)
  ctx.scale(width / sprite.width, height / sprite.height)
  ctx.translate(-sprite.x, -sprite.y)
  for (const item of sprite.paths) {
    ctx.globalAlpha = item.opacity
    const color = item.tone === 'shade'
      ? shade
      : item.tone === 'highlight' ? highlight
        : item.tone === 'trunk' ? tree2 : fill
    if (item.fill) {
      ctx.fillStyle = color
      ctx.fill(item.path)
    }
  }
  ctx.globalAlpha = 1
  ctx.restore()
}

function buildBackdrop(viewWidth, horizonY) {
  const rand = seeded(12)
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
  const near = ridge(horizonY, room * 0.3, 1.1)
  const yAt = (pts, x) => {
    for (let i = 0; i < pts.length - 1; i++) {
      if (x >= pts[i][0] && x <= pts[i + 1][0]) return pts[i][1] + (pts[i + 1][1] - pts[i][1]) * ((x - pts[i][0]) / (pts[i + 1][0] - pts[i][0]))
    }
    return pts[pts.length - 1][1]
  }
  const sizeK = Math.min(1, Math.max(0.45, room / 160))
  const trees = []
  for (let t = 0; t < Math.round((viewWidth + 2 * pad) / 40); t++) {
    const x = -pad + rand() * (viewWidth + 4* pad)
    const y = yAt(near, x) +10
    const s = (.5 + rand()) * sizeK
    
    const type = rand() < 0.3 ? 'shrub' : 'tree'
    trees.push({
      type, x, baseline: y,
      width: (type === 'shrub' ? 45 : 82) * s,
      height: (type === 'shrub' ? 25 : 72) * s,
    })
  }
  return { key: `${viewWidth}|${horizonY}`, near, trees, bottom: horizonY + 4 }
}

function tracePath(ctx, pts, bottom) {
  ctx.beginPath()
  ctx.moveTo(pts[0][0], bottom); ctx.lineTo(pts[0][0], pts[0][1])
  for (let i = 0; i < pts.length - 1; i++) {
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
  ctx.fillStyle = palette.ramp(0); tracePath(ctx, backdrop.near, backdrop.bottom); ctx.fill()
  for (const tree of backdrop.trees) {
    drawSprite(
      ctx, SPRITES[tree.type], tree.x, tree.baseline, tree.width, tree.height,
      palette.ramp(.8), palette.tree, palette.ramp(0.6),
      palette.tree2,
    )
  }
  ctx.restore()
}