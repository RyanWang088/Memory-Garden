<script setup>
import { ref, computed } from 'vue'
import { usePomodoroStore, formatSeconds } from '@/stores/pomodoro'
import DurationInput from '@/components/DurationInput.vue'
const pomo = usePomodoroStore()

/* ---------- setup: one question per step ---------- */
const STEPS = [
  { key: 'topic', title: 'What are you focusing on?' },
  { key: 'total', title: 'How long is your whole study session?', hint: 'Breaks are included in this time.' },
  { key: 'focus', title: 'How long is each focus block?', hint: 'You study this long before each break.' },
  { key: 'break', title: 'How long is each break?' },
]
const step = ref(0)
const isLast = computed(() => step.value === STEPS.length - 1)
const stepError = computed(() => pomo.errors[STEPS[step.value].key])
const showError = ref(false) // errors show only after the user tries to move on

function nextStep() {
  showError.value = true
  if (stepError.value) return
  showError.value = false
  if (isLast.value) pomo.startSession()
  else step.value += 1
}
function backStep() {
  showError.value = false
  step.value -= 1
}

const breakHint = computed(() => (pomo.breakRequired
  ? "Needed for focus blocks of 30 min or more. It can't be longer than your focus block."
  : `Optional. Leave it and you get ${formatSeconds(pomo.breakToUse)}.`))

/* ---------- running ---------- */
const RADIUS = 136, CIRCUMFERENCE = 2 * Math.PI * RADIUS
const ringOffset = computed(() => CIRCUMFERENCE * (1 - pomo.progress))

const caption = computed(() => (pomo.mode === 'focus'
  ? `Focus · ${pomo.current.number} of ${pomo.focusTotal}`
  : `Break · ${pomo.current.number} of ${pomo.breakTotal}`))

const nextLabel = computed(() => {
  const next = pomo.next
  if (!next) return 'last one, almost done'
  const minutes = Math.round(next.seconds / 60)
  return next.type === 'break' ? `then a ${minutes}-min break` : `then focus block ${next.number}`
})

// one dot per focus block, filled once it has started (break n comes right after focus block n)
const focusStarted = computed(() => pomo.current.number)
</script>

<template>
  <main class="container py-4 d-flex flex-column align-items-center" data-testid="pomodoro">
    <!-- 1. setup questions -->
    <section v-if="pomo.phase === 'setup'" class="panel text-center" data-testid="pomodoro-setup">
      <div class="text-label-caption mb-2">Step {{ step + 1 }} of {{ STEPS.length }}</div>
      <h2 class="mb-1">{{ STEPS[step].title }}</h2>
      <p v-if="STEPS[step].key === 'break'" class="text-body-small mb-3">{{ breakHint }}</p>
      <p v-else-if="STEPS[step].hint" class="text-body-small mb-3">{{ STEPS[step].hint }}</p>
      <p v-else class="text-body-small mb-3">e.g. Cell Biology, Week 3</p>

      <input
        v-if="STEPS[step].key === 'topic'" v-model="pomo.topic" type="text" maxlength="60"
        class="form-control form-control-lg text-center" placeholder="Type a subject or task" autofocus
        data-testid="pomodoro-topic" @keydown.enter.prevent="nextStep"
      />
      <DurationInput
        v-else-if="STEPS[step].key === 'total'" v-model="pomo.totalSeconds"
        class="text-display" aria-label="Whole session, type digits" data-testid="pomodoro-total" @enter="nextStep"
      />
      <DurationInput
        v-else-if="STEPS[step].key === 'focus'" v-model="pomo.focusSeconds"
        class="text-display" aria-label="Focus block, type digits" data-testid="pomodoro-focus" @enter="nextStep"
      />
      <DurationInput
        v-else v-model="pomo.breakSeconds" :placeholder="pomo.breakRequired ? '--:--' : formatSeconds(pomo.breakToUse)"
        class="text-display" aria-label="Break, type digits" data-testid="pomodoro-break" @enter="nextStep"
      />
      <p v-if="STEPS[step].key !== 'topic'" class="text-body-small mt-1 mb-0">Click the time and type, e.g. 1 0 0 0 for 10:00</p>

      <p class="text-body-small text-danger mt-3 mb-0" data-testid="pomodoro-error">{{ showError && stepError ? stepError : ' ' }}</p>

      <div class="d-flex justify-content-center gap-3 mt-3">
        <button v-if="step > 0" type="button" class="btn-secondary text-button" @click="backStep">Back</button>
        <button type="button" class="btn-primary border-0 text-button justify-content-center" data-testid="pomodoro-next" @click="nextStep">
          {{ isLast ? 'Start' : 'Next' }}
        </button>
      </div>
    </section>

    <!-- 2. running -->
    <template v-else-if="pomo.phase === 'running'">
      <div class="text-label-caption">Focusing on</div>
      <div class="text-body-strong mb-3" data-testid="pomodoro-topic-label">{{ pomo.topic }}</div>

      <div class="ring" :class="pomo.mode">
        <svg viewBox="0 0 300 300" aria-hidden="true">
          <circle class="track" cx="150" cy="150" :r="RADIUS" />
          <circle
            class="fill" cx="150" cy="150" :r="RADIUS"
            :stroke-dasharray="CIRCUMFERENCE" :stroke-dashoffset="ringOffset" transform="rotate(-90 150 150)"
          />
        </svg>
        <div class="ring-text text-center">
          <div class="text-label-caption" data-testid="pomodoro-mode">{{ caption }}</div>
          <div class="text-timer my-2" data-testid="pomodoro-time">{{ pomo.label }}</div>
          <div class="text-body-small">{{ nextLabel }}</div>
          <div class="dots d-flex justify-content-center gap-2 mt-2" aria-hidden="true">
            <i v-for="n in pomo.focusTotal" :key="n" :class="{ full: n <= focusStarted }"></i>
          </div>
        </div>
      </div>

      <div class="d-flex gap-3 mt-4">
        <button v-if="pomo.running" type="button" class="btn-primary border-0 text-button justify-content-center" @click="pomo.pause()">Pause</button>
        <button v-else type="button" class="btn-primary border-0 text-button justify-content-center" @click="pomo.resume()">Resume</button>
        <button type="button" class="btn-secondary text-button" @click="pomo.endSession()">End early</button>
      </div>
    </template>

    <!-- 3. finished -->
    <section v-else class="panel text-center" data-testid="pomodoro-done">
      <h2 class="mb-2">Session complete 🌱</h2>
      <p class="text-body-small mb-4">
        You focused on {{ pomo.topic }} for {{ pomo.focusTotal }} block{{ pomo.focusTotal === 1 ? '' : 's' }}.
      </p>
      <button type="button" class="btn-primary border-0 text-button justify-content-center mx-auto" @click="step = 0; pomo.endSession()">
        Start another
      </button>
    </section>
  </main>
</template>

<style scoped>
.panel {
  width: 100%;
  max-width: 460px;
  padding: 28px;
  background: var(--paper);
  border: 1px solid var(--linen);
  border-radius: 16px;
  box-shadow: 0 8px 24px -6px var(--shadow-card), 0 2px 4px var(--shadow-card);
}

/* countdown ring: white disc, peach while focusing, grey on a break */
.ring {
  position: relative;
  width: min(340px, 85vw);
  aspect-ratio: 1;
  border-radius: 50%;
  background: var(--paper);
  border: 3px solid var(--bark);
  box-shadow: 0 10px 30px -8px var(--shadow-card);
}
.ring svg { position: absolute; inset: 6%; width: 88%; height: 88%; }
.ring circle { fill: none; stroke-width: 18; }
.ring .track { stroke: var(--peri-soft); }
.ring .fill { stroke: var(--peach); transition: stroke-dashoffset .25s linear; }
.ring.break .fill { stroke: #B9B1AD; }
.ring-text { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; }

.dots i { width: 10px; height: 10px; border-radius: 50%; border: 2px solid var(--berry); }
.dots i.full { background: var(--berry); }

.btn-primary { width: auto; min-width: 140px; order: 0; } /* global .btn-primary has order: 4 */
.form-control:focus { border-color: var(--periwinkle); box-shadow: 0 0 0 .2rem var(--peri-soft); }
</style>
