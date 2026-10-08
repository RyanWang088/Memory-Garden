/** Id of the nearest location whose door the player is close enough to use, or null. */
export function nearestLocation(pos, list, radius) {
  let best = null
  let bestD = Infinity
  for (const loc of list) {
    const d = Math.hypot(pos.x - loc.stand.x, pos.y - loc.stand.y)
    if (d <= (loc.radius ?? radius) && d < bestD) {
      best = loc.id
      bestD = d
    }
  }
  return best
}
