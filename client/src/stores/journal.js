import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useAuthStore } from './auth'
import { useGardenStore } from './garden'

// Journal: the to-do list (left page) and the month calendar (right page).
// Tasks are kept per user in this browser (localStorage) for now: there is no `tasks` table yet.
// Exams and reviews due come from the garden (seeds/subjects in Supabase), the same data the planner used.
const KEY = (userId) => `sproutly.journal.${userId}`
const LIFE = 'Life'
// subject colours: a fixed palette, picked by the order subjects appear (Life is always the soft brown)
const PALETTE = ['#3E8B57', '#4F86C6', '#E0546A', '#8D72D6', '#D99E2B', '#2E9C9C', '#C2618F', '#6B8E23']

export const isoDay = (d) => {
  const x = new Date(d)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}
const uid = () => Math.random().toString(36).slice(2, 9)

export const useJournalStore = defineStore('journal', () => {
  const auth = useAuthStore()
  const garden = useGardenStore()
  const tasks = ref([]) // [{ id, text, subject, date: 'YYYY-MM-DD', done, star }]
  let loadedFor = null

  function load() {
    const id = auth.user?.id
    if (!id || loadedFor === id) return
    loadedFor = id
    try { tasks.value = JSON.parse(localStorage.getItem(KEY(id))) ?? [] } catch { tasks.value = [] }
  }
  watch(tasks, (v) => {
    if (!loadedFor) return
    try { localStorage.setItem(KEY(loadedFor), JSON.stringify(v)) } catch { /* private mode: keep in memory */ }
  }, { deep: true })

  // subjects: the garden's subjects first (same names as the seeds), then any typed on tasks, then Life
  const subjects = computed(() => {
    const names = [...new Set([
      ...garden.gardenSeeds.map((s) => s.subject).filter(Boolean),
      ...tasks.value.map((t) => t.subject).filter((n) => n && n !== LIFE),
    ])]
    return [...names.map((name, i) => ({ name, color: PALETTE[i % PALETTE.length] })), { name: LIFE, color: '#9A8174' }]
  })
  const colorOf = (name) => subjects.value.find((s) => s.name === name)?.color ?? '#9A8174'

  // one exam per subject that has a date (from the garden), like the planner's milestones
  const exams = computed(() => {
    const seen = new Map()
    for (const s of garden.gardenSeeds) {
      const date = s.exam_date?.slice(0, 10)
      if (date && !seen.has(s.subject)) seen.set(s.subject, { date, subject: s.subject, title: `${s.subject} exam` })
    }
    return [...seen.values()].sort((a, b) => a.date.localeCompare(b.date))
  })

  // seeds whose cards are due for review on a day (earliest next_review per seed; none yet = due today)
  const reviewsDue = computed(() => {
    const today = isoDay(Date.now())
    return garden.gardenSeeds.map((s) => {
      const next = s.cards.map((c) => c.next_review).filter(Boolean).sort()[0]
      const day = next ? isoDay(next) : today
      return { seedId: s.id, title: s.title, subject: s.subject, date: day < today ? today : day }
    })
  })

  const readiness = (subject) => garden.readiness(subject)

  function addTask({ text, subject = LIFE, date }) {
    const clean = text.trim().slice(0, 90)
    if (!clean) return null
    const task = { id: uid(), text: clean, subject, date, done: false, star: false }
    tasks.value.push(task)
    return task
  }
  const find = (id) => tasks.value.find((t) => t.id === id)
  const toggleDone = (id) => { const t = find(id); if (t) t.done = !t.done }
  const toggleStar = (id) => { const t = find(id); if (t) t.star = !t.star }
  const rename = (id, text) => { const t = find(id); if (t && text.trim()) t.text = text.trim().slice(0, 90) }
  const remove = (id) => { tasks.value = tasks.value.filter((t) => t.id !== id) }

  return { tasks, subjects, colorOf, exams, reviewsDue, readiness, load, addTask, toggleDone, toggleStar, rename, remove, LIFE }
})
