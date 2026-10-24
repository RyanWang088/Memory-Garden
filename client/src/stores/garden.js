import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiFetch } from '@/lib/http'
import { supabase, check } from '@/lib/supabase'
import { plantStage, isWilting } from '@/lib/plantStage'
import { useAuthStore } from './auth'

export const SHELF_SLOTS = 12          // rows 1-2 of the flower house shelf
export const UNLOCKED_SHELF_SLOTS = 18 // + row 3, bought with coins
export const SHELF_UNLOCK_PRICE = 80

const MESSAGES = {
  SHELF_FULL: 'Your shelves are full. Unlock more space on your profile.',
  EXAM_NOT_OVER: "This exam isn't over yet.",
  ALREADY_CHOSEN: 'You already chose where this subject lives.',
  INSUFFICIENT_COINS: 'Not enough coins for that yet.',
  NOT_AUTHENTICATED: 'Please log in again.',
}
const friendly = (e) => {
  const key = Object.keys(MESSAGES).find((k) => (e?.message ?? '').includes(k))
  return new Error(key ? MESSAGES[key] : 'Something went wrong. Please try again.')
}
const today = () => new Date().toLocaleDateString('en-CA') // local YYYY-MM-DD
const reviewedAt = (seed) => new Date(seed.last_reviewed ?? 0).getTime()

export const useGardenStore = defineStore('garden', () => {
  const auth = useAuthStore()
  const seeds = ref([]) // every seed, including ones moved to the flower house
  const loaded = ref(false)

  // Seeds of a subject moved to the flower house leave the garden (they stay in the database)
  const gardenSeeds = computed(() => seeds.value.filter(s => !s.in_house))
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

  // Subjects whose exam day has passed (local time) and that haven't been asked about yet, oldest exam first.
  // [{ id, name, exam_date, shelf_slot, seedIds }]. Only subjects with plants still in the garden.
  const examsOver = computed(() => {
    const bySubject = new Map()
    for (const s of gardenSeeds.value) {
      const examDay = s.exam_date?.slice(0, 10)
      if (!examDay || s.exam_choice || examDay >= today()) continue
      const exam = bySubject.get(s.subject_id) ?? { id: s.subject_id, name: s.subject, exam_date: examDay, shelf_slot: s.shelf_slot, seedIds: [] }
      exam.seedIds.push(s.id)
      bySubject.set(s.subject_id, exam)
    }
    return [...bySubject.values()].sort((a, b) => a.exam_date.localeCompare(b.exam_date))
  })

  // 1-8: grows with mastery, wilts every 3 days without a quiz (see lib/plantStage.js)
  const stageOf = (seed) => plantStage(seed)
  const isWilted = (seed) => isWilting(seed)

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

  // The server finds/creates the subject, saves the seed and its cards, and returns
  // the seed with { subject, exam_date, cards, mastery } filled in
  async function plantSeed({ title, subject, exam_date, tags, cards, col, row, color = 'red', flower = 'tulip' }) {
    const seed = await apiFetch('/api/seeds', { method: 'POST', body: { title, subject, exam_date, tags, cards, col, row, color, flower } })
    // the exam date belongs to the subject, so the subject's other seeds get the same one
    for (const s of seeds.value) if (s.subject === seed.subject) s.exam_date = seed.exam_date
    seeds.value.push(seed)
    refreshPriority()
    return seed
  }

  // rating: 'forgot' | 'hard' | 'easy'. Replace with real spaced-repetition scheduling later.
  async function rateReview(seedId, rating) {
    const delta = { forgot: -5, hard: 5, easy: 12 }[rating]
    const seed = seeds.value.find(s => s.id === seedId)
    if (!seed) throw new Error('Seed not found. Refresh the garden and try again.')
    if (delta === undefined) throw new Error('Choose a valid review rating.')
    const mastery = Math.max(0, Math.min(100, seed.mastery + delta))
    const updated = await apiFetch(`/api/seeds/${seedId}`, { method: 'PATCH', body: { mastery, last_reviewed: new Date().toISOString() } })
    Object.assign(seed, updated)
    refreshPriority()
  }

  // Saves a review session card by card. ratings: [{ card_id, rating }]
  // rating: forgot | hard | easy (Flexible Deck) or correct | wrong (Structured Quiz)
  async function saveReview(seedId, ratings) {
    const seed = seeds.value.find(s => s.id === seedId)
    if (!seed) throw new Error('Seed not found. Refresh the garden and try again.')
    const updated = await apiFetch(`/api/seeds/${encodeURIComponent(seedId)}/reviews`, { method: 'POST', body: { ratings } })
    Object.assign(seed, updated)
    refreshPriority()
  }

  async function deleteSeed(seedId) {
    await apiFetch(`/api/seeds/${encodeURIComponent(seedId)}`, { method: 'DELETE' })
    seeds.value = seeds.value.filter(seed => seed.id !== seedId)
    refreshPriority()
  }

  // "Exam is over": choice is 'garden' (keep the plants) or 'house' (move every seed of the subject to the
  // flower house). The database checks and applies it in one go.
  async function chooseExamOutcome(subjectId, choice) {
    let result
    try {
      result = check(await supabase.rpc('choose_exam_outcome', { p_subject: subjectId, p_choice: choice }))
    } catch (e) {
      throw friendly(e)
    }
    for (const s of seeds.value) {
      if (s.subject_id !== subjectId) continue
      Object.assign(s, { exam_choice: result.exam_choice, shelf_slot: result.shelf_slot })
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
    seeds, loaded, gardenSeeds, hasPlants, housedSubjects, shelfSlots, freeShelfSlots, examsOver,
    stageOf, isWilted, fetchSeeds, plantSeed, rateReview, saveReview, deleteSeed, chooseExamOutcome, unlockShelf, readiness,
  }
})
