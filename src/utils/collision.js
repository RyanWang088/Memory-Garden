// Pure geometry helpers. Colliders are plain objects:
//   { type: 'rect', x, y, w, h }   (x, y = top-left)
//   { type: 'circle', x, y, r }
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

function pushOutOfRect(pos, r, c) {
  const nx = clamp(pos.x, c.x, c.x + c.w)
  const ny = clamp(pos.y, c.y, c.y + c.h)
  const dx = pos.x - nx
  const dy = pos.y - ny
  const d2 = dx * dx + dy * dy
  if (d2 >= r * r) return false
  if (d2 > 1e-8) {
    const d = Math.sqrt(d2)
    const k = (r - d) / d
    pos.x += dx * k
    pos.y += dy * k
    return true
  }
  // centre is inside the rect: leave through the nearest edge
  const left = pos.x - c.x
  const right = c.x + c.w - pos.x
  const top = pos.y - c.y
  const bottom = c.y + c.h - pos.y
  const m = Math.min(left, right, top, bottom)
  if (m === left) pos.x = c.x - r
  else if (m === right) pos.x = c.x + c.w + r
  else if (m === top) pos.y = c.y - r
  else pos.y = c.y + c.h + r
  return true
}

function pushOutOfCircle(pos, r, c) {
  const dx = pos.x - c.x
  const dy = pos.y - c.y
  const d = Math.hypot(dx, dy)
  const min = r + c.r
  if (d >= min) return false
  if (d < 1e-6) {
    pos.y = c.y + min
    return true
  }
  pos.x = c.x + (dx / d) * min
  pos.y = c.y + (dy / d) * min
  return true
}

/** Pushes a circle (pos, radius) out of every collider. Mutates and returns pos. */
export function resolveCollisions(pos, radius, colliders, iterations = 3) {
  for (let i = 0; i < iterations; i++) {
    let hit = false
    for (const c of colliders) {
      if (c.type === 'rect' ? pushOutOfRect(pos, radius, c) : pushOutOfCircle(pos, radius, c)) hit = true
    }
    if (!hit) break
  }
  return pos
}

export function clampToBounds(pos, b) {
  pos.x = clamp(pos.x, b.minX, b.maxX)
  pos.y = clamp(pos.y, b.minY, b.maxY)
  return pos
}

export function overlapsAny(pos, radius, colliders) {
  const probe = { x: pos.x, y: pos.y }
  resolveCollisions(probe, radius, colliders, 1)
  return Math.hypot(probe.x - pos.x, probe.y - pos.y) > 1e-6
}

export function distToSegment(px, py, ax, ay, bx, by) {
  const vx = bx - ax
  const vy = by - ay
  const len2 = vx * vx + vy * vy || 1
  const t = clamp(((px - ax) * vx + (py - ay) * vy) / len2, 0, 1)
  return Math.hypot(px - (ax + vx * t), py - (ay + vy * t))
}
