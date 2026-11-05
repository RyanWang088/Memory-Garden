<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGardenStore } from '@/stores/garden'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'
import { shuffle } from '@/lib/shuffle'
import { useStudyTimer } from '@/composables/useStudyTimer'
import { moodNow } from '@/lib/greeting'
import SceneryBackdrop from '@/components/SceneryBackdrop.vue'
import { ding, fanfare, unlockAudio } from '@/lib/beep'
import ConfettiBurst from '@/components/ConfettiBurst.vue'
import ScoreRing from '@/components/ScoreRing.vue'
import SproutIcon from '@/components/SproutIcon.vue'
import { foliageUrl } from '@/lib/plantSprites'

// "Short Structured Mode" review session: up to 10 questions from one seed. The user types each answer and the
// server has AI mark it (one call per answer, see POST /api/seeds/:id/grade), then claims coins on a results screen.
const MAX_QUESTIONS = 10
const MAX_RESPONSE = 1000
const PETALS = 10 // petals in the burst on a correct answer
const VERDICTS = {
  short_correct: { label: 'Correct', tone: 'correct' },
  short_partial: { label: 'Partly right', tone: 'partial' },
  short_wrong: { label: 'Not quite', tone: 'wrong' },
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
// the meadow behind the sheet, like the Focus page: the time of day while reviewing, blush on the results
const mood = computed(() => (finished.value ? 'blush' : moodNow()))
const narrow = typeof window !== 'undefined' && window.innerWidth < 600
const startedAt = ref(0)
const elapsedMs = ref(0)
const confetti = ref(null) // <ConfettiBurst>, rained on an average of 75%+
const claiming = ref(false)
const coinsClaimed = ref(false) // so a retry after a failed claim never pays twice
const results = ref([]) // one { card_id, rating: 'short_correct' | 'short_partial' | 'short_wrong' } per question, saved on claim
let markRequest // AbortController of the marking call in flight

const TONES = ['', 'is-leaf', 'is-berry']
const flower = computed(() => auth.profile?.onboarding_answers?.flower || 'pink')
const seed = computed(() => garden.seeds.find(item => item.id === route.params.id))
const current = computed(() => questions.value[index.value])
const total = computed(() => questions.value.length)
const isLast = computed(() => index.value === total.value - 1)
const verdict = computed(() => mark.value && VERDICTS[mark.value.rating])
const correctCount = computed(() => results.value.filter(r => r.rating === 'short_correct').length)
const accuracy = computed(() => (scores.value.length ? Math.round(scores.value.reduce((n, s) => n + s, 0) / scores.value.length) : 0))
// coins: 45 at 90%+, 30 at 75%+, 15 at 60%+
const reward = computed(() => (accuracy.value >= 90 ? 45 : accuracy.value >= 75 ? 30 : accuracy.value >= 60 ? 15 : 0))
// same tiers and headings as the Multiple Choice Quiz's results
const tier = computed(() => (accuracy.value >= 75 ? 'high' : accuracy.value >= 60 ? 'mid' : 'low'))
const timeTaken = computed(() => {
  const seconds = Math.round(elapsedMs.value / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
})
const stats = computed(() => [
  { label: 'Coins', value: `+${reward.value}`, testid: 'short-reward' },
  { label: 'Average', value: `${accuracy.value}%` },
  { label: 'Time', value: timeTaken.value },
])

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
  unlockAudio() // this click allows sound, so the ding can play once the mark comes back
  markRequest = new AbortController()
  try {
    const result = await garden.gradeAnswer(seed.value.id, current.value.id, response.value, markRequest.signal)
    mark.value = result
    scores.value.push(result.score)
    results.value.push({ card_id: current.value.id, rating: result.rating })
    if (result.rating === 'short_correct') ding()
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
  fanfare()
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
  <main class="sp-review-page phone-card" @keydown="onKeydown">
    <SceneryBackdrop :mood="mood" :options="{ seed: 31, tulips: narrow ? 3 : 10, butterflies: 2, horizon: 0.64 }" />
    <div class="sp-review-container sp-review-sheet">
      <p v-if="loading" role="status">Getting your questions ready…</p>

      <section v-else-if="!questions.length" class="text-center d-flex flex-column align-items-center gap-3 pt-5">
        <img src="../assets/ui/sprout.svg" width="96" height="96" alt="">
        <p class="text-berry-deep" role="alert">{{ error }}</p>
        <button type="button" class="sp-btn sp-btn-butter text-button" @click="backToGarden">Back to garden</button>
      </section>

      <!-- questions -->
      <section v-else-if="!finished" class="quiz d-flex flex-column" data-testid="short-quiz">
        <header class="sp-review-header d-flex flex-column gap-2">
          <div class="d-flex align-items-center gap-3">
            <button type="button" class="btn-close" aria-label="Quit and go back to garden" @click="backToGarden" />
            <span class="sp-field flex-grow-1 ink-soft">Question {{ index + 1 }} of {{ total }}</span>
            <span :key="correctCount" class="sp-score-pill text-button" :class="{ pop: correctCount }" :aria-label="`${correctCount} correct`">✓ {{ correctCount }}</span>
          </div>
          <div class="progress" role="progressbar" :aria-valuenow="scores.length" aria-valuemin="0" :aria-valuemax="total">
            <div class="progress-fill sp-review-progress-fill" :style="{ width: `${(scores.length / total) * 100}%` }" />
          </div>
        </header>

        <h2 class="question m-0">{{ current.question }}</h2>

        <!-- written straight onto the notebook lines -->
        <label class="d-flex flex-column">
          <span class="ans-label sp-field d-flex align-items-end justify-content-between">
            <span>Your answer</span>
            <span class="sp-hand count">{{ response.length }} / {{ MAX_RESPONSE }}</span>
          </span>
          <textarea v-model="response" class="answer-box sp-hand" rows="5" :maxlength="MAX_RESPONSE" :disabled="marking || !!mark"
            placeholder="Type your answer… (Ctrl+Enter to check)" data-testid="short-answer" />
        </label>

        <p v-if="markError" class="text-berry-deep mb-0" role="alert">{{ markError }}</p>

        <!-- on phones the button sits at the bottom of the card (.quiz-end) -->
        <div v-if="!mark" class="quiz-end d-flex flex-column">
          <button type="button" class="sp-btn border-0 text-button w-auto align-self-end"
            :disabled="marking" data-testid="short-check" @click="check">
            {{ marking ? 'Marking…' : markError ? 'Try again' : 'Check answer' }}
          </button>
        </div>

        <!-- marked -->
        <template v-else>
          <div class="verdict sp-note d-flex flex-column gap-2" :class="[`is-${verdict.tone}`, { 'is-leaf': verdict.tone === 'correct', 'is-berry': verdict.tone === 'wrong' }]" role="status" data-testid="short-verdict">
            <span class="sp-tape" :class="{ 'is-leaf': verdict.tone === 'correct' }" aria-hidden="true"></span>
            <div class="d-flex align-items-center gap-3">
              <SproutIcon v-if="verdict.tone === 'wrong'" name="wilted" :size="40" />
              <img v-else class="verdict-art" :src="foliageUrl(verdict.tone === 'correct' ? `tulip-${flower}-4` : 'sprout')" alt="" />
              <div class="flex-grow-1">
                <div class="d-flex justify-content-between align-items-baseline gap-2">
                  <b class="verdict-title">{{ verdict.label }}</b><span class="sp-field">{{ mark.score }}%</span>
                </div>
                <div class="sp-meter-bar is-grow mt-1"><i :style="{ width: `${mark.score}%` }"></i></div>
              </div>
            </div>
            <p class="sp-hand feedback m-0">{{ mark.feedback }}</p>
            <span v-if="verdict.tone === 'correct'" class="petals" aria-hidden="true">
              <span v-for="i in PETALS" :key="i" class="petal" :style="{ '--angle': `${(360 / PETALS) * i}deg` }" />
            </span>
          </div>
          <div class="model-answer sp-note is-paper d-flex flex-column gap-1">
            <span class="sp-tape is-lilac" aria-hidden="true"></span>
            <span class="sp-eyebrow">Model answer</span>
            <p class="sp-hand feedback m-0">{{ current.answer }}</p>
          </div>
          <div class="quiz-end d-flex flex-column">
            <button type="button" class="sp-btn border-0 text-button w-auto align-self-end" data-testid="short-next" @click="next">
              {{ isLast ? 'See results' : 'Next question' }} <span class="arrow">→</span>
            </button>
          </div>
        </template>
      </section>

      <!-- results -->
      <section v-else class="sp-review-results d-flex flex-column align-items-center text-center gap-4" data-testid="short-results">
        <ScoreRing :percent="accuracy" :tier="tier" />
        <div>
          <h1 class="m-0">Session <em>complete</em></h1>
          <p class="sp-hand sub m-0">{{ correctCount }} of {{ total }} fully correct</p>
        </div>
        <div class="d-flex flex-wrap justify-content-center gap-4 w-100">
          <article v-for="(st, i) in stats" :key="st.label" class="sp-note sp-reveal stat" :class="TONES[i % 3]" :style="{ '--r': `${i % 2 ? 1.8 : -1.8}deg`, '--i': i }">
            <span class="sp-label">{{ st.label }}</span>
            <b :data-testid="st.testid">{{ st.value }}</b>
          </article>
        </div>
        <p v-if="!reward" class="sp-hand sub m-0">Average 60% or more to earn coins.</p>
        <p v-if="error" class="text-berry-deep fw-bold m-0" role="alert">{{ error }}</p>
        <button type="button" class="sp-btn sp-claim-btn" data-testid="short-claim" :disabled="claiming" @click="claim">
          {{ claiming ? 'Claiming…' : 'Claim Rewards' }} <span class="arrow">→</span>
        </button>
      </section>
    </div>

    <ConfettiBurst ref="confetti" />
  </main>
</template>

<style scoped>
.ink-soft {
  color: var(--ink-soft);
}

.ans-label { height: var(--lh); }
.count { font-size: 1.1rem; font-weight: 600; color: var(--ink-faint); }
label:focus-within .pen { color: var(--berry); animation: write-wiggle .6s ease-in-out; }
@keyframes write-wiggle { 25% { transform: rotate(-14deg) translateX(-2px); } 75% { transform: rotate(10deg) translateX(2px); } }

/* typed straight onto the ruled lines: one rule per line of text */
.answer-box { display: block; width: 100%; padding: 0 12px; border: 0; outline: 1.5px solid var(--ink-soft); border-radius: var(--r-sm); resize: none; background: none; font-size: 1.42rem; line-height: var(--lh); color: var(--ink); caret-color: var(--berry); }
.answer-box:focus { outline-color: var(--leaf); }
.answer-box::placeholder { color: var(--ink-faint); }
.answer-box:disabled { color: var(--ink-soft); }

.verdict { --r: -.8deg; position: relative; }
.verdict-title { font-family: var(--f-display); font-style: italic; font-weight: 600; font-size: 1.3rem; }
.verdict-art { height: 44px; width: auto; animation: pop-in .5s var(--spring); }
.verdict.is-partial .sp-meter-bar i { background: var(--butter-deep); }
.verdict.is-wrong .sp-meter-bar i { background: var(--berry); }
.feedback { font-size: 1.4rem; line-height: 1.2; color: var(--ink); }

.question {
  font-family: var(--f-display);
  font-weight: 600;
  font-size: clamp(1.4rem, 3.5vw, 1.75rem);
  line-height: var(--lh);
  letter-spacing: -.01em;
}

.quiz > .question ~ * {
  margin-top: 24px;
}

@media (max-width: 480px) {
  /* the card itself is .phone-card in style.css; the button is pinned to its bottom, still 24px from the rest */
  .quiz > .quiz-end { margin-top: auto; padding-top: 24px; }
  .answer-box::placeholder { font-size: 1.3rem; } /* matches the MCQ answers on phones */
}

.sp-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* results (same as the flashcard deck) */
.sub { font-size: 1.5rem; line-height: 1.1; color: var(--ink-soft); }
.stat { flex: 1 1 120px; max-width: 170px; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 24px 10px 14px; }
.stat b { font-family: var(--f-display); font-weight: 600; font-size: 2rem; line-height: 1.1; font-variant-numeric: tabular-nums; }

/* per-answer moments: correct pops with a petal burst, partly right wiggles like a leaf, wrong droops */
.sp-score-pill.pop { animation: pill-pop 0.4s var(--spring); }

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
/* washi tape: extra colours and the centred placement used on a note */
.sp-tape.is-lilac { background: repeating-linear-gradient(135deg, rgba(255,255,255,.35) 0 5px, transparent 5px 11px), color-mix(in srgb, var(--lilac) 70%, var(--sheet)); }
.sp-tape.is-sky { background: radial-gradient(circle at 5px 5px, rgba(255,255,255,.6) 1.6px, transparent 2px) 0 0/10px 10px, color-mix(in srgb, var(--sky) 90%, var(--sheet)); }

/* sticky note: verdicts, feedback, streak, model answer, results stats */
.sp-note { --note: var(--butter-soft); --r: 0deg; position: relative; padding: 22px 18px 16px; border-radius: 6px; background: var(--note); box-shadow: var(--shadow-1); transform: rotate(var(--r)); transition: transform .35s var(--spring), box-shadow .3s; }
.sp-note.is-leaf { --note: var(--leaf-soft); }
.sp-note.is-berry { --note: var(--berry-soft); }
.sp-note.is-paper { --note: var(--paper); }
.sp-note > .sp-tape { top: -12px; left: calc(50% - 40px); width: 80px; transform: rotate(-3deg); }

/* score bar that grows in */
@keyframes sp-fill { from { width: 0; } }
.sp-meter-bar.is-grow i { animation: sp-fill .8s var(--ease) .15s backwards; }
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
  .verdict, .sp-score-pill.pop { animation: none; }
  .petals { display: none; }
}
</style>