<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGardenStore } from '@/stores/garden'
import { useToastStore } from '@/stores/toast'
import { shuffle } from '@/lib/shuffle'

// "Flexible Deck Mode" review session: flip flashcards, up to 20 cards from one seed.
// Forgot brings the card back soon, Hard brings it back later; Easy finishes it for today.
// (The server then schedules each card's next review: forgot today, hard in 1 day, easy in 3 days.)
const MAX_CARDS = 20
const REQUEUE_GAP = { forgot: 3, hard: 6 } // shown again after this many other cards
const RATINGS = [
  { value: 'forgot', label: 'Forgot', btn: 'btn-outline-danger' },
  { value: 'hard', label: 'Hard', btn: 'btn-outline-warning' },
  { value: 'easy', label: 'Easy', btn: 'btn-outline-success' },
]

const route = useRoute()
const router = useRouter()
const garden = useGardenStore()
const toast = useToastStore()

const loading = ref(true)
const error = ref('')
const queue = ref([]) // cards still to review; queue[0] is on screen
const totalCards = ref(0)
const doneCount = ref(0)
const flipped = ref(false)
const finished = ref(false)
const counts = ref({ forgot: 0, hard: 0, easy: 0 }) // first rating of each card
const startedAt = ref(0)
const elapsedMs = ref(0)
const saving = ref(false)
const firstRatings = new Map() // card id -> first rating; this is what gets saved
let nextUid = 0

const seed = computed(() => garden.seeds.find(item => item.id === route.params.id))
const current = computed(() => queue.value[0])
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
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
})

onUnmounted(() => window.removeEventListener('keydown', onKeydown))

function showAnswer() {
  flipped.value = true
}

function rate(rating) {
  const card = current.value
  if (!card || !flipped.value) return
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
  if (!flipped.value && (e.key === ' ' || e.key === 'Enter')) {
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
    // each card's first rating: forgot -5 / hard +5 / easy +12 mastery; also waters the plant
    const ratings = []
    for (const [card_id, rating] of firstRatings) ratings.push({ card_id, rating })
    await garden.saveReview(seed.value.id, ratings)
    toast.show({ type: 'success', title: 'Session saved', message: `You went through ${totalCards.value} cards of ${seed.value.title}.` })
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
  <main class="deck-page">
    <div class="deck-container">
      <p v-if="loading" role="status">Shuffling your flashcards…</p>

      <section v-else-if="!totalCards" class="text-center d-flex flex-column align-items-center gap-3 pt-5">
        <img src="../assets/ui/sprout.svg" width="96" height="96" alt="">
        <p class="text-danger" role="alert">{{ error }}</p>
        <button type="button" class="btn-secondary text-button" @click="backToGarden">Back to garden</button>
      </section>

      <!-- flashcards -->
      <section v-else-if="!finished" class="d-flex flex-column gap-4" data-testid="deck-session">
        <header class="d-flex flex-column gap-2">
          <div class="d-flex align-items-center gap-3">
            <button type="button" class="btn-close" aria-label="Quit and go back to garden" @click="backToGarden" />
            <span class="text-label-field flex-grow-1 bark-muted">{{ seed.title }}</span>
            <span class="done-pill text-button" data-testid="deck-done">{{ doneCount }} / {{ totalCards }}</span>
          </div>
          <div class="progress" role="progressbar" :aria-valuenow="doneCount" aria-valuemin="0" :aria-valuemax="totalCards">
            <div class="progress-fill deck-progress-fill" :style="{ width: `${(doneCount / totalCards) * 100}%` }" />
          </div>
        </header>

        <div :key="current.uid" class="flashcard" :class="{ 'is-flipped': flipped }">
          <div class="flashcard-inner">
            <article class="flashcard-face flashcard-front" :inert="flipped" data-testid="flashcard-front">
              <span class="text-label-caption bark-muted">Question</span>
              <h2 class="flashcard-text m-0">{{ current.question }}</h2>
              <button type="button" class="btn-primary border-0 text-button show-answer-btn" data-testid="show-answer"
                @click="showAnswer">Show answer</button>
            </article>

            <article class="flashcard-face flashcard-back" :inert="!flipped" data-testid="flashcard-back">
              <span class="text-label-caption bark-muted">Answer</span>
              <p class="text-body-small m-0">{{ current.question }}</p>
              <h2 class="flashcard-text m-0">{{ current.answer }}</h2>
              <div class="d-flex flex-column gap-2 w-100">
                <p class="text-body-strong m-0">How well did you remember it?</p>
                <div class="d-flex gap-2">
                  <button v-for="(r, i) in RATINGS" :key="r.value" type="button"
                    class="btn rounded-pill text-button flex-fill" :class="r.btn" :data-testid="`rate-${r.value}`"
                    :aria-keyshortcuts="String(i + 1)" @click="rate(r.value)">{{ r.label }}</button>
                </div>
              </div>
            </article>
          </div>
        </div>

        <p class="text-body-small text-center m-0">
          {{ flipped ? 'Press 1, 2 or 3 to rate.' : 'Press Space to show the answer.' }}
          Forgot and Hard cards come back later in the session.
        </p>
      </section>

      <!-- results -->
      <section v-else class="d-flex flex-column align-items-center text-center gap-3" data-testid="deck-results">
        <!-- placeholder until the plant avatar art is ready -->
        <div class="avatar-placeholder text-label-field">Plant avatar</div>

        <div>
          <h1 class="m-0">🌱 Deck Complete!</h1>
          <p class="bark-muted m-0">You went through {{ totalCards }} cards.</p>
        </div>

        <div class="stats d-flex flex-wrap gap-3 w-100 justify-content-center">
          <div class="stat stat-forgot">
            <span class="text-label-field">Forgot</span>
            <span class="text-stat">{{ counts.forgot }}</span>
          </div>
          <div class="stat stat-hard">
            <span class="text-label-field">Hard</span>
            <span class="text-stat">{{ counts.hard }}</span>
          </div>
          <div class="stat stat-easy">
            <span class="text-label-field">Easy</span>
            <span class="text-stat">{{ counts.easy }}</span>
          </div>
          <div class="stat stat-time">
            <span class="text-label-field">Time</span>
            <span class="text-stat">{{ timeTaken }}</span>
          </div>
        </div>

        <p class="text-body-small m-0">Counts are from the first time you saw each card.</p>
        <p v-if="error" class="text-danger m-0" role="alert">{{ error }}</p>

        <button type="button" class="btn-primary border-0 text-button finish-btn" data-testid="deck-finish"
          :disabled="saving" @click="finishSession">
          {{ saving ? 'Saving…' : 'Water my plant' }}
        </button>
      </section>
    </div>
  </main>
</template>

<style scoped>
.deck-page {
  min-height: 100vh;
  padding: 32px 16px 48px;
  background: var(--cream);
}

.deck-container {
  max-width: 720px;
  margin: 0 auto;
}

.bark-muted {
  color: var(--bark-muted);
}

.done-pill {
  padding: 2px 14px;
  border-radius: 999px;
  background: var(--mint);
  color: var(--bark);
  font-variant-numeric: tabular-nums;
}

.deck-progress-fill {
  background: var(--mint-deep);
  transition: width 0.35s var(--spring);
}

/* flip card: both faces share one grid cell, so the card is as tall as the longer face */
.flashcard {
  perspective: 1400px;
}

.flashcard-inner {
  display: grid;
  transform-style: preserve-3d;
  transition: transform 0.6s var(--spring);
}

.flashcard.is-flipped .flashcard-inner {
  transform: rotateY(180deg);
}

.flashcard-face {
  grid-area: 1 / 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  min-height: 340px;
  padding: 28px 24px;
  border: 2px solid var(--linen);
  border-radius: 20px;
  background: var(--paper);
  box-shadow: 0 8px 24px -6px var(--shadow-card), 0 4px 0 var(--linen);
  text-align: center;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}

.flashcard-back {
  transform: rotateY(180deg);
}

.flashcard-text {
  overflow-wrap: anywhere;
}

.show-answer-btn,
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
.avatar-placeholder {
  display: grid;
  place-items: center;
  width: 96px;
  height: 96px;
  border: 2px dashed var(--linen);
  border-radius: 16px;
  color: var(--bark-muted);
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex: 1 1 120px;
  max-width: 160px;
  padding: 14px 8px;
  border: 2px solid;
  border-radius: 16px;
  color: var(--bark-muted);
}

.stat-forgot {
  border-color: var(--bs-danger);
  background: color-mix(in srgb, var(--bs-danger) 10%, var(--paper));
}

.stat-forgot .text-stat { color: var(--bs-danger); }

.stat-hard {
  border-color: var(--bs-warning);
  background: color-mix(in srgb, var(--bs-warning) 14%, var(--paper));
}

.stat-hard .text-stat { color: var(--butter-deep); }

.stat-easy {
  border-color: var(--bs-success);
  background: color-mix(in srgb, var(--bs-success) 10%, var(--paper));
}

.stat-easy .text-stat { color: var(--bs-success); }

.stat-time {
  border-color: var(--periwinkle);
  background: var(--peri-soft);
}

.stat-time .text-stat { color: color-mix(in srgb, var(--periwinkle) 55%, var(--bark)); }

@media (prefers-reduced-motion: reduce) {
  .flashcard-inner {
    transition: none;
  }
}
</style>
