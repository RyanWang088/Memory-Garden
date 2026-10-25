// "Good morning" / "Good afternoon" / "Good evening" by the local clock
export function greeting(now = new Date()) {
  const h = now.getHours()
  return h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}
// "Sunday 25 October 2026"
export const longDate = (now = new Date()) =>
  now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
// the sky mood that matches the time of day (for pages drawn with <SceneryBackdrop>)
export function moodNow(now = new Date()) {
  const h = now.getHours()
  return h < 6 || h >= 21 ? 'night' : h < 9 ? 'morning' : h < 17 ? 'day' : 'dusk'
}
