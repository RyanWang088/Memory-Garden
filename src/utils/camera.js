import { CAMERA } from '@/world/config'
import { clamp } from './collision'

export function createCamera(x = 0, y = 0) {
  return { x, y, yaw: 0, tilt: CAMERA.tilt }
}

/**
 * Eases the camera toward the player and drives the slight orbit.
 * turn  -1..1 horizontal steering, adds a gentle sway while walking
 * orbit -1..1 manual orbit (drag or keys), springs back to 0 on release
 */
export function stepCamera(cam, { targetX, targetY, turn = 0, orbit = 0, sway = true }, dt) {
  const follow = 1 - Math.exp(-dt * 9)
  cam.x += (targetX - cam.x) * follow
  cam.y += (targetY - cam.y) * follow
  const want = clamp(orbit * CAMERA.orbitDeg + (sway ? turn * CAMERA.swayDeg : 0), -CAMERA.maxYaw, CAMERA.maxYaw)
  cam.yaw += (want - cam.yaw) * (1 - Math.exp(-dt * 3.5))
  return cam
}

/** Derives zoom / perspective / anchor from the viewport so the map fits any screen. */
export function computeView(w, h) {
  const portrait = h > w
  return {
    zoom: clamp(Math.min(w / 860, h / 640), 0.55, 1.3),
    perspective: clamp(Math.max(w, h) * 0.9, 700, 1500),
    anchorY: portrait ? 0.54 : 0.6,
    tilt: portrait ? 56 : CAMERA.tilt,
  }
}
