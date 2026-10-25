// Local coordinates: origin = the log's ground contact point (bottom centre).
export const LOG_VIEWBOX = { x: -44, y: -42, w: 88, h: 48 }

const MUSHROOMS = [
  // x, stem height, cap radius, cap colour
  [-8, 12, 9, '#E8534A'],
  [4, 9, 7, '#FFE484'],
  [14, 7, 6, '#F27A8E'],
]

const mushroomSvg = MUSHROOMS.map(([mx, mh, mr, color]) => {
  const top = -(22 + mh)
  return `<rect x="${mx - 1.5}" y="${top}" width="3" height="${mh}" fill="#FFF7F0"/>` +
         `<path d="M${mx - mr} ${top}A${mr} ${mr * 0.7} 0 0 1 ${mx + mr} ${top}Z" fill="${color}"/>`
}).join('')

export const LOG_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${LOG_VIEWBOX.x} ${LOG_VIEWBOX.y} ${LOG_VIEWBOX.w} ${LOG_VIEWBOX.h}" width="${LOG_VIEWBOX.w * 4}" height="${LOG_VIEWBOX.h * 4}">` +
  `<ellipse cx="0" cy="0" rx="42" ry="6" fill="rgba(60,70,20,.18)"/>` +
  `<rect x="-34" y="-22" width="68" height="22" rx="6" fill="#8A5A44"/>` +
  `<ellipse cx="34" cy="-11" rx="6" ry="11" fill="#D9A97C"/>` +
  mushroomSvg +
  `</svg>`

// Returns an Image (or null outside the browser). onReady fires once it has decoded.
export function loadLogSprite(onReady) {
  if (typeof Image === 'undefined') return null
  const img = new Image()
  img.onload = () => onReady?.()
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(LOG_SVG)
  return img
}

// Draws the log with its ground point at (x, y). `u` is the same size unit the tufts use.
export function drawLog(ctx, img, x, y, u) {
  if (!img || !img.complete || !img.naturalWidth) return
  ctx.drawImage(img, x + LOG_VIEWBOX.x * u, y + LOG_VIEWBOX.y * u, LOG_VIEWBOX.w * u, LOG_VIEWBOX.h * u)
}