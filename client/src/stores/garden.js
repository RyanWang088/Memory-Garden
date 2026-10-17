import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiFetch } from '@/lib/http'

const DAY = 86_400_000

export const useGardenStore = defineStore('garden', () => {
  const seeds = ref([])
  const loaded = ref(false)

  const hasPlants = computed(() => seeds.value.length > 0)

  // sprout -> seedling -> bloom, driven by mastery (0-100)
  const stageOf = (seed) => (seed.mastery < 34 ? 'sprout' : seed.mastery < 67 ? 'seedling' : 'bloom')
  // Wilts if not reviewed for 3+ days (tune this; drives the CSS wilt class)
  const isWilted = (seed) => !!seed.last_reviewed && Date.now() - new Date(seed.last_reviewed) > 3 * DAY

  async function fetchSeeds() {
    seeds.value = await apiFetch('/api/seeds')
    loaded.value = true
  }

  // The server finds/creates the subject, saves the seed and its cards, and returns
  // the seed with { subject, exam_date, cards, mastery, stage } filled in
  async function plantSeed({ title, subject, exam_date, tags, cards, col, row }) {
    const seed = await apiFetch('/api/seeds', { method: 'POST', body: { title, subject, exam_date, tags, cards, col, row } })
    // the exam date belongs to the subject, so the subject's other seeds get the same one
    for (const s of seeds.value) if (s.subject === seed.subject) s.exam_date = seed.exam_date
    seeds.value.push(seed)
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
  }

  async function deleteSeed(seedId) {
    await apiFetch(`/api/seeds/${encodeURIComponent(seedId)}`, { method: 'DELETE' })
    seeds.value = seeds.value.filter(seed => seed.id !== seedId)
  }

  // Aggregate readiness for the planner (average mastery, optionally per subject)
  const readiness = (subject) => {
    const list = subject ? seeds.value.filter(s => s.subject === subject) : seeds.value
    return list.length ? Math.round(list.reduce((n, s) => n + s.mastery, 0) / list.length) : 0
  }

  return { seeds, loaded, hasPlants, stageOf, isWilted, fetchSeeds, plantSeed, rateReview, deleteSeed, readiness }
})
