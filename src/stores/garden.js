import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '@/api'
import { useAuthStore } from './auth'

const DAY = 86_400_000

export const useGardenStore = defineStore('garden', () => {
  const auth = useAuthStore()
  const seeds = ref([])
  const loaded = ref(false)

  const hasPlants = computed(() => seeds.value.length > 0)

  // sprout -> seedling -> bloom, driven by mastery (0-100)
  const stageOf = (seed) => (seed.mastery < 34 ? 'sprout' : seed.mastery < 67 ? 'seedling' : 'bloom')
  // Wilts if not reviewed for 3+ days (tune this; drives the CSS wilt class)
  const isWilted = (seed) => !!seed.last_reviewed && Date.now() - new Date(seed.last_reviewed) > 3 * DAY

  async function fetchSeeds() {
    seeds.value = await api.listSeeds(auth.user.id)
    loaded.value = true
  }

  async function plantSeed({ title, subject, cards, col, row }) {
    const seed = await api.createSeed(auth.user.id, { title, subject, cards, col, row })
    console.log(seed)
    seeds.value.push(seed)
    return seed
  }

  // rating: 'forgot' | 'hard' | 'easy'. Replace with real spaced-repetition scheduling later.
  async function rateReview(seedId, rating) {
    const delta = { forgot: -5, hard: 5, easy: 12 }[rating]
    const seed = seeds.value.find(s => s.id === seedId)
    const mastery = Math.max(0, Math.min(100, seed.mastery + delta))
    const updated = await api.updateSeed(auth.user.id, seedId, { mastery, last_reviewed: new Date().toISOString() })
    Object.assign(seed, updated)
  }

  // Aggregate readiness for the journal (average mastery, optionally per subject)
  const readiness = (subject) => {
    const list = subject ? seeds.value.filter(s => s.subject === subject) : seeds.value
    return list.length ? Math.round(list.reduce((n, s) => n + s.mastery, 0) / list.length) : 0
  }

  return { seeds, loaded, hasPlants, stageOf, isWilted, fetchSeeds, plantSeed, rateReview, readiness }
})
