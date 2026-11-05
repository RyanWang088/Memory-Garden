// Which seeds to revise next, scored on deadline and progress. The top 6 get a "!" in the garden.
//   urgency   = 1 / (1 + daysLeft / 7)      exam today 1, in a week 0.5; no exam date NO_EXAM_URGENCY
//   weakness  = (100 - mastery) / 100
//   due       = share of cards whose next_review is empty or has passed
//   staleness = days since last review / 14 (max 1, never reviewed = 1)
//   score     = urgency * (0.5 weakness + 0.3 due + 0.2 staleness)
// Seeds whose exam has passed, with no cards, moved to the flower house, or resting after a review score 0.
const DAY = 86_400_000
export const ALERT_LIMIT = 6
const MIN_ALERT_SCORE = 0.05
const NO_EXAM_URGENCY = 0.15
const WEIGHTS = { weakness: 0.5, due: 0.3, staleness: 0.2 }

// whole days from today (UTC) to the exam; null = no exam date, -1 = exam has passed.
// Yesterday in UTC still counts as today, so a user ahead of UTC sees their own today (same rule as cleanSeed).
function daysUntil(exam_date, now) {
  if (!exam_date) return null
  const today = Date.parse(new Date(now).toISOString().slice(0, 10))
  const days = Math.round((Date.parse(exam_date) - today) / DAY)
  return days < -1 ? -1 : Math.max(0, days)
}

// A finished review rests the seed until the soonest card that review scheduled comes due, so the ratings decide
// when it returns. Cards a quiz didn't reach don't count: a seed too big for one session rests too.
function isResting(seed, now) {
  if (!seed.last_reviewed) return false
  const reviewedAt = Date.parse(seed.last_reviewed)
  const scheduled = seed.cards.map(c => Date.parse(c.next_review)).filter(at => at > reviewedAt)
  return scheduled.length > 0 && Math.min(...scheduled) > now
}

// seed: the shaped seed from SeedModel ({ exam_date, mastery, last_reviewed, cards }) -> 0..1
export function scoreSeed(seed, now = Date.now()) {
  const cards = seed.cards ?? []
  const daysLeft = daysUntil(seed.exam_date, now)
  if (!cards.length || daysLeft === -1 || seed.in_house || isResting(seed, now)) return 0

  const urgency = daysLeft === null ? NO_EXAM_URGENCY : 1 / (1 + daysLeft / 7)
  const weakness = (100 - seed.mastery) / 100
  const due = cards.filter(c => !c.next_review || Date.parse(c.next_review) <= now).length / cards.length
  const staleness = seed.last_reviewed ? Math.min((now - Date.parse(seed.last_reviewed)) / DAY / 14, 1) : 1
  return urgency * (WEIGHTS.weakness * weakness + WEIGHTS.due * due + WEIGHTS.staleness * staleness)
}

// Adds priority (score, 2 decimals) and alert (one of the top ALERT_LIMIT) to each seed.
// Ties go to the sooner exam. A seed needs at least MIN_ALERT_SCORE, so fewer than 6 may be marked.
export function markTopPriority(seeds, now = Date.now()) {
  const scored = seeds.map(seed => ({ ...seed, priority: Math.round(scoreSeed(seed, now) * 100) / 100, alert: false }))
  const examTime = (s) => s.exam_date ? Date.parse(s.exam_date) : Infinity
  scored
    .filter(s => s.priority >= MIN_ALERT_SCORE)
    .sort((a, b) => b.priority - a.priority || examTime(a) - examTime(b))
    .slice(0, ALERT_LIMIT)
    .forEach(s => { s.alert = true })
  return scored
}
