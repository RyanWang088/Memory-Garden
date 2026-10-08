export const WORLD = { width: 1600, height: 1100, margin: 90 }

export const PLAZA = { x: 800, y: 600, r: 170 }
export const FOUNTAIN = { x: 800, y: 600, r: 46 }
export const SPAWN = { x: 870, y: 720 }

export const PLAYER = { radius: 14, speed: 250 } // speed in world px per second

export const CAMERA = {
  tilt: 58, // degrees the ground is tipped back
  maxYaw: 30, // the orbit never leaves +/- this, billboards look flat beyond it
  orbitDeg: 24, // yaw reached by a full drag / orbit key press
  swayDeg: 12, // extra yaw while steering left or right
}

export const PATH_WIDTH = 56
export const TRIGGER_RADIUS = 120
