// STUB: distant backdrop (hills, tree line...) that sits on the horizon, above the meadow.
// Slot your image in by setting BACKDROP_SRC, e.g.
//   import backdropUrl from '@/assets/backdrop.png'
//   export const BACKDROP_SRC = backdropUrl
// Leave it empty and nothing is drawn (the Skybox shows through).
export const BACKDROP_SRC = ''

// How the image sits: full width, bottom edge on the horizon. Nudge BACKDROP_DROP down
// (px) if your image has transparent padding at the bottom.
export const BACKDROP_DROP = 2

export function loadBackdrop(onReady) {
  if (!BACKDROP_SRC || typeof Image === 'undefined') return null
  const img = new Image()
  img.onload = () => onReady?.()
  img.src = BACKDROP_SRC
  return img
}

export function drawBackdrop(ctx, camera, img) {
  if (!img || !img.complete || !img.naturalWidth) return
  const w = camera.viewWidth, h = w * (img.naturalHeight / img.naturalWidth)
  ctx.drawImage(img, 0, camera.horizonY + BACKDROP_DROP - h, w, h)
}