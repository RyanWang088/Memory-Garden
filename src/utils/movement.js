import { resolveCollisions, clampToBounds } from './collision'

/**
 * Converts a screen-space input vector (x right, y down) to a world-space
 * direction, so "up" always means "up the screen" whatever the camera yaw is.
 */
export function inputToWorld(ix, iy, yawDeg) {
  const a = (yawDeg * Math.PI) / 180
  const c = Math.cos(a)
  const s = Math.sin(a)
  return { x: ix * c + iy * s, y: -ix * s + iy * c }
}

/**
 * Advances the player one frame. `input` is screen-space and may be analog
 * (joystick) or digital (keys). Returns true when the player is moving.
 */
export function stepPlayer(player, input, yawDeg, dt, { colliders, bounds, speed, radius }) {
  let { x: ix, y: iy } = input
  const mag = Math.hypot(ix, iy)
  if (mag < 0.05) return false
  if (mag > 1) {
    ix /= mag
    iy /= mag
  }
  const v = inputToWorld(ix, iy, yawDeg)
  player.x += v.x * speed * dt
  player.y += v.y * speed * dt
  resolveCollisions(player, radius, colliders)
  clampToBounds(player, bounds)
  return true
}
