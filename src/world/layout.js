import { WORLD, PLAZA, FOUNTAIN, SPAWN, PLAYER } from './config'
import { structures } from './locations'
import { distToSegment } from '@/utils/collision'

function mulberry32(a) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^  (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Straight paths from the plaza to every door. */
export const paths = structures.map((l) => ({
  id: l.id,
  ax: PLAZA.x,
  ay: PLAZA.y,
  bx: l.stand.x,
  by: l.stand.y,
}))

function footprint(loc) {
  if (loc.patch) {
    return { x: loc.pos.x - loc.patch.w / 2, y: loc.pos.y - loc.patch.d / 2, w: loc.patch.w, h: loc.patch.d }
  }
  const { w, d } = loc.collider || { w: 80, d: 40 }
  return { x: loc.pos.x - w / 2, y: loc.pos.y - d, w, h: d }
}

const inflated = (r, m) => ({ x: r.x - m, y: r.y - m, w: r.w + m * 2, h: r.h + m * 2 })
const insideRect = (x, y, r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h

function isClear(x, y, placed) {
  if (Math.hypot(x - PLAZA.x, y - PLAZA.y) < PLAZA.r + 70) return false
  if (Math.hypot(x - SPAWN.x, y - SPAWN.y) < 160) return false
  for (const loc of structures) {
    if (insideRect(x, y, inflated(footprint(loc), 110))) return false
    if (Math.hypot(x - loc.stand.x, y - loc.stand.y) < 140) return false
  }
  for (const p of paths) if (distToSegment(x, y, p.ax, p.ay, p.bx, p.by) < 80) return false
  for (const t of placed) if (Math.hypot(x - t.x, y - t.y) < 110) return false
  return true
}

export function generateTrees(seed = 7, count = 34) {
  const rand = mulberry32(seed)
  const pad = WORLD.margin + 40
  const out = []
  for (let tries = 0; out.length < count && tries < 5000; tries++) {
    const x = pad + rand() * (WORLD.width - pad * 2)
    const y = pad + rand() * (WORLD.height - pad * 2)
    if (!isClear(x, y, out)) continue
    out.push({
      id: `tree-${out.length}`,
      x: Math.round(x),
      y: Math.round(y),
      s: +(0.85 + rand() * 0.5).toFixed(2),
      kind: rand() < 0.3 ? 'pine' : 'round',
    })
  }
  return out
}

export const trees = generateTrees()

export function buildColliders() {
  const list = [{ type: 'circle', x: FOUNTAIN.x, y: FOUNTAIN.y, r: FOUNTAIN.r }]
  for (const loc of structures) {
    if (!loc.collider) continue
    const { w, d } = loc.collider
    const top = loc.kind === 'pond' ? loc.pos.y - d / 2 : loc.pos.y - d
    list.push({ type: 'rect', x: loc.pos.x - w / 2, y: top, w, h: d })
  }
  for (const t of trees) list.push({ type: 'circle', x: t.x, y: t.y, r: 16 * t.s })
  return list
}

export const colliders = buildColliders()

export const bounds = {
  minX: WORLD.margin,
  maxX: WORLD.width - WORLD.margin,
  minY: WORLD.margin,
  maxY: WORLD.height - WORLD.margin,
}

export const motion = { colliders, bounds, speed: PLAYER.speed, radius: PLAYER.radius }
