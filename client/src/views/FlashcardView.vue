<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGardenStore } from '@/stores/garden'
import { useToastStore } from '@/stores/toast'
import { shuffle } from '@/lib/shuffle'
import { useStudyTimer } from '@/composables/useStudyTimer'
import { moodNow } from '@/lib/greeting'
import SceneryBackdrop from '@/components/SceneryBackdrop.vue'
import { useAuthStore } from '@/stores/auth'
import { foliageUrl } from '@/lib/plantSprites'

// "Flashcard Mode" review session: flip flashcards, up to 20 cards from one seed.
// Forgot brings the card back soon, Hard brings it back later; Easy finishes it for today.
// (The server then schedules each card's next review: forgot today, hard in 1 day, easy in 3 days.)
const MAX_CARDS = 20
const REQUEUE_GAP = { forgot: 3, hard: 6 } // shown again after this many other cards
const RATINGS = [
  { value: 'forgot', label: 'Forgot', next: 'again today', cls: '' },
  { value: 'hard', label: 'Hard', next: 'again in 1 day', cls: 'sp-btn-butter' },
  { value: 'easy', label: 'Easy', next: 'again in 3 days', cls: 'sp-btn-leaf' },
]

const route = useRoute()
const router = useRouter()
const garden = useGardenStore()
const toast = useToastStore()
const auth = useAuthStore()
const studyTimer = useStudyTimer() // adds this session's active time to the profile when the page closes

const loading = ref(true)
const error = ref('')
const queue = ref([]) // cards still to review; queue[0] is on screen
const totalCards = ref(0)
const doneCount = ref(0)
const flipped = ref(false)
const finished = ref(false)
// the meadow behind the sheet, like the Focus page: the time of day while reviewing, blush on the results
const mood = computed(() => (finished.value ? 'blush' : moodNow()))
const narrow = typeof window !== 'undefined' && window.innerWidth < 600
const counts = ref({ forgot: 0, hard: 0, easy: 0 }) // first rating of each card
const startedAt = ref(0)
const elapsedMs = ref(0)
const saving = ref(false)
const firstRatings = new Map() // card id -> first rating; this is what gets saved
let nextUid = 0

const flower = computed(() => auth.profile?.onboarding_answers?.flower || 'pink')
const seed = computed(() => garden.seeds.find(item => item.id === route.params.id))
const current = computed(() => queue.value[0])
const inSession = computed(() => !loading.value && totalCards.value > 0 && !finished.value)
// "Card x of y": counts finished cards, so a card that comes back keeps its number
const cardNumber = computed(() => Math.min(doneCount.value + 1, totalCards.value))
const timeTaken = computed(() => {
  const seconds = Math.round(elapsedMs.value / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
})
const stats = computed(() => [
  { label: 'Forgot', value: counts.value.forgot },
  { label: 'Hard', value: counts.value.hard },
  { label: 'Easy', value: counts.value.easy },
  { label: 'Time', value: timeTaken.value },
])
const TONES = ['', 'is-leaf', 'is-berry']
// a card is due if it was never reviewed or its next review date has passed
const isDue = (card) => !card.next_review || new Date(card.next_review) <= Date.now()

onMounted(async () => {
  window.addEventListener('keydown', onKeydown)
  try {
    if (!garden.loaded) await garden.fetchSeeds()
    if (!seed.value) error.value = 'This seed could not be found in your garden.'
    else if (!seed.value.cards.length) error.value = 'This seed has no flashcards to study yet.'
    else {
      // due cards first, then the weakest (random among equals), up to 20
      queue.value = shuffle(seed.value.cards)
        .sort((a, b) => {
          if (isDue(a) !== isDue(b)) return isDue(a) ? -1 : 1
          return a.card_mastery - b.card_mastery
        })
        .slice(0, MAX_CARDS)
        .map(card => ({ uid: nextUid++, id: card.id, question: card.question, answer: card.answer }))
      totalCards.value = queue.value.length
      startedAt.value = Date.now()
      studyTimer.start()
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
})

onUnmounted(() => window.removeEventListener('keydown', onKeydown))

// The whole sheet turns over in two halves: edge-on (shrinking a little, so the meadow shows), swap to the
// answer, then back in from the other side. Reduced motion gets a quick fade instead.
const TURN_MS = 250
const cardEl = ref(null) // the sheet element that turns
const turning = ref(false)
const reduceMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

function turn(el, from, to, easing) {
  if (!el) return Promise.resolve()
  const frames = reduceMotion
    ? [{ opacity: from === 0 ? 1 : 0 }, { opacity: to === 0 ? 1 : 0 }]
    : [{ transform: `perspective(2500px) rotateY(${from}deg) scale(${from ? 0.96 : 1})` },
        { transform: `perspective(2500px) rotateY(${to}deg) scale(${to ? 0.96 : 1})` }]
  return el.animate(frames, { duration: reduceMotion ? 120 : TURN_MS, easing, fill: 'forwards' }).finished.catch(() => {})
}

async function showAnswer() {
  if (flipped.value || turning.value) return
  studyTimer.mark()
  turning.value = true
  const el = cardEl.value
  await turn(el, 0, 90, 'ease-in')
  flipped.value = true
  await nextTick()
  await turn(el, -90, 0, 'ease-out')
  el?.getAnimations().forEach(a => a.cancel())
  turning.value = false
}

function rate(rating) {
  const card = current.value
  if (!card || !flipped.value || turning.value) return
  studyTimer.mark()
  if (!firstRatings.has(card.id)) {
    firstRatings.set(card.id, rating)
    counts.value[rating]++
  }
  const rest = queue.value.slice(1)
  if (rating === 'easy') {
    doneCount.value++
  } else {
    // put the card back further down the queue; a new uid makes it come back unflipped
    const position = Math.min(REQUEUE_GAP[rating], rest.length)
    rest.splice(position, 0, { ...card, uid: nextUid++ })
  }
  queue.value = rest
  flipped.value = false
  if (!rest.length) {
    elapsedMs.value = Date.now() - startedAt.value
    finished.value = true
  }
}

// Space or Enter shows the answer, then 1 / 2 / 3 rates it
function onKeydown(e) {
  if (finished.value || !current.value || e.ctrlKey || e.metaKey || e.altKey) return
  // a focused button (the close button, or the hint, which flips on its own click) keeps its own Space / Enter
  const onButton = e.target instanceof Element && e.target.closest('button')
  if (!flipped.value && !onButton && (e.key === ' ' || e.key === 'Enter')) {
    e.preventDefault()
    showAnswer()
  } else if (flipped.value && RATINGS[Number(e.key) - 1]) {
    e.preventDefault()
    rate(RATINGS[Number(e.key) - 1].value)
  }
}

async function finishSession() {
  if (saving.value) return
  saving.value = true
  error.value = ''
  try {
    // each card's first rating: forgot -5 / hard +2 / easy +5 mastery; also waters the plant
    const ratings = []
    for (const [card_id, rating] of firstRatings) ratings.push({ card_id, rating })
    await garden.saveReview(seed.value.id, ratings)
    toast.show({ type: 'success', title: 'Session saved', message: `You went through ${totalCards.value} cards of ${seed.value.title}.`, duration: 6000 })
    await router.push({ name: 'garden', query: { scrollTo: seed.value.id } })
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    saving.value = false
  }
}

function backToGarden() {
  router.push({ name: 'garden' })
}
</script>

<template>
  <main class="sp-review-page">
    <SceneryBackdrop :mood="mood" :options="{ seed: 31, tulips: narrow ? 3 : 10, butterflies: 2, horizon: 0.64 }" />

    <!-- flashcards: the whole sheet is the card. Tapping the front flips it (the hint is the keyboard / screen reader
         control, and Space / Enter still work from anywhere, see onKeydown) -->
    <div v-if="inSession" ref="cardEl" class="sp-review-container sp-review-sheet is-deck d-flex flex-column" :class="flipped ? 'is-back' : 'is-front'" data-testid="deck-session" @click="showAnswer">
      <header class="sp-review-header d-flex flex-column gap-2">
        <div class="d-flex align-items-center gap-3 w-100">
          <button type="button" class="btn-close" aria-label="Quit and go back to garden" @click.stop="backToGarden" />
          <span class="sp-field flex-grow-1" data-testid="card-count">Card {{ cardNumber }} of {{ totalCards }}</span>
          <span class="sp-field deck-subject">{{ seed.title }}</span>
        </div>
        <div class="progress" role="progressbar" aria-label="Flashcard progress" :aria-valuenow="doneCount" aria-valuemin="0" :aria-valuemax="totalCards">
          <div class="progress-fill sp-review-progress-fill" :style="{ width: `${(doneCount / totalCards) * 100}%` }" />
        </div>
      </header>

      <article v-if="!flipped" :key="`front-${current.uid}`" class="deck-body" data-testid="flashcard-front">
        <h2 class="sp-question is-big">{{ current.question }}</h2>
        <button type="button" class="flip-hint mt-auto align-self-center" data-testid="show-answer">
          tap the card to flip ↻
        </button>
      </article>

      <article v-else :key="`back-${current.uid}`" class="deck-body" data-testid="flashcard-back">
        <p class="sp-hand echo m-0">Q: {{ current.question }}</p>
        <h2 class="sp-question is-big">{{ current.answer }}</h2>
        <svg class="sp-scribble" viewBox="0 0 200 10" preserveAspectRatio="none" aria-hidden="true"><path d="M2 6C40 1 70 10 110 5S170 3 198 6" pathLength="1" /></svg>
        <div class="mt-auto pt-4">
          <p class="sp-label mb-2">How well did you remember it?</p>
          <div class="d-flex gap-2">
            <button v-for="(r, i) in RATINGS" :key="r.value" type="button" class="sp-btn rate flex-fill" :class="r.cls"
              :data-testid="`rate-${r.value}`" :aria-keyshortcuts="String(i + 1)" @click.stop="rate(r.value)">
              <span class="keycap" aria-hidden="true">{{ i + 1 }}</span>
              <span class="rate-label">{{ r.label }}</span>
              <span class="rate-next">{{ r.next }}</span>
            </button>
          </div>
        </div>
      </article>

    </div>

    <div v-else class="sp-review-container sp-review-sheet">
      <p v-if="loading" role="status">Shuffling your flashcards…</p>

      <section v-else-if="!totalCards" class="text-center d-flex flex-column align-items-center gap-3 pt-5">
        <img src="../assets/ui/sprout.svg" width="96" height="96" alt="">
        <p class="text-berry-deep" role="alert">{{ error }}</p>
        <button type="button" class="sp-btn sp-btn-butter" @click="backToGarden">Back to garden</button>
      </section>

      <!-- results -->
      <section v-else class="sp-review-results d-flex flex-column align-items-center text-center gap-4" data-testid="deck-results">
        <img class="bloom" :src="foliageUrl(`tulip-${flower}-4`)" alt="" />
        <div>
          <h1 class="m-0">Deck <em>complete</em></h1>
          <p class="sp-hand sub m-0">You went through {{ totalCards }} cards.</p>
        </div>
        <div class="d-flex flex-wrap justify-content-center gap-4 w-100">
          <article v-for="(s, i) in stats" :key="s.label" class="sp-note sp-reveal stat" :class="TONES[i % 3]" :style="{ '--r': `${i % 2 ? 1.8 : -1.8}deg`, '--i': i }">
            <span class="sp-label">{{ s.label }}</span>
            <b>{{ s.value }}</b>
          </article>
        </div>
        <p v-if="error" class="text-berry-deep fw-bold m-0" role="alert">{{ error }}</p>
        <button type="button" class="sp-btn sp-claim-btn" data-testid="deck-finish" :disabled="saving" @click="finishSession">
          {{ saving ? 'Saving…' : 'Water my plant' }} <span class="arrow">→</span>
        </button>
      </section>
    </div>
  </main>
</template>

<style scoped>
.is-deck { transition: background-color .35s; }
.is-deck.is-back { background-color: color-mix(var(--butter-soft),#fff); }
.is-front { cursor: pointer; }


.deck-body { flex: 1; display: flex; flex-direction: column; animation: rise-in .45s var(--ease) both; }
.deck-body > .sp-question { margin-top: 44px; }
.deck-subject { text-align: right; }
.echo { font-size: 1.25rem; line-height: var(--lh); color: var(--ink-soft); }

.flip-hint { display: inline-flex; align-items: center; gap: 8px; padding: 2px 8px; border: 0; border-radius: 8px; background: none; font-family: var(--f-hand); font-size: 1.3rem; color: var(--ink-soft); }
.flip-hint:focus-visible { outline: 3px solid color-mix(in srgb, var(--leaf) 35%, transparent); }

/* rating tiles are pressable sp-btns: berry / butter / leaf */
.rate { position: relative; flex-direction: column; gap: 2px; min-height: 84px; padding: .6em .4em; white-space: normal; line-height: 1.1; }
.rate-label { font-size: 1.05rem; }
.rate-next { font-family: var(--f-hand); font-weight: 600; font-size: 1.15rem; opacity: .9; }
.keycap { position: absolute; top: 6px; right: 9px; font-size: .65rem; opacity: .6; }

/* hand-drawn underline: the path draws itself (pathLength=1 makes dash maths independent of its real length) */
.sp-scribble { display: block; width: min(100%, 260px); height: 10px; margin-top: 6px; fill: none; stroke: var(--berry); stroke-width: 3; stroke-linecap: round; overflow: visible; }
.sp-scribble path { stroke-dasharray: 1; animation: scribble-draw .7s var(--ease) .25s backwards; }
@keyframes scribble-draw { from { stroke-dashoffset: 1; } }

/* results */
.sub { font-size: 1.5rem; line-height: 1.1; color: var(--ink-soft); }
.bloom { height: 150px; width: auto; transform-origin: 50% 100%; animation: pop-in .6s var(--spring) }
.stat { flex: 1 1 120px; max-width: 170px; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 24px 10px 14px; }
.stat b { font-family: var(--f-display); font-weight: 600; font-size: 2rem; line-height: 1.1; font-variant-numeric: tabular-nums; }
</style>