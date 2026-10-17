// Which picture a plant shows: stages 1-8 match the columns of the flower sprite sheet.
//   1 seed  2 sprout  3 bud  4 bloom          <- growing, from mastery
//   5 drooping  6 bent over  7 fallen  8 dead stub   <- wilting, from days without a quiz
// A wilting sprout stays at stage 2 (with brown leaves) before it dies, so use isWilting(), not the stage number.
// Wilting is worked out from last_reviewed, so nothing extra is stored: doing a quiz
// resets last_reviewed and the plant goes straight back to its growing stage.
const DAY = 86_400_000
export const WILT_EVERY_DAYS = 3

// each growing stage -> the stages it passes through, one step per WILT_EVERY_DAYS without a quiz
const WILT_PATH = {
  1: [1],
  2: [2, 2, 8],
  3: [3, 6, 7, 8],
  4: [4, 5, 6, 7, 8],
}

export function growthStage(seed) {
  if (!seed.last_reviewed) return 1 // planted, never quizzed
  const mastery = seed.mastery ?? 0
  return mastery < 34 ? 2 : mastery < 67 ? 3 : 4
}

// how many WILT_EVERY_DAYS have passed without a quiz
function wiltSteps(seed, now) {
  if (!seed.last_reviewed) return 0
  return Math.max(0, Math.floor((now - new Date(seed.last_reviewed)) / (WILT_EVERY_DAYS * DAY)))
}

export function plantStage(seed, now = Date.now()) {
  const path = WILT_PATH[growthStage(seed)]
  return path[Math.min(wiltSteps(seed, now), path.length - 1)]
}

// a seed (stage 1) never wilts
export const isWilting = (seed, now = Date.now()) => growthStage(seed) > 1 && wiltSteps(seed, now) > 0
