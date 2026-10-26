// Timer sounds made with the Web Audio API, so no sound file is needed:
//   beep - short soft beep (countdown)
//   ting - small bell (time's up)
// Sounds are booked ahead (`at` = seconds from now), which keeps them exactly in time and still on
// time when the tab is in the background. `at` is converted to the moment you'd hear it (audioTimeIn).
let ctx = null
const booked = new Set() // sounds that haven't finished yet, so they can be cancelled

// Browsers only allow sound after the user clicks something, so call this from a click
// (e.g. Start or Resume) before booking any sounds. Safe to call many times.
export function unlockAudio() {
  ctx ??= new (window.AudioContext || window.webkitAudioContext)()
  if (ctx.state === 'suspended') ctx.resume()
}

// The audio clock only starts moving once the sound device has woken up, which can take a second
// or more (longer on Bluetooth). Booking before that made every sound late by the wake-up time,
// so wait until the speakers are really playing. Resolves at once if sound isn't unlocked yet.
export async function audioReady() {
  if (!ctx) return
  if (ctx.state !== 'running') await ctx.resume().catch(() => {})
  for (let waited = 0; waited < 3000 && !(ctx.getOutputTimestamp?.().performanceTime > 0); waited += 50) {
    await new Promise(r => setTimeout(r, 50))
  }
}

// Turns "this many seconds from now" into audio-clock time *at the speakers*. getOutputTimestamp says
// which audio-clock moment is being heard right now, so this also covers the output delay
// (Bluetooth earbuds can lag ~0.2 s). Falls back to the plain clock where it isn't available.
function audioTimeIn(seconds) {
  const ts = ctx.getOutputTimestamp?.()
  if (!ts?.performanceTime) return ctx.currentTime + seconds
  return ts.contextTime + (performance.now() - ts.performanceTime) / 1000 + seconds
}

// After a page refresh nothing has been clicked yet, so sound is blocked. This turns it on at the
// first click / tap / keypress anywhere, then runs `then` (e.g. to book the sounds again).
export function unlockOnFirstInteraction(then) {
  const EVENTS = ['click', 'touchend', 'keydown']
  const once = () => {
    EVENTS.forEach(e => window.removeEventListener(e, once, true))
    unlockAudio()
    then?.()
  }
  EVENTS.forEach(e => window.addEventListener(e, once, true))
}

// One tone: `freq` Hz, rises to `volume` (0-1) over `attack` seconds, then fades out over `length`
// seconds. The quick fade in and out stops it making a click sound.
function strike({ freq, at, length, volume, attack = 0.003 }) {
  const t = Math.max(ctx.currentTime, audioTimeIn(at))
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(volume, t + attack)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + length)
  osc.connect(gain).connect(ctx.destination)
  osc.start(t)
  osc.stop(t + length)
  booked.add(osc)
  osc.onended = () => booked.delete(osc)
}

// countdown beep
export function beep(at = 0) {
  if (ctx) strike({ freq: 880, at, length: 0.12, volume: 0.2, attack: 0.01 })
}

// TING: a bell is a few tones at odd ratios; the higher ones die away first, the lowest rings on
const BELL = [
  { ratio: 1, volume: 0.22, length: 1.6 },
  { ratio: 2.76, volume: 0.08, length: 0.9 },
  { ratio: 5.4, volume: 0.04, length: 0.45 },
]
export function ting(at = 0) {
  if (!ctx) return
  for (const p of BELL) strike({ freq: 1568 * p.ratio, at, length: p.length, volume: p.volume })
}

// DING: right answer. Two quick plucks, E6 then A6, each with a quiet octave on top
export function ding() {
  unlockAudio()
  strike({ freq: 1318.5, at: 0, length: 0.25, volume: 0.18 })
  strike({ freq: 2637, at: 0, length: 0.25, volume: 0.045 })
  strike({ freq: 1760, at: 0.08, length: 0.35, volume: 0.2 })
  strike({ freq: 3520, at: 0.08, length: 0.35, volume: 0.05 })
}

// FANFARE: quiz finished. C5 E5 G5 climb up, then land on a C6 chord, each note with a quiet octave on top
const FANFARE = [
  { freq: 523.25, at: 0, length: 0.3, volume: 0.14 },
  { freq: 659.25, at: 0.12, length: 0.3, volume: 0.14 },
  { freq: 783.99, at: 0.24, length: 0.3, volume: 0.14 },
  { freq: 1046.5, at: 0.38, length: 0.8, volume: 0.18 },
  { freq: 1318.5, at: 0.38, length: 0.8, volume: 0.1 },
  { freq: 1568, at: 0.38, length: 0.8, volume: 0.08 },
]
export function fanfare() {
  unlockAudio()
  for (const n of FANFARE) {
    strike(n)
    strike({ ...n, freq: n.freq * 2, volume: n.volume / 4 })
  }
}

// stops every booked sound that hasn't played yet (used on pause / end)
export function cancelSounds() {
  for (const osc of booked) {
    try { osc.stop() } catch { /* already stopped */ }
  }
  booked.clear()
}
