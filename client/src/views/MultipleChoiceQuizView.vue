<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGardenStore } from '@/stores/garden'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'
import { shuffle } from '@/lib/shuffle'
import { useStudyTimer } from '@/composables/useStudyTimer'
import { moodNow } from '@/lib/greeting'
import { foliageUrl } from '@/lib/plantSprites'
import SceneryBackdrop from '@/components/SceneryBackdrop.vue'
import { ding, fanfare } from '@/lib/beep'
import ConfettiBurst from '@/components/ConfettiBurst.vue'
import SproutIcon from '@/components/SproutIcon.vue'
import ScoreRing from '@/components/ScoreRing.vue'
import { burst } from '@/lib/burst'

// "Multiple Choice Quiz" review session: up to 10 multiple-choice questions from one seed,
// then a results screen where the user claims coins for their score.
const MAX_QUESTIONS = 10
const LETTERS = ['A', 'B', 'C', 'D']
const MIN_STREAK = 3// "x in a row!" shows from this many correct answers in a row
const TONES = ['', 'is-leaf', 'is-berry']

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
const streak = ref(0) // correct answers in a row; a wrong answer resets it
const finished = ref(false)
// the meadow behind the sheet, like the Focus page: the time of day while reviewing, blush on the results
const mood = computed(() => (finished.value ? 'blush' : moodNow()))
const narrow = typeof window !== 'undefined' && window.innerWidth < 600
const startedAt = ref(0)
const elapsedMs = ref(0)
const confetti = ref(null) // <ConfettiBurst>, rained on a score of 75%+
const claiming = ref(false)
const coinsClaimed = ref(false) // so a retry after a failed claim never pays twice
const results = [] // one { card_id, rating: 'correct' | 'wrong' } per question, saved on claim
const checkEls = [] // each option's check circle, for the leaf burst

const flower = computed(() => auth.profile?.onboarding_answers?.flower || 'pink')
const seed = computed(() => garden.seeds.find(item => item.id === route.params.id))
const current = computed(() => questions.value[index.value])
const total = computed(() => questions.value.length)
const answered = computed(() => index.value + (chosen.value === null ? 0 : 1))
const isLast = computed(() => index.value === total.value - 1)
const isRight = computed(() => chosen.value !== null && current.value.options[chosen.value] === current.value.answer)
const accuracy = computed(() => (total.value ? Math.round((correctCount.value / total.value) * 100) : 0))
const reward = computed(() => (accuracy.value >= 90 ? 30 : accuracy.value >= 75 ? 20 : accuracy.value >= 60 ? 10 : 0))
const tier = computed(() => (accuracy.value >= 75 ? 'high' : accuracy.value >= 60 ? 'mid' : 'low'))
const timeTaken = computed(() => {
  const seconds = Math.round(elapsedMs.value / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
})
const stats = computed(() => [
  { label: 'Coins', value: `+${reward.value}`, testid: 'quiz-reward' },
  { label: 'Accuracy', value: `${accuracy.value}%` },
  { label: 'Time', value: timeTaken.value },
])

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
})

function choose(optionIndex) {
  if (chosen.value !== null || finished.value) return
  chosen.value = optionIndex
  studyTimer.mark()
  const correct = current.value.options[optionIndex] === current.value.answer
  if (correct) {
    correctCount.value++
    ding()
    burst(checkEls[optionIndex]) // leaves pop off the tick, like ticking a to-do
  }
  streak.value = correct ? streak.value + 1 : 0
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
  fanfare()
  if (accuracy.value >= 75) confetti.value?.rain()
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
      duration: 6000,
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
  <main class="sp-review-page phone-card">
    <SceneryBackdrop :mood="mood" :options="{ seed: 31, tulips: narrow ? 3 : 10, butterflies: 2, horizon: 0.64 }" />
    <div class="sp-review-container sp-review-sheet">
      <p v-if="loading" role="status">Getting your questions ready…</p>

      <section v-else-if="!questions.length" class="text-center d-flex flex-column align-items-center gap-3 pt-5">
        <img src="../assets/ui/sprout.svg" width="96" height="96" alt="">
        <p class="text-berry-deep" role="alert">{{ error }}</p>
        <button type="button" class="sp-btn sp-btn-butter text-button" @click="backToGarden">Back to garden</button>
      </section>

      <!-- quiz -->
      <section v-else-if="!finished" class="quiz d-flex flex-column" data-testid="quiz-quiz">
        <header class="sp-review-header d-flex flex-column gap-2">
          <div class="d-flex align-items-center gap-3">
            <button type="button" class="btn-close" aria-label="Quit and go back to garden" @click="backToGarden" />
            <span class="sp-field flex-grow-1 ink-soft">Question {{ index + 1 }} of {{ total }}</span>
            <span class="sp-score-pill text-button" data-testid="quiz-correct" :aria-label="`${correctCount} correct`">✓ {{ correctCount }}</span>
          </div>
          <div class="progress" role="progressbar" :aria-valuenow="answered" aria-valuemin="0" :aria-valuemax="total">
            <div class="progress-fill sp-review-progress-fill" :style="{ width: `${(answered / total) * 100}%` }" />
          </div>
        </header>

        <h2 class="question m-0">{{ current.question }}</h2>

        <!-- answers written like the planner's to-do lines: a check circle, then the answer in hand.
             A wrong pick is crossed out with a drawn pen stroke; the right answer gets a highlighter swipe -->
        <div class="d-flex flex-column" role="group" aria-label="Answer options">
          <button v-for="(option, i) in current.options" :key="`${current.id}-${i}`" type="button" class="option"
            :class="optionState(i)" :style="{ animationDelay: `${i * 45}ms` }" :disabled="chosen !== null"
            :data-testid="`quiz-option-${i}`" @click="choose(i)">
            <span :ref="el => (checkEls[i] = el)" class="sp-check" aria-hidden="true"
              :class="{ 'is-ticked': optionState(i) === 'is-correct', 'is-crossed': optionState(i) === 'is-wrong' }">
              <svg viewBox="0 0 30 30"><circle class="sp-check-ring" cx="15" cy="15" r="12" /><path class="sp-check-ink" d="M15 3.2C22 3 27.2 8.4 26.8 15.3 26.4 22 21 27 14.6 26.8 8 26.6 3 21.4 3.3 14.8 3.6 8.2 9 3.4 16 3.6" /><path class="sp-check-tick" d="M9.5 15.5l3.8 3.8 7.4-8.3" /><path class="sp-check-cross" d="M10.5 10.5l9 9" /><path class="sp-check-cross" d="M19.5 10.5l-9 9" /></svg>
            </span>
            <span class="option-main">
              <span class="option-text sp-task-label" :class="{ 'is-struck': optionState(i) === 'is-wrong' }">{{ option }}
              </span>
            </span>
          </button>
        </div>

        <!-- shown after answering; on phones it sits at the bottom of the card, in space kept free for it -->
        <div class="quiz-end d-flex flex-column">
          <p v-if="chosen !== null && streak >= MIN_STREAK" :key="streak" class="streak sp-note m-0" data-testid="quiz-streak">
            <SproutIcon name="flame" :size="32" /> {{ streak }} in a row!
          </p>

          <footer v-if="chosen !== null" class="d-flex align-items-center justify-content-between gap-3 flex-wrap">
            <div class="feedback sp-note d-flex align-items-center gap-2" :class="isRight ? 'is-leaf' : 'is-berry'" role="status">
              <img v-if="isRight" class="feedback-art" :src="foliageUrl(`tulip-${flower}-4`)" alt="" />
              
              <span>{{ isRight ? 'Correct!' : 'Not quite. The right answer is ticked.' }}</span>
            </div>
            <button type="button" class="sp-btn border-0 text-button w-auto" data-testid="quiz-next" @click="next">
              {{ isLast ? 'See results' : 'Next question' }} <span class="arrow">→</span>
            </button>
          </footer>
        </div>
      </section>

      <!-- results -->
      <section v-else class="sp-review-results d-flex flex-column align-items-center text-center gap-4" data-testid="quiz-results">
        <ScoreRing :percent="accuracy" :tier="tier" />
        <div>
          <h1 class="m-0">Quiz <em>complete</em></h1>
          <p class="sp-hand sub m-0">Your score: {{ correctCount }}/{{ total }}</p>
        </div>
        <div class="d-flex flex-wrap justify-content-center gap-4 w-100">
          <article v-for="(s, i) in stats" :key="s.label" class="sp-note sp-reveal stat" :class="TONES[i % 3]" :style="{ '--r': `${i % 2 ? 1.8 : -1.8}deg`, '--i': i }">
            <span class="sp-label">{{ s.label }}</span>
            <b :data-testid="s.testid">{{ s.value }}</b>
          </article>
        </div>
        <p v-if="!reward" class="sp-hand sub m-0">Score 60% or more to earn coins.</p>
        <p v-if="error" class="text-berry-deep fw-bold m-0" role="alert">{{ error }}</p>
        <button type="button" class="sp-btn sp-claim-btn" data-testid="quiz-claim" :disabled="claiming" @click="claim">
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

.question {
  font-family: var(--f-display);
  font-weight: 600;
  font-size: clamp(1.4rem, 3.5vw, 1.75rem);
  line-height: var(--lh);
  letter-spacing: -.01em;
}

.quiz-end > .streak,
.quiz-end > footer {
  margin-top: 24px;
}

/* an answer is a bare to-do line (PlannerBook .task / .t-text), no box */
.option {
  display: grid;
  grid-template-columns: 34px 1fr auto;
  align-items: center;
  gap: 0 12px;
  width: 100%;
  min-height: var(--lh);
  padding: 4px 4px 4px 0;
  border: 0;
  background: none;
  text-align: left;
  isolation: isolate;
  animation: write-in .55s var(--ease) backwards; /* not "both": a kept clip-path would cut off the leaf burst */
  transition: opacity .3s;
}

.option:hover:not(:disabled) .sp-check-ring {
  stroke: var(--leaf);
}

.option:focus-visible {
  outline: 3px solid var(--leaf);
  outline-offset: 2px;
  border-radius: 8px;
}

.option:disabled {
  cursor: default;
}

.option-main {
  min-width: 0;
  line-height: 1.25;
}

.option.is-dim {
  opacity: 0.55;
}

/* pen cross-out: the path draws on a wrong pick (and un-draws if .is-struck goes) */
.option-text { position: relative; display: inline-block; }
.strike { position: absolute; left: -2%; top: 50%; width: 104%; height: 10px; margin-top: -5px; fill: none; stroke: var(--berry-deep); stroke-width: 2; stroke-linecap: round; overflow: visible; pointer-events: none; }
.strike path { stroke-dasharray: 1; stroke-dashoffset: 1; transition: stroke-dashoffset .45s var(--ease); }
.is-struck > .strike path { stroke-dashoffset: 0; }

/* highlighter swipe behind the right answer */
.is-correct .option-text::before { content: ""; position: absolute; inset: .1em -7px 0; z-index: -1; border-radius: 4px 12px 6px 14px; background: var(--leaf-soft); transform-origin: left; animation: swipe .45s var(--ease) both; }
@keyframes swipe { from { transform: scaleX(0); } }

.option-key { font-family: var(--f-hand); font-size: 1.1rem; color: var(--ink-faint); transition: color .2s; }
.option:hover:not(:disabled) .option-key { color: var(--leaf); }

@media (prefers-reduced-motion: reduce) {
  .option { animation: none; }
}

/* streak sticker and feedback note (.sp-note) */
.streak {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  align-self: flex-start;
  --r: -2deg;
  font-family: var(--f-hand);
  font-weight: 700;
  font-size: 1.5rem;
  color: var(--butter-deep);
  animation: streak-pop 0.4s var(--spring);
}

.feedback { padding: 10px 16px 10px 12px; font-family: var(--f-hand); font-weight: 700; font-size: 1.3rem; }
.feedback-art { height: 34px; width: auto; }
.sp-note { --note: var(--butter-soft); --r: 0deg; position: relative; padding: 22px 18px 16px; border-radius: 6px; background: var(--note); box-shadow: var(--shadow-1); transform: rotate(var(--r)); transition: transform .35s var(--spring), box-shadow .3s; }
.sp-note.is-leaf { --note: var(--leaf-soft); }
.sp-note.is-berry { --note: var(--berry-soft); }
.sp-note.is-paper { --note: var(--paper); }
.sp-note > .sp-tape { top: -12px; left: calc(50% - 40px); width: 80px; transform: rotate(-3deg); }


@keyframes streak-pop {
  from { opacity: 0; transform: scale(0.6); }
}

@media (prefers-reduced-motion: reduce) {
  .streak { animation: none; }
}

/* results (same as the flashcard deck) */
.sub { font-size: 1.5rem; line-height: 1.1; color: var(--ink-soft); }
.stat { flex: 1 1 120px; max-width: 170px; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 24px 10px 14px; }
.stat b { font-family: var(--f-display); font-weight: 600; font-size: 2rem; line-height: 1.1; font-variant-numeric: tabular-nums; }

/* phones: the card itself is .phone-card in style.css */
@media (max-width: 480px) {
  .option-text { font-size: 1.3rem; }
}
</style>