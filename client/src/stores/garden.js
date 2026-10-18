import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiFetch } from '@/lib/http'
import { plantStage, isWilting } from '@/lib/plantStage'

export const useGardenStore = defineStore('garden', () => {
  const seeds = ref([])
  const loaded = ref(false)

  const hasPlants = computed(() => seeds.value.length > 0)

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
  async function plantSeed({ title, subject, exam_date, tags, cards, col, row }) {
    const seed = await apiFetch('/api/seeds', { method: 'POST', body: { title, subject, exam_date, tags, cards, col, row } })
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

  // Aggregate readiness for the planner (average mastery, optionally per subject)
  const readiness = (subject) => {
    const list = subject ? seeds.value.filter(s => s.subject === subject) : seeds.value
    return list.length ? Math.round(list.reduce((n, s) => n + s.mastery, 0) / list.length) : 0
  }

  return { seeds, loaded, hasPlants, stageOf, isWilted, fetchSeeds, plantSeed, rateReview, saveReview, deleteSeed, readiness }
})
