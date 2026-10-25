<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGardenStore } from '@/stores/garden'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'
import { shuffle } from '@/lib/shuffle'
import { useStudyTimer } from '@/composables/useStudyTimer'
import ConfettiBurst from '@/components/ConfettiBurst.vue'

// "Short Structured Mode" review session: up to 10 questions from one seed. The user types each answer and the
// server has AI mark it (one call per answer, see POST /api/seeds/:id/grade), then claims coins on a results screen.
const MAX_QUESTIONS = 10
const MAX_RESPONSE = 1000
const PETALS = 10 // petals in the burst on a correct answer
const VERDICTS = {
  short_correct: { label: '🌸 Correct', tone: 'correct' },
  short_partial: { label: '🌿 Partly right', tone: 'partial' },
  short_wrong: { label: '🥀 Not quite', tone: 'wrong' },
}

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
const response = ref('')
const marking = ref(false)
const mark = ref(null) // { score, rating, feedback } for the current question once marked
const markError = ref('')
const scores = ref([]) // AI score (0-100) per marked question
const finished = ref(false)
const startedAt = ref(0)
const elapsedMs = ref(0)
const confetti = ref(null) // <ConfettiBurst>, rained on an average of 75%+
const claiming = ref(false)
const coinsClaimed = ref(false) // so a retry after a failed claim never pays twice
const results = ref([]) // one { card_id, rating: 'short_correct' | 'short_partial' | 'short_wrong' } per question, saved on claim
let markRequest // AbortController of the marking call in flight

const seed = computed(() => garden.seeds.find(item => item.id === route.params.id))
const current = computed(() => questions.value[index.value])
const total = computed(() => questions.value.length)
const isLast = computed(() => index.value === total.value - 1)
const verdict = computed(() => mark.value && VERDICTS[mark.value.rating])
const correctCount = computed(() => results.value.filter(r => r.rating === 'short_correct').length)
const accuracy = computed(() => (scores.value.length ? Math.round(scores.value.reduce((n, s) => n + s, 0) / scores.value.length) : 0))
// 1.5x Structured Quiz's coins (30 / 20 / 10): typing answers from memory is the hardest mode
const reward = computed(() => (accuracy.value >= 90 ? 45 : accuracy.value >= 75 ? 30 : accuracy.value >= 60 ? 15 : 0))
const timeTaken = computed(() => {
  const seconds = Math.round(elapsedMs.value / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
})

onMounted(async () => {
  try {
    if (!garden.loaded) await garden.fetchSeeds()
    if (!seed.value) error.value = 'This seed could not be found in your garden.'
    else if (!seed.value.cards.length) error.value = 'This seed has no flashcards to quiz you on yet.'
    else {
      // weakest cards first (random among equals), asked in random order
      questions.value = shuffle(shuffle(seed.value.cards).sort((a, b) => a.card_mastery - b.card_mastery).slice(0, MAX_QUESTIONS))
      startedAt.value = Date.now()
      studyTimer.start()
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
})

onUnmounted(() => markRequest?.abort())

async function check() {
  if (marking.value || mark.value) return
  marking.value = true
  markError.value = ''
  studyTimer.mark()
  markRequest = new AbortController()
  try {
    const result = await garden.gradeAnswer(seed.value.id, current.value.id, response.value, markRequest.signal)
    mark.value = result
    scores.value.push(result.score)
    results.value.push({ card_id: current.value.id, rating: result.rating })
  } catch (e) {
    if (!markRequest.signal.aborted) markError.value = e instanceof Error ? e.message : String(e)
  } finally {
    marking.value = false
  }
}

function next() {
  if (!mark.value) return
  studyTimer.mark()
  if (isLast.value) return finish()
  index.value++
  response.value = ''
  mark.value = null
  markError.value = ''
}

function finish() {
  elapsedMs.value = Date.now() - startedAt.value
  finished.value = true
  if (accuracy.value >= 75) confetti.value?.rain()
}

// Ctrl+Enter (or Cmd+Enter) checks the answer; Enter goes on once it's marked
function onKeydown(e) {
  if (e.key !== 'Enter') return
  if (!mark.value && (e.ctrlKey || e.metaKey)) {
    e.preventDefault()
    check()
  } else if (mark.value) {
    e.preventDefault()
    next()
  }
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
    // each card: correct +15 / partial +6 / wrong -5 mastery (server/src/models/seedModel.js); also waters the plant
    await garden.saveReview(seed.value.id, results.value)
    toast.show({
      type: reward.value ? 'reward' : 'success',
      title: reward.value ? `+${reward.value} coins` : 'Session saved',
      message: reward.value ? `You averaged ${accuracy.value}% on ${seed.value.title}.` : `${seed.value.title} got a little water.`,
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
  <main class="review-page" @keydown="onKeydown">
    <div class="review-container">
      <p v-if="loading" role="status">Getting your questions ready…</p>

      <section v-else-if="!questions.length" class="text-center d-flex flex-column align-items-center gap-3 pt-5">
        <img src="../assets/ui/sprout.svg" width="96" height="96" alt="">
        <p class="text-danger" role="alert">{{ error }}</p>
        <button type="button" class="btn-secondary text-button" @click="backToGarden">Back to garden</button>
      </section>

      <!-- questions -->
      <section v-else-if="!finished" class="d-flex flex-column gap-4" data-testid="short-quiz">
        <header class="d-flex flex-column gap-2">
          <div class="d-flex align-items-center gap-3">
            <button type="button" class="btn-close" aria-label="Quit and go back to garden" @click="backToGarden" />
            <span class="text-label-field flex-grow-1 bark-muted">Question {{ index + 1 }} of {{ total }}</span>
            <span :key="correctCount" class="score-pill text-button" :class="{ pop: correctCount }" :aria-label="`${correctCount} correct`">✓ {{ correctCount }}</span>
          </div>
          <div class="progress" role="progressbar" :aria-valuenow="scores.length" aria-valuemin="0" :aria-valuemax="total">
            <div class="progress-fill review-progress-fill" :style="{ width: `${(scores.length / total) * 100}%` }" />
          </div>
        </header>

        <!-- host: empty avatar for now, and a speech box with the taunt above the question -->
        <div class="host d-flex gap-3 align-items-stretch">
          <div class="host-avatar flex-shrink-0 d-flex align-items-center justify-content-center text-center p-2" aria-hidden="true" data-testid="short-avatar">
            <span class="text-label-caption">[avatar floating and moving a bit using CSS?]</span>
          </div>
          <div class="speech d-flex flex-column gap-2 flex-grow-1">
            <p class="taunt text-body-strong m-0" data-testid="short-taunt">Let's see how well you know {{ seed.title }}!</p>
            <h2 class="m-0">{{ current.question }}</h2>
          </div>
        </div>

        <label class="d-flex flex-column gap-2">
          <span class="text-label-field">Your answer</span>
          <textarea v-model="response" class="answer-box" rows="5" :maxlength="MAX_RESPONSE" :disabled="marking || !!mark"
            placeholder="Type your answer… (Ctrl+Enter to check)" data-testid="short-answer" />
        </label>

        <p v-if="markError" class="text-danger m-0" role="alert">{{ markError }}</p>

        <button v-if="!mark" type="button" class="btn-primary border-0 text-button w-auto align-self-end"
          :disabled="marking" data-testid="short-check" @click="check">
          {{ marking ? 'Marking…' : markError ? 'Try again' : 'Check answer' }}
        </button>

        <!-- marked -->
        <template v-else>
          <div class="verdict d-flex flex-column gap-2" :class="`is-${verdict.tone}`" role="status" data-testid="short-verdict">
            <span class="text-body-strong">{{ verdict.label }} · {{ mark.score }}%</span>
            <p class="m-0">{{ mark.feedback }}</p>
            <span v-if="verdict.tone === 'correct'" class="petals" aria-hidden="true">
              <span v-for="i in PETALS" :key="i" class="petal" :style="{ '--angle': `${(360 / PETALS) * i}deg` }" />
            </span>
          </div>
          <div class="model-answer d-flex flex-column gap-1">
            <span class="text-label-caption bark-muted">Model answer</span>
            <p class="m-0">{{ current.answer }}</p>
          </div>
          <button type="button" class="btn-primary border-0 text-button w-auto align-self-end" data-testid="short-next" @click="next">
            {{ isLast ? 'See results' : 'Next question' }}
          </button>
        </template>
      </section>

      <!-- results -->
      <section v-else class="d-flex flex-column align-items-center text-center gap-3" data-testid="short-results">
        <img src="../assets/ui/sprout.svg" width="96" height="96" alt="">
        <div>
          <h1 class="m-0">Session complete!</h1>
          <p class="bark-muted m-0">{{ correctCount }} of {{ total }} fully correct</p>
        </div>

        <div class="d-flex gap-3 w-100 justify-content-center">
          <div class="review-stat">
            <span class="text-label-field">Coins</span>
            <span class="text-stat" data-testid="short-reward">+{{ reward }}</span>
          </div>
          <div class="review-stat">
            <span class="text-label-field">Average</span>
            <span class="text-stat">{{ accuracy }}%</span>
          </div>
          <div class="review-stat">
            <span class="text-label-field">Time</span>
            <span class="text-stat">{{ timeTaken }}</span>
          </div>
        </div>

        <p class="text-body-small m-0">{{ reward ? 'Typed answers earn 1.5× coins.' : 'Average 60% or more to earn coins (1.5× for typed answers).' }}</p>
        <p v-if="error" class="text-danger m-0" role="alert">{{ error }}</p>

        <button type="button" class="btn-primary border-0 text-button claim-btn" data-testid="short-claim"
          :disabled="claiming" @click="claim">
          {{ claiming ? 'Claiming…' : 'Claim Rewards' }}
        </button>
      </section>
    </div>

    <ConfettiBurst ref="confetti" />
  </main>
</template>

<style scoped>
.bark-muted {
  color: var(--bark-muted);
}

.answer-box {
  width: 100%;
  padding: 14px 16px;
  border: 2px solid var(--linen);
  border-radius: 16px;
  background: var(--paper);
  color: var(--bark);
  resize: vertical;
}

.answer-box:focus {
  outline: none;
  border-color: var(--periwinkle);
}

.answer-box:disabled {
  background: var(--cream);
}

.verdict {
  position: relative;
  padding: 16px 20px;
  border: 2px solid;
  border-radius: 16px;
}

.verdict.is-correct {
  border-color: var(--mint-deep);
  background: var(--mint);
}

.verdict.is-partial {
  border-color: var(--butter-deep);
  background: color-mix(in srgb, var(--butter) 40%, var(--paper));
}

.verdict.is-wrong {
  border-color: var(--berry);
  background: color-mix(in srgb, var(--berry) 14%, var(--paper));
}

.host-avatar {
  width: 120px;
  min-height: 140px;
  border: 2px dashed var(--linen);
  border-radius: 16px;
  background: var(--paper);
  color: var(--bark-muted);
  overflow-wrap: anywhere;
}

.speech {
  min-width: 0;
  padding: 16px 20px;
  border: 2px solid var(--linen);
  border-radius: 16px;
  background: var(--paper);
  box-shadow: 0 4px 0 var(--linen);
}

.taunt {
  color: color-mix(in srgb, var(--periwinkle) 55%, var(--bark));
}

@media (max-width: 480px) {
  .host-avatar {
    width: 64px;
    min-height: 80px;
  }
}

.model-answer {
  padding: 16px 20px;
  border: 2px dashed var(--linen);
  border-radius: 16px;
  background: var(--paper);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* per-answer moments: correct pops with a petal burst, partly right wiggles like a leaf, wrong droops */
.verdict.is-correct { animation: verdict-pop 0.45s var(--spring); }
.verdict.is-partial { animation: leaf-wiggle 0.6s ease-in-out; }
.verdict.is-wrong { animation: verdict-droop 0.4s ease-out; }
.score-pill.pop { animation: pill-pop 0.4s var(--spring); }

.petals {
  position: absolute;
  top: 26px;
  left: 28px;
  pointer-events: none;
}

.petal {
  position: absolute;
  width: 10px;
  height: 14px;
  margin: -7px 0 0 -5px;
  border-radius: 50% 50% 50% 0;
  background: var(--peach);
  opacity: 0;
  animation: petal-burst 0.9s ease-out forwards;
}

.petal:nth-child(3n + 2) { background: var(--berry); }
.petal:nth-child(3n) { background: var(--lilac); }

@keyframes verdict-pop {
  0% { transform: scale(0.96); }
  60% { transform: scale(1.02); }
  100% { transform: scale(1); }
}

@keyframes leaf-wiggle {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-1.2deg); }
  75% { transform: rotate(1.2deg); }
}

@keyframes verdict-droop {
  0% { transform: translateY(-6px); opacity: 0.6; }
  100% { transform: translateY(0); opacity: 1; }
}

@keyframes pill-pop {
  0% { transform: scale(1); }
  50% { transform: scale(1.3); }
  100% { transform: scale(1); }
}

@keyframes petal-burst {
  0% { opacity: 1; transform: rotate(var(--angle)) translateY(0) scale(1); }
  100% { opacity: 0; transform: rotate(var(--angle)) translateY(-64px) scale(0.6); }
}

@media (prefers-reduced-motion: reduce) {
  .verdict, .score-pill.pop { animation: none; }
  .petals { display: none; }
}
</style>
