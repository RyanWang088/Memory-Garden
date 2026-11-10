import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiFetch } from '@/lib/http'
import { supabase, check } from '@/lib/supabase'
import { plantStage, isWilting } from '@/lib/plantStage'
import { BLOOM_STAGE } from '@/lib/plantSprites'
import { useAuthStore } from './auth'

export const SHELF_SLOTS = 12          // rows 1-2 of the flower house shelf
export const UNLOCKED_SHELF_SLOTS = 18 // + row 3, bought with coins
export const SHELF_UNLOCK_PRICE = 80

const MESSAGES = {
  SHELF_FULL: 'Your shelves are full. Unlock more space on your profile.',
  EXAM_NOT_OVER: "This exam isn't over yet.",
  ALREADY_CHOSEN: 'You already chose where these plants live.',
  INSUFFICIENT_COINS: 'Not enough coins for that yet.',
  NOT_AUTHENTICATED: 'Please log in again.',
}
const friendly = (e) => {
  const key = Object.keys(MESSAGES).find((k) => (e?.message ?? '').includes(k))
  return new Error(key ? MESSAGES[key] : 'Something went wrong. Please try again.')
}
const today = () => new Date().toLocaleDateString('en-CA') // local YYYY-MM-DD

// How an exam is named on screen: "WAD2 Midterm", or "WAD2 exam" for one just called "Exam" (the default)
export const examLabel = (subject, name) => (!name || name.toLowerCase() === 'exam' ? `${subject} exam` : `${subject} ${name}`)
const reviewedAt = (seed) => new Date(seed.last_reviewed ?? 0).getTime()

export const useGardenStore = defineStore('garden', () => {
  const auth = useAuthStore()
  const seeds = ref([]) // every seed, including ones moved to the flower house
  const growthRecords = ref({})
  const loaded = ref(false)

  // Seeds of an exam moved to the flower house leave the garden (they stay in the database)
  const gardenSeeds = computed(() =>
    seeds.value.filter(s => !s.in_house).sort((a, b) => (a.id < b.id ? -1 : 1))
  )
  const hasPlants = computed(() => gardenSeeds.value.length > 0)

  // The flower house: one flower per housed subject, drawn as its highest-mastery seed's flower and colour
  // (ties: the most recently reviewed). [{ id, name, shelf_slot, flower, color }]
  const housedSubjects = computed(() => {
    const best = new Map()
    for (const s of seeds.value) {
      if (!s.in_house || s.shelf_slot === null) continue
      const top = best.get(s.subject_id)
      if (!top || s.mastery > top.mastery || (s.mastery === top.mastery && reviewedAt(s) > reviewedAt(top))) best.set(s.subject_id, s)
    }
    return [...best.values()].map(s => ({ id: s.subject_id, name: s.subject, shelf_slot: s.shelf_slot, flower: s.flower, color: s.color }))
  })
  const shelfSlots = computed(() => (auth.profile?.shelf_unlocked ? UNLOCKED_SHELF_SLOTS : SHELF_SLOTS))
  const freeShelfSlots = computed(() => Math.max(0, shelfSlots.value - housedSubjects.value.length))

  // Exams whose day has passed (local time) and that haven't been asked about yet, oldest exam first.
  // [{ id, name, subject, subject_id, exam_date, shelf_slot, seedIds }]. Only exams with plants still in the garden;
  // shelf_slot is the subject's (set if an earlier exam of it is already on the shelf).
  const examsOver = computed(() => {
    const byExam = new Map()
    for (const s of gardenSeeds.value) {
      const examDay = s.exam_date?.slice(0, 10)
      if (!s.exam_id || !examDay || s.exam_choice || examDay >= today()) continue
      const exam = byExam.get(s.exam_id) ?? {
        id: s.exam_id, name: s.exam_name, subject: s.subject, subject_id: s.subject_id, exam_date: examDay, shelf_slot: s.shelf_slot, seedIds: [],
      }
      exam.seedIds.push(s.id)
      byExam.set(s.exam_id, exam)
    }
    return [...byExam.values()].sort((a, b) => a.exam_date.localeCompare(b.exam_date))
  })

  // 1-8: grows with mastery, wilts every 3 days without a quiz (see lib/plantStage.js)
  const stageOf = (seed) => plantStage(seed)
  const isWilted = (seed) => isWilting(seed)

  const isCelebrated = (from, to) => to <= BLOOM_STAGE && (to > from || from > BLOOM_STAGE)

  function recordGrowth(seedId, from, to) {
    const start = growthRecords.value[seedId]?.from ?? from
    if (isCelebrated(start, to)) growthRecords.value[seedId] = { from: start, to, phase: 'held' }
  }

  function releaseGrowth(seedId) {
    const record = growthRecords.value[seedId]
    if (record?.phase === 'held') record.phase = 'playing'
  }

  function finishGrowth(seedId) {
    delete growthRecords.value[seedId]
  }

  function keepOnlyGrowth(seedId) {
    for (const id of Object.keys(growthRecords.value)) if (id !== seedId) delete growthRecords.value[id]
  }

  const clearGrowth = () => { growthRecords.value = {} }

  // Applies the server's answer to a seed. If the plant moved up a stage, the garden plays its celebration once
  // the plant is on screen.
  function applyReview(seed, updated) {
    const before = stageOf(seed)
    Object.assign(seed, updated)
    recordGrowth(seed.id, before, stageOf(seed))
  }

  async function fetchSeeds() {
    seeds.value = await apiFetch('/api/seeds')
    loaded.value = true
  }

  // priority/alert (the "!" on the top 6 seeds to revise) compare all seeds, so only GET /api/seeds has them.
  // Re-read them after any change; a failure just leaves the old "!" marks.
  async function refreshPriority() {
    try {
      const latest = new Map((await apiFetch('/api/seeds')).map(s => [s.id, s]))
      for (const seed of seeds.value) {
        const fresh = latest.get(seed.id)
        if (fresh) Object.assign(seed, { priority: fresh.priority, alert: fresh.alert })
      }
    } catch (err) {
      console.error(err)
    }
  }

  // The server finds/creates the subject and the exam (optional), saves the seed and its cards, and returns
  // the seed with { subject, exam_id, exam_name, exam_date, exam_choice, cards, mastery } filled in
  async function plantSeed({ title, subject, exam_name, exam_date, tags, cards, col, row, color = 'red', flower = 'tulip' }) {
    const seed = await apiFetch('/api/seeds', {
      method: 'POST', body: { title, subject, exam_name, exam_date, tags, cards, col, row, color, flower },
    })
    // the date and choice belong to the exam, so the exam's other seeds get the same ones (a new date resets the choice)
    for (const s of seeds.value) {
      if (seed.exam_id && s.exam_id === seed.exam_id) Object.assign(s, { exam_date: seed.exam_date, exam_choice: seed.exam_choice })
    }
    seeds.value.push(seed)
    refreshPriority()
    return seed
  }

  // Edits a planted seed's details and cards. Cards sent with their id keep their review progress; cards without
  // one are new; the seed's cards left out are deleted. The plant stays in its spot with its flower and colour.
  async function editSeed(seedId, { title, subject, exam_name, exam_date, tags, cards }) {
    const updated = await apiFetch(`/api/seeds/${encodeURIComponent(seedId)}`, {
      method: 'PUT', body: { title, subject, exam_name, exam_date, tags, cards },
    })
    // same as planting: the exam's other seeds share its date and choice
    for (const s of seeds.value) {
      if (updated.exam_id && s.exam_id === updated.exam_id) Object.assign(s, { exam_date: updated.exam_date, exam_choice: updated.exam_choice })
    }
    const seed = seeds.value.find(s => s.id === seedId)
    if (seed) Object.assign(seed, updated)
    refreshPriority()
    return updated
  }

  // Short Structured Mode: the server has AI mark one typed answer. Saves nothing.
  // Returns { score, rating: 'short_correct' | 'short_partial' | 'short_wrong', feedback }
  async function gradeAnswer(seedId, cardId, response, signal) {
    return apiFetch(`/api/seeds/${encodeURIComponent(seedId)}/grade`, { method: 'POST', body: { card_id: cardId, response }, signal })
  }

  // Saves a review session card by card. ratings: [{ card_id, rating }]
  // rating: forgot | hard | easy (Flashcard), correct | wrong (Multiple Choice Quiz)
  // or short_correct | short_partial | short_wrong (Short Structured)
  async function saveReview(seedId, ratings) {
    const seed = seeds.value.find(s => s.id === seedId)
    if (!seed) throw new Error('Seed not found. Refresh the garden and try again.')
    const updated = await apiFetch(`/api/seeds/${encodeURIComponent(seedId)}/reviews`, { method: 'POST', body: { ratings } })
    applyReview(seed, updated)
    refreshPriority()
  }

  async function deleteSeed(seedId) {
    await apiFetch(`/api/seeds/${encodeURIComponent(seedId)}`, { method: 'DELETE' })
    seeds.value = seeds.value.filter(seed => seed.id !== seedId)
    finishGrowth(seedId)
    refreshPriority()
  }

  // "Exam is over": choice is 'garden' (keep the plants) or 'house' (move that exam's seeds to the flower house;
  // the subject's other seeds stay). The database checks and applies it in one go.
  async function chooseExamOutcome(examId, choice) {
    const subjectId = seeds.value.find(s => s.exam_id === examId)?.subject_id
    let result
    try {
      result = check(await supabase.rpc('choose_exam_outcome', { p_exam: examId, p_choice: choice }))
    } catch (e) {
      throw friendly(e)
    }
    for (const s of seeds.value) {
      if (s.subject_id === subjectId) s.shelf_slot = result.shelf_slot // the shelf slot is the subject's
      if (s.exam_id !== examId) continue
      s.exam_choice = result.exam_choice
      if (choice === 'house') s.in_house = true
    }
    refreshPriority()
  }

  // Row 3 of the shelf for SHELF_UNLOCK_PRICE coins
  async function unlockShelf() {
    try {
      const res = check(await supabase.rpc('unlock_shelf'))
      auth.profile = { ...auth.profile, coins: res.coins, shelf_unlocked: res.shelf_unlocked }
    } catch (e) {
      throw friendly(e)
    }
  }

  // Aggregate readiness for the planner (average mastery, optionally per subject)
  const readiness = (subject) => {
    const list = subject ? seeds.value.filter(s => s.subject === subject) : seeds.value
    return list.length ? Math.round(list.reduce((n, s) => n + s.mastery, 0) / list.length) : 0
  }

  return {
    seeds, growthRecords, loaded, gardenSeeds, hasPlants, housedSubjects, shelfSlots, freeShelfSlots, examsOver,
    stageOf, isWilted, recordGrowth, releaseGrowth, finishGrowth, keepOnlyGrowth, clearGrowth,
    fetchSeeds, plantSeed, editSeed, gradeAnswer, saveReview, deleteSeed, chooseExamOutcome, unlockShelf, readiness,
  }
})