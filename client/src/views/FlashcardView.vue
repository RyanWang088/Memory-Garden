<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGardenStore } from '@/stores/garden'
import { useToastStore } from '@/stores/toast'
import { shuffle } from '@/lib/shuffle'
import { useStudyTimer } from '@/composables/useStudyTimer'
import { moodNow } from '@/lib/greeting'
import SceneryBackdrop from '@/components/SceneryBackdrop.vue'

// "Flashcard Mode" review session: flip flashcards, up to 20 cards from one seed.
// Forgot brings the card back soon, Hard brings it back later; Easy finishes it for today.
// (The server then schedules each card's next review: forgot today, hard in 1 day, easy in 3 days.)
const MAX_CARDS = 20
const REQUEUE_GAP = { forgot: 3, hard: 6 } // shown again after this many other cards
const RATINGS = [
  { value: 'forgot', label: 'Forgot', next: 'again today' },
  { value: 'hard', label: 'Hard', next: 'again in 1 day' },
  { value: 'easy', label: 'Easy', next: 'again in 3 days' },
]

const route = useRoute()
const router = useRouter()
const garden = useGardenStore()
const toast = useToastStore()
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

const seed = computed(() => garden.seeds.find(item => item.id === route.params.id))
const current = computed(() => queue.value[0])
// "Card x of y": counts finished cards, so a card that comes back keeps its number
const cardNumber = computed(() => Math.min(doneCount.value + 1, totalCards.value))
const timeTaken = computed(() => {
  const seconds = Math.round(elapsedMs.value / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
})
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

// The whole card turns over in two halves: edge-on (shrinking a little, so the meadow shows), swap to the
// answer, then back in from the other side. Reduced motion gets a quick fade instead.
const TURN_MS = 250
const cardEl = ref(null)
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
    toast.show({ type: 'success', title: 'Session saved', message: `You went through ${totalCards.value} cards of ${seed.value.title}.`,duration:6000 })
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
  <main class="sp-review-page phone-card">
    <SceneryBackdrop :mood="mood" :options="{ seed: 31, tulips: narrow ? 3 : 10, butterflies: 2, horizon: 0.64 }" />
    <!-- flashcards: the card is the whole box -->
    <div v-if="!loading && totalCards && !finished" class="sp-review-container" data-testid="deck-session">
      <div :key="current.uid" ref="cardEl" class="deck-card" :class="flipped ? 'is-back' : 'is-front'">
        <!-- tapping anywhere on the front flips it; the hint is the keyboard / screen reader control,
             and Space / Enter still work from anywhere (onKeydown) -->
        <article v-if="!flipped" class="deck-face" data-testid="flashcard-front" @click="showAnswer">
          <div class="deck-top">
            <button type="button" class="btn-close deck-close" aria-label="Quit and go back to garden" @click.stop="backToGarden" />
            <span class="card-count" data-testid="card-count">Card {{ cardNumber }} of {{ totalCards }}</span>
            <span class="deck-subject">{{ seed.title }}</span>
          </div>
          <div class="deck-middle">
            <h2 class="flashcard-text m-0">{{ current.question }}</h2>
          </div>
          <button type="button" class="sp-hand flip-hint" data-testid="show-answer">
            tap the card to flip <span aria-hidden="true">↻</span>
          </button>
        </article>

        <article v-else class="deck-face" data-testid="flashcard-back">
          <div class="deck-top">
            <button type="button" class="btn-close deck-close" aria-label="Quit and go back to garden" @click="backToGarden" />
            <span class="card-count">Card {{ cardNumber }} of {{ totalCards }}</span>
            <span class="deck-subject">{{ seed.title }}</span>
          </div>
          <div class="deck-middle">
            <p class="sp-hand m-0">Q: {{ current.question }}</p>
            <h2 class="flashcard-text m-0">{{ current.answer }}</h2>
          </div>
          <div class="d-flex flex-column gap-2 w-100">
            <p class=" m-0">How well did you remember it?</p>
            <div class="d-flex gap-3">
              <button v-for="(r, i) in RATINGS" :key="r.value" type="button"
                class="rate-btn flex-fill" :class="`rate-${r.value}`" :data-testid="`rate-${r.value}`"
                :aria-keyshortcuts="String(i + 1)" @click="rate(r.value)">
                <span class="rate-label">{{ r.label }}</span>
                <span class="rate-next">{{ r.next }}</span>
              </button>
            </div>
          </div>
        </article>
      </div>
    </div>

    <div v-else class="sp-review-container sp-review-sheet">
      <p v-if="loading" role="status">Shuffling your flashcards…</p>

      <section v-else-if="!totalCards" class="text-center d-flex flex-column align-items-center gap-3 pt-5">
        <img src="../assets/ui/sprout.svg" width="96" height="96" alt="">
        <p class="text-berry-deep" role="alert">{{ error }}</p>
        <button type="button" class="sp-btn sp-btn-butter text-button" @click="backToGarden">Back to garden</button>
      </section>

      <!-- results -->
      <section v-else class="sp-review-results d-flex flex-column align-items-center text-center gap-3" data-testid="deck-results">        <div>
          <h1 class="m-0">🌱 Deck Complete!</h1>
          <p class="ink-soft m-0">You went through {{ totalCards }} cards.</p>
        </div>

        <div class="stats d-flex flex-wrap gap-3 w-100 justify-content-center">
          <div class="stat">
            <span class="sp-field">Forgot</span>
            <span class="text-stat">{{ counts.forgot }}</span>
          </div>
          <div class="stat">
            <span class="sp-field">Hard</span>
            <span class="text-stat">{{ counts.hard }}</span>
          </div>
          <div class="stat">
            <span class="sp-field">Easy</span>
            <span class="text-stat">{{ counts.easy }}</span>
          </div>
          <div class="stat">
            <span class="sp-field">Time</span>
            <span class="text-stat">{{ timeTaken }}</span>
          </div>
        </div>

        <p v-if="error" class="text-berry-deep m-0" role="alert">{{ error }}</p>

        <button type="button" class="sp-btn border-0 text-button finish-btn" data-testid="deck-finish"
          :disabled="saving" @click="finishSession">
          {{ saving ? 'Saving…' : 'Water my plant' }}
        </button>
      </section>
    </div>
  </main>
</template>

<style scoped>
.ink-soft {
  color: var(--ink-soft);
}

/* the session card fills the box the notebook sheet used to (the sheet stays for loading and results);
   ruled like the Figma Flashcard: coral margin at x=56, leaf rules every 40px from y=110 */
.deck-card {
  --mx: 56px;
  position: relative;
  display: flex;
  min-height: calc(100vh - 80px);
  border-radius: 20px;
  background-color: #ffffff;
  background-image:
    linear-gradient(90deg, transparent var(--mx), #ffc4b5 var(--mx) calc(var(--mx) + 1.5px), transparent calc(var(--mx) + 1.5px)),
    repeating-linear-gradient(180deg, #c9d0fb 0 1.5px, transparent 1.5px 40px);
  background-position: 0 0, 0 110px;
  background-size: 100% 100%, 100% calc(100% - 110px);
  background-repeat: no-repeat;
  box-shadow: 0 12px 32px rgba(62, 53, 83, 0.16);
}

.deck-card.is-back {
  background-color: #fdebe2;
}

.deck-face {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 26px 40px 32px calc(var(--mx) + 24px);
  text-align: center;
}

.deck-card.is-front .deck-face {
  cursor: pointer;
}

.flip-hint {
  padding: 2px 8px;
  border: 0;
  border-radius: 8px;
  background: none;
}

.flip-hint:focus-visible {
  outline: 3px solid #c9d0fb;
}

/* plain X, seed title and card count on one row, like the quiz pages' header; the row's middle is
   halfway between the card's top edge and the first rule at 110px (55px), under the 26px top padding */
.deck-top {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  height: calc(110px - 2 * 26px);
  gap: 16px;
  width: 100%;
  text-align: left;
}

.deck-middle {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
  width: 100%;
}

/* same look the seed title had on the sheet (.sp-review-sheet .sp-field) */
.deck-subject {
  flex: 1;
  min-width: 0;
  text-align: right; /* fills the row after the card count, so its text is pushed to the far right */
  font-family: var(--f-body);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink-soft);
}

/* Figma Label/Caps, e.g. "CARD 4 OF 12" */
.card-count {
  font-family: var(--f-body);
  font-weight: 800;
  font-size: 11px;
  line-height: 14px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #6e6584;
  font-variant-numeric: tabular-nums;
}

/* type from the Figma Flashcard component */
.deck-card .flashcard-text {
  overflow-wrap: anywhere;
  font-family: var(--f-display);
  font-weight: 600;
  font-size: 32px;
  line-height: 38px;
  letter-spacing: -0.005em;
  color: #3e3553;
}

.deck-card .sp-hand {
  font-family: var(--f-hand);
  font-weight: 400;
  font-size: 19px;
  line-height: 20px;
  letter-spacing: 0;
  color: #6e6584;
}

/* rating buttons from the Figma Rating Button component (without its weather icons) */
.rate-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  flex-basis: 0;
  min-width: 0;
  min-height: 84px;
  padding: 14px 8px;
  border: 0;
  border-radius: 16px;
  background: #ffffff;
  box-shadow: 0 4px 12px rgba(62, 53, 83, 0.12);
  transition: background-color 0.15s, transform 0.15s var(--spring), box-shadow 0.15s;
}

.rate-forgot:hover { background: #c9d0fb; }
.rate-hard:hover { background: #f5eee3; }
.rate-easy:hover { background: #fce2a6; }

.rate-btn:active {
  transform: translateY(1px);
  box-shadow: 0 2px 6px rgba(62, 53, 83, 0.12);
}

.rate-btn:focus-visible {
  outline: 3px solid #c9d0fb;
  outline-offset: 3px;
}

.rate-label {
  font-family: var(--f-body);
  font-weight: 800;
  font-size: 18px;
  line-height: 24px;
  color: #3e3553;
}

.rate-next {
  font-family: var(--f-hand);
  font-weight: 400;
  font-size: 19px;
  line-height: 20px;
  color: #6e6584;
}

.finish-btn {
  justify-content: center;
  width: 100%;
  max-width: 420px;
}

.finish-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* results */
.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex: 1 1 120px;
  max-width: 160px;
  padding: 14px 8px;
  border: 2px solid var(--line);
  border-radius: 16px;
  background: var(--paper);
  color: var(--ink-soft);
}

.stat .text-stat { color: var(--ink); }

@media (max-width: 1080px) {
  .stats {
    display: grid !important;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    max-width: 420px;
  }
  .stat { max-width: none; padding: 20px 8px; }
}

/* tablets: scale the result boxes up so they fill the sheet like on a phone */
@media (min-width: 481px) and (max-width: 1080px) {
  .stats { max-width: 560px; gap: 24px !important; }
  .stat { padding: 36px 12px; gap: 8px; }
  .stat .sp-field { font-size: 18px; line-height: 24px; }
  .stat .text-stat { font-size: 44px; line-height: 48px; }
  .finish-btn { max-width: 560px; }
}

@media (max-width: 480px) {
  /* same size as the quiz cards (.phone-card in style.css), centred on the meadow */
  .deck-card { --mx: 44px; min-height: min(620px, calc(100dvh - 48px)); }
  .deck-face { padding: 20px 16px 24px calc(var(--mx) + 14px); }
  .deck-top { height: calc(110px - 2 * 20px); }
}
</style>
