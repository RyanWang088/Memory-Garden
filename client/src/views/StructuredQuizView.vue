<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGardenStore } from '@/stores/garden'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'
import { shuffle } from '@/lib/shuffle'
import { useStudyTimer } from '@/composables/useStudyTimer'

// "Structured Quiz Mode" review session: up to 10 multiple-choice questions from one seed,
// then a results screen where the user claims coins for their score.
const MAX_QUESTIONS = 10
const LETTERS = ['A', 'B', 'C', 'D']
const CONFETTI_MS = 3000
const CONFETTI_COLORS = ['var(--peach)', 'var(--mint-deep)', 'var(--berry)', 'var(--periwinkle)', 'var(--butter)', 'var(--lilac)']

const route = useRoute()
const router = useRouter()
const garden = useGardenStore()
const auth = useAuthStore()
const toast = useToastStore()
const studyTimer = useStudyTimer() // adds this session's active time to the profile when the page closes

const loading = ref(true)
const error = ref('')
const questions = ref([])
const index = ref(0)
const chosen = ref(null) // option index picked for the current question
const correctCount = ref(0)
const finished = ref(false)
const startedAt = ref(0)
const elapsedMs = ref(0)
const confetti = ref([])
const claiming = ref(false)
const coinsClaimed = ref(false) // so a retry after a failed claim never pays twice
const results = [] // one { card_id, rating: 'correct' | 'wrong' } per question, saved on claim
let confettiTimer

const seed = computed(() => garden.seeds.find(item => item.id === route.params.id))
const current = computed(() => questions.value[index.value])
const total = computed(() => questions.value.length)
const answered = computed(() => index.value + (chosen.value === null ? 0 : 1))
const isLast = computed(() => index.value === total.value - 1)
const accuracy = computed(() => (total.value ? Math.round((correctCount.value / total.value) * 100) : 0))
const reward = computed(() => (accuracy.value >= 90 ? 30 : accuracy.value >= 75 ? 20 : accuracy.value >= 60 ? 10 : 0))
const tier = computed(() => (accuracy.value >= 75 ? 'high' : accuracy.value >= 60 ? 'mid' : 'low'))
const heading = computed(() => ({ high: '🌷 Quiz Complete!', mid: '🌿 Quiz Complete!', low: '🌱 Quiz Complete!' })[tier.value])
const timeTaken = computed(() => {
  const seconds = Math.round(elapsedMs.value / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
})

// results ring
const RING_RADIUS = 52
const RING_LENGTH = 2 * Math.PI * RING_RADIUS
const ringOffset = computed(() => RING_LENGTH * (1 - accuracy.value / 100))

const norm = (text) => text.trim().toLowerCase()

// Weakest cards first (random among equals). Wrong options are the card's own trap answers (wrong_options,
// typed when planting) first, then other cards' answers: from this seed, then seeds of the same subject, then any seed.
function buildQuiz(target, allSeeds) {
  const picked = shuffle(target.cards).sort((a, b) => a.card_mastery - b.card_mastery).slice(0, MAX_QUESTIONS)
  const others = allSeeds.filter(s => s.id !== target.id)
  const pools = [
    target.cards,
    others.filter(s => s.subject === target.subject).flatMap(s => s.cards),
    others.filter(s => s.subject !== target.subject).flatMap(s => s.cards),
  ].map(cards => cards.map(c => c.answer))

  return shuffle(picked).map((card) => {
    const seen = new Set([norm(card.answer)])
    const wrong = []
    for (const pool of [card.wrong_options ?? [], ...pools]) {
      for (const answer of shuffle(pool)) {
        if (wrong.length === LETTERS.length - 1) break
        if (seen.has(norm(answer))) continue
        seen.add(norm(answer))
        wrong.push(answer)
      }
    }
    return { id: card.id, question: card.question, answer: card.answer, options: shuffle([card.answer, ...wrong]) }
  })
}

onMounted(async () => {
  window.addEventListener('keydown', onKeydown)
  try {
    if (!garden.loaded) await garden.fetchSeeds()
    if (!seed.value) error.value = 'This seed could not be found in your garden.'
    else if (!seed.value.cards.length) error.value = 'This seed has no flashcards to quiz you on yet.'
    else {
      questions.value = buildQuiz(seed.value, garden.seeds)
      startedAt.value = Date.now()
      studyTimer.start()
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  clearTimeout(confettiTimer)
})

function choose(optionIndex) {
  if (chosen.value !== null || finished.value) return
  chosen.value = optionIndex
  studyTimer.mark()
  const correct = current.value.options[optionIndex] === current.value.answer
  if (correct) correctCount.value++
  results.push({ card_id: current.value.id, rating: correct ? 'correct' : 'wrong' })
}

function next() {
  if (chosen.value === null) return
  studyTimer.mark()
  if (isLast.value) return finish()
  index.value++
  chosen.value = null
}

function finish() {
  elapsedMs.value = Date.now() - startedAt.value
  finished.value = true
  if (accuracy.value >= 75) rainConfetti()
}

function rainConfetti() {
  confetti.value = Array.from({ length: 90 }, (_, id) => ({
    id,
    style: {
      left: `${Math.random() * 100}%`,
      background: CONFETTI_COLORS[id % CONFETTI_COLORS.length],
      animationDelay: `${Math.random() * 1.2}s`,
      animationDuration: `${1.6 + Math.random() * 1.2}s`,
      transform: `rotate(${Math.random() * 360}deg)`,
    },
  }))
  confettiTimer = setTimeout(() => { confetti.value = [] }, CONFETTI_MS)
}

// 1-4 or A-D picks an option, Enter goes to the next question
function onKeydown(e) {
  if (finished.value || !current.value || e.ctrlKey || e.metaKey || e.altKey) return
  const key = e.key.toUpperCase()
  const pick = LETTERS.includes(key) ? LETTERS.indexOf(key) : Number(key) - 1
  if (Number.isInteger(pick) && pick >= 0 && pick < current.value.options.length) choose(pick)
  else if (e.key === 'Enter' && chosen.value !== null) {
    e.preventDefault()
    next()
  }
}

function optionState(optionIndex) {
  if (chosen.value === null) return ''
  const option = current.value.options[optionIndex]
  if (option === current.value.answer) return 'is-correct'
  return optionIndex === chosen.value ? 'is-wrong' : 'is-dim'
}

async function claim() {
  if (claiming.value) return
  claiming.value = true
  error.value = ''
  try {
    if (reward.value && !coinsClaimed.value) {
      await auth.updateProfile({ coins: auth.profile.coins + reward.value })
      coinsClaimed.value = true
    }
    // each card: correct +5 / wrong -5 mastery; also waters the plant
    await garden.saveReview(seed.value.id, results)
    toast.show({
      type: reward.value ? 'reward' : 'success',
      title: reward.value ? `+${reward.value} coins` : 'Session saved',
      message: reward.value ? `You scored ${accuracy.value}% on ${seed.value.title}.` : `${seed.value.title} got a little water.`,
    })
    await router.push({ name: 'garden', query: { scrollTo: seed.value.id } })
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    claiming.value = false
  }
}

function backToGarden() {
  router.push({ name: 'garden' })
}
</script>

<template>
  <main class="quiz-page">
    <div class="quiz-container">
      <p v-if="loading" role="status">Getting your questions ready…</p>

      <section v-else-if="!questions.length" class="text-center d-flex flex-column align-items-center gap-3 pt-5">
        <img src="../assets/ui/sprout.svg" width="96" height="96" alt="">
        <p class="text-danger" role="alert">{{ error }}</p>
        <button type="button" class="btn-secondary text-button" @click="backToGarden">Back to garden</button>
      </section>

      <!-- quiz -->
      <section v-else-if="!finished" class="d-flex flex-column gap-4" data-testid="quiz-quiz">
        <header class="d-flex flex-column gap-2">
          <div class="d-flex align-items-center gap-3">
            <button type="button" class="btn-close" aria-label="Quit and go back to garden" @click="backToGarden" />
            <span class="text-label-field flex-grow-1 bark-muted">Question {{ index + 1 }} of {{ total }}</span>
            <span class="score-pill text-button" data-testid="quiz-correct" :aria-label="`${correctCount} correct`">✓ {{ correctCount }}</span>
          </div>
          <div class="progress" role="progressbar" :aria-valuenow="answered" aria-valuemin="0" :aria-valuemax="total">
            <div class="progress-fill quiz-progress-fill" :style="{ width: `${(answered / total) * 100}%` }" />
          </div>
        </header>

        <h2 class="m-0">{{ current.question }}</h2>

        <div class="d-flex flex-column gap-3" role="group" aria-label="Answer options">
          <button v-for="(option, i) in current.options" :key="`${current.id}-${i}`" type="button" class="option"
            :class="optionState(i)" :disabled="chosen !== null" :data-testid="`quiz-option-${i}`" @click="choose(i)">
            <span class="option-letter text-button" aria-hidden="true">{{ LETTERS[i] }}</span>
            <span class="text-body-strong text-start">{{ option }}</span>
          </button>
        </div>

        <footer v-if="chosen !== null" class="d-flex align-items-center justify-content-between gap-3 flex-wrap">
          <p class="text-body-strong m-0" role="status">
            {{ current.options[chosen] === current.answer ? '🌸 Correct!' : '🥀 Not quite. The right answer is highlighted.' }}
          </p>
          <button type="button" class="btn-primary border-0 text-button w-auto" data-testid="quiz-next" @click="next">
            {{ isLast ? 'See results' : 'Next question' }}
          </button>
        </footer>
      </section>

      <!-- results -->
      <section v-else class="d-flex flex-column align-items-center text-center gap-3" data-testid="quiz-results">
        <!-- placeholder until the plant avatar art is ready -->
        <div class="avatar-placeholder text-label-field">Plant avatar</div>

        <div class="ring" :class="`tier-${tier}`">
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle cx="60" cy="60" :r="RING_RADIUS" class="ring-track" />
            <circle cx="60" cy="60" :r="RING_RADIUS" class="ring-fill" :stroke-dasharray="RING_LENGTH"
              :stroke-dashoffset="ringOffset" />
          </svg>
          <span class="ring-label text-display">{{ accuracy }}%</span>
        </div>

        <div>
          <h1 class="m-0">{{ heading }}</h1>
          <p class="bark-muted m-0">Your Score: {{ correctCount }}/{{ total }}</p>
        </div>

        <div class="stats d-flex gap-3 w-100 justify-content-center">
          <div class="stat stat-coins">
            <span class="text-label-field">Coins</span>
            <span class="text-stat" data-testid="quiz-reward">+{{ reward }}</span>
          </div>
          <div class="stat stat-accuracy">
            <span class="text-label-field">Accuracy</span>
            <span class="text-stat">{{ accuracy }}%</span>
          </div>
          <div class="stat stat-time">
            <span class="text-label-field">Time</span>
            <span class="text-stat">{{ timeTaken }}</span>
          </div>
        </div>

        <p v-if="!reward" class="text-body-small m-0">Score 60% or more to earn coins.</p>
        <p v-if="error" class="text-danger m-0" role="alert">{{ error }}</p>

        <button type="button" class="btn-primary border-0 text-button claim-btn" data-testid="quiz-claim"
          :disabled="claiming" @click="claim">
          {{ claiming ? 'Claiming…' : 'Claim Rewards' }}
        </button>
      </section>
    </div>

    <div v-if="confetti.length" class="confetti" aria-hidden="true">
      <span v-for="piece in confetti" :key="piece.id" class="confetti-piece" :style="piece.style" />
    </div>
  </main>
</template>

<style scoped>
.quiz-page {
  min-height: 100vh;
  padding: 32px 16px 48px;
  background: var(--cream);
}

.quiz-container {
  max-width: 720px;
  margin: 0 auto;
}

.bark-muted {
  color: var(--bark-muted);
}

.score-pill {
  padding: 2px 14px;
  border-radius: 999px;
  background: var(--mint);
  color: var(--bark);
  font-variant-numeric: tabular-nums;
}

.quiz-progress-fill {
  background: var(--mint-deep);
  transition: width 0.35s var(--spring);
}

.option {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
  padding: 16px 20px;
  border: 2px solid var(--linen);
  border-radius: 16px;
  background: var(--paper);
  color: var(--bark);
  box-shadow: 0 4px 0 var(--linen);
  transition: transform 0.18s var(--spring), box-shadow 0.18s ease, border-color 0.18s ease, opacity 0.18s ease;
}

.option:hover:not(:disabled) {
  border-color: var(--peach);
  box-shadow: 0 6px 0 var(--peach);
  transform: translateY(-2px);
}

.option:focus-visible {
  outline: 3px solid var(--periwinkle);
  outline-offset: 3px;
}

.option:disabled {
  cursor: default;
}

.option-letter {
  display: grid;
  place-items: center;
  flex: 0 0 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--linen);
  color: var(--bark-muted);
}

.option.is-correct {
  border-color: var(--mint-deep);
  background: var(--mint);
  box-shadow: 0 4px 0 var(--mint-deep);
}

.option.is-correct .option-letter {
  background: var(--mint-deep);
  color: var(--paper);
}

.option.is-wrong {
  border-color: var(--berry);
  background: color-mix(in srgb, var(--berry) 14%, var(--paper));
  box-shadow: 0 4px 0 var(--berry);
}

.option.is-wrong .option-letter {
  background: var(--berry);
  color: var(--paper);
}

.option.is-dim {
  opacity: 0.55;
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

.ring {
  position: relative;
  width: 200px;
  height: 200px;
}

.ring svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.ring-track,
.ring-fill {
  fill: none;
  stroke-width: 10;
}

.ring-track {
  stroke: var(--linen);
}

.ring-fill {
  stroke-linecap: round;
  transition: stroke-dashoffset 1s ease-out;
}

.ring-label {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
}

.tier-high .ring-fill { stroke: var(--mint-deep); }
.tier-high .ring-label { color: var(--mint-deep); }
.tier-mid .ring-fill { stroke: var(--butter-deep); }
.tier-mid .ring-label { color: var(--butter-deep); }
.tier-low .ring-fill { stroke: var(--berry); }
.tier-low .ring-label { color: var(--berry-ink); }

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex: 1 1 0;
  max-width: 180px;
  padding: 14px 8px;
  border: 2px solid;
  border-radius: 16px;
  color: var(--bark-muted);
}

.stat-coins {
  border-color: var(--butter);
  background: color-mix(in srgb, var(--butter) 25%, var(--paper));
}

.stat-coins .text-stat { color: var(--butter-deep); }

.stat-accuracy {
  border-color: var(--peach);
  background: color-mix(in srgb, var(--peach) 22%, var(--paper));
}

.stat-accuracy .text-stat { color: var(--berry-ink); }

.stat-time {
  border-color: var(--periwinkle);
  background: var(--peri-soft);
}

.stat-time .text-stat { color: color-mix(in srgb, var(--periwinkle) 55%, var(--bark)); }

.claim-btn {
  justify-content: center;
  width: 100%;
  max-width: 420px;
  margin-top: 8px;
}

.claim-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* confetti */
.confetti {
  position: fixed;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 1100;
}

.confetti-piece {
  position: absolute;
  top: -16px;
  width: 8px;
  height: 14px;
  border-radius: 2px;
  animation-name: confetti-fall;
  animation-timing-function: linear;
  animation-fill-mode: forwards;
}

@keyframes confetti-fall {
  to {
    top: 105vh;
    rotate: 720deg;
    translate: 40px 0;
  }
}

@media (max-width: 480px) {
  .stats {
    gap: 8px !important;
  }

  .stat .text-stat {
    font-size: 22px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .confetti {
    display: none;
  }
}
</style>
