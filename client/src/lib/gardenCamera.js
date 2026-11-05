import { CELL_SIZE, GRID_COLS, GRID_ROWS, GRID_WIDTH } from './floorLayout.js'

export const SCROLL_RANGE = 1500
export const PLANT_CANVAS_SIZE = 150
export const SHADOW_ROOM = 30
export const BOTTOM_MARGIN = 24
export const HALF_PI = Math.PI / 2
export const FILL = 0.96
export const MIN_SCALE = 0.6
export const MOBILE_MIN_SCALE = 0.8
export const FAR_SPREAD = 0.7
export const FAR_SIZE = 0.35
export const MEADOW_HEIGHT = 0.55 // share of the view the meadow fills below the horizon; the rest is open sky

export function createGardenCamera() {
  const camera = { viewWidth: 400, viewHeight: 700, scale: 1, contentWidth: 400, frontY: 0, radius: 0, horizonY: 0, scrollPos: 0, panX: 0, centerX: 0 }
  const screenPoint = {}

  // Minor adjustment: Use an exponent < 1 (e.g., 0.7) so the bottom/middle 
  // stays wide and spreads out longer before gently tapering off near the horizon.
  const shrinkTo = (farValue, angle) => {
    const t = Math.max(0, Math.cos(angle))
    const eased = Math.pow(t, 0.7) 
    return farValue + (1 - farValue) * eased
  }

  const depthToAngle = depth => ((depth - camera.scrollPos) * camera.scale) / camera.radius
  const screenY = angle => camera.frontY - camera.radius * Math.sin(angle)
  const screenX = (worldX, angle) =>
    camera.viewWidth / 2 + (worldX - camera.centerX) * camera.scale * shrinkTo(FAR_SPREAD, angle)

  const worldToScreen = (worldX, depth) => {
    const angle = depthToAngle(depth)
    if (angle < -0.3) return false
    const y = screenY(angle), scale = camera.scale * shrinkTo(FAR_SIZE, angle)
    const hiddenPx = angle > HALF_PI ? (y - camera.horizonY) / scale : -SHADOW_ROOM
    if (hiddenPx > PLANT_CANVAS_SIZE) return false
    Object.assign(screenPoint, { 
      x: screenX(worldX, angle), 
      y, 
      scale, 
      clipped: hiddenPx, 
      zIndex: 2000 + Math.round(angle * 500) 
    })
    return true
  }

  const screenToCell = (pixelX, pixelY) => {
    const heightAboveFront = camera.frontY - pixelY
    if (heightAboveFront < 0 || heightAboveFront > camera.radius * 0.97) return null
    const angle = Math.asin(heightAboveFront / camera.radius)
    const worldX = camera.centerX + (pixelX - camera.viewWidth / 2) / (camera.scale * shrinkTo(FAR_SPREAD, angle))
    const depth = camera.scrollPos + (camera.radius * angle) / camera.scale
    const col = Math.floor(worldX / CELL_SIZE), row = Math.floor(depth / CELL_SIZE)
    return col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS ? null : { col, row }
  }

  const measure = (viewWidth, viewHeight) => {
    camera.viewWidth = viewWidth
    camera.viewHeight = viewHeight
    camera.scale = Math.max(viewWidth < 600 ? MOBILE_MIN_SCALE : MIN_SCALE, (viewWidth * FILL) / GRID_WIDTH)
    camera.contentWidth = GRID_WIDTH * camera.scale + viewWidth * (1 - FILL)
    camera.frontY = viewHeight - BOTTOM_MARGIN
    camera.radius = camera.frontY * MEADOW_HEIGHT
    camera.horizonY = camera.frontY - camera.radius
  }

  const updateScroll = (scrollTop, scrollLeft) => {
    camera.scrollPos = Math.min(SCROLL_RANGE, Math.max(0, SCROLL_RANGE - scrollTop))
    camera.panX = scrollLeft - (camera.contentWidth - camera.viewWidth) / 2
    camera.centerX = GRID_WIDTH / 2 + camera.panX / camera.scale
  }

  return { camera, measure, updateScroll, depthToAngle, screenX, screenY, shrinkTo, worldToScreen, screenToCell, screenPoint }
}