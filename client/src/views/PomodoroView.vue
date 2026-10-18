<script setup>
import { ref, computed, watch } from 'vue'
import { usePomodoroStore, PRESETS, MAX_ROUNDS, lengthText } from '@/stores/pomodoro'
import DurationInput from '@/components/DurationInput.vue'
import SessionTodo from '@/components/SessionTodo.vue'
import BreakIdeas from '@/components/BreakIdeas.vue'
import GardenRadio from '@/components/GardenRadio.vue'
const pomo = usePomodoroStore()

/* ---------- setup: one question per step ---------- */
const STEPS = [
  { key: 'topic', title: 'What are you focusing on?' },
  { key: 'rhythm', title: 'How do you like to focus?' },
  { key: 'length', title: 'How long is this session?' },
]
const RHYTHMS = [
  ...PRESETS.map(p => ({ ...p, detail: `${lengthText(p.focus)} focus · ${lengthText(p.rest)} break` })),
  { key: 'custom', name: 'Custom', detail: 'Set your own focus and break' },
]
const step = ref(0)
const isLast = computed(() => step.value === STEPS.length - 1)
const stepError = computed(() => pomo.errors[STEPS[step.value].key])
const showError = ref(false) // errors show only after the user tries to move on

// back to setup (Start another, End early, or the mini player's session ending): begin again at step 1
watch(() => pomo.phase, (phase) => {
  if (phase !== 'setup') return
  step.value = 0
  showError.value = false
})

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

const hint = computed(() => ({
  topic: 'e.g. Cell Biology, Week 3',
  rhythm: 'Pick a rhythm, or set your own.',
  length: pomo.endBy === 'rounds'
    ? 'One round is one focus block. Breaks go in between.'
    : 'Breaks are included in this time.',
}[STEPS[step.value].key]))

// shown on the last step: "4 focus blocks · 3 breaks · 1h 55 min · ends at 4:50 pm"
const preview = computed(() => {
  const focus = pomo.plan.filter(b => b.type === 'focus').length
  const breaks = pomo.plan.length - focus
  const seconds = pomo.plan.reduce((sum, b) => sum + b.seconds, 0)
  const end = new Date(Date.now() + seconds * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return `${focus} focus block${focus === 1 ? '' : 's'} · ${breaks} break${breaks === 1 ? '' : 's'}`
    + ` · ${lengthText(seconds)} · ends at ${end}`
})

/* ---------- running ---------- */
const RADIUS = 136, CIRCUMFERENCE = 2 * Math.PI * RADIUS
const ringOffset = computed(() => CIRCUMFERENCE * (1 - pomo.progress))

const caption = computed(() => (pomo.mode === 'focus'
  ? `Focus · ${pomo.current.number} of ${pomo.focusTotal}`
  : `Break · ${pomo.current.number} of ${pomo.breakTotal}`))

const nextLabel = computed(() => {
  const next = pomo.next
  if (!next) return 'last one, almost done'
  return next.type === 'break' ? `then a break of ${lengthText(next.seconds)}` : `then focus block ${next.number}`
})

// one dot per focus block, filled once it has started (break n comes right after focus block n)
const focusStarted = computed(() => pomo.current.number)

/* ---------- finished ---------- */
const tasksDone = computed(() => pomo.tasks.filter(t => t.done).length)
</script>

<template>
  <main class="container py-4 d-flex flex-column align-items-center" data-testid="pomodoro">
    <!-- 1. setup questions -->
    <section v-if="pomo.phase === 'setup'" class="panel text-center" data-testid="pomodoro-setup">
      <div class="text-label-caption mb-2">Step {{ step + 1 }} of {{ STEPS.length }}</div>
      <h2 class="mb-1">{{ STEPS[step].title }}</h2>
      <p class="text-body-small mb-3">{{ hint }}</p>

      <!-- step 1: topic -->
      <input
        v-if="STEPS[step].key === 'topic'" v-model="pomo.topic" type="text" maxlength="60"
        class="form-control form-control-lg text-center" placeholder="Type a subject or task" autofocus
        data-testid="pomodoro-topic" @keydown.enter.prevent="nextStep"
      />

      <!-- step 2: rhythm presets, custom reveals the two time boxes -->
      <template v-else-if="STEPS[step].key === 'rhythm'">
        <div class="d-grid gap-2" role="radiogroup" aria-label="Focus rhythm">
          <button
            v-for="r in RHYTHMS" :key="r.key" type="button" role="radio" :aria-checked="pomo.preset === r.key"
            class="rhythm d-flex justify-content-between align-items-center" :class="{ active: pomo.preset === r.key }"
            :data-testid="`pomodoro-rhythm-${r.key}`" @click="pomo.choosePreset(r.key)"
          >
            <span class="text-button">{{ r.name }}</span>
            <span class="text-body-small">{{ r.detail }}</span>
          </button>
        </div>
        <div v-if="pomo.preset === 'custom'" class="d-flex justify-content-center gap-4 mt-3">
          <label class="flex-fill">
            <span class="text-label-caption">Focus</span>
            <DurationInput v-model="pomo.focusSeconds" class="text-stat" data-testid="pomodoro-focus" @enter="nextStep" />
          </label>
          <label class="flex-fill">
            <span class="text-label-caption">Break</span>
            <DurationInput v-model="pomo.breakSeconds" class="text-stat" data-testid="pomodoro-break" @enter="nextStep" />
          </label>
        </div>
      </template>

      <!-- step 3: end by rounds or by total time -->
      <template v-else>
        <div class="segmented-control mx-auto mb-3" role="group" aria-label="End the session by">
          <button
            v-for="by in ['rounds', 'time']" :key="by" type="button" class="segmented-tab w-50 text-capitalize"
            :class="{ 'is-active': pomo.endBy === by }" :aria-pressed="pomo.endBy === by" @click="pomo.endBy = by"
          >{{ by }}</button>
        </div>
        <div v-if="pomo.endBy === 'rounds'" class="d-flex justify-content-center align-items-center gap-3">
          <button type="button" class="btn-secondary stepper text-button" aria-label="One round less" :disabled="pomo.rounds <= 1" @click="pomo.rounds--">−</button>
          <div class="text-display rounds" data-testid="pomodoro-rounds">{{ pomo.rounds }}</div>
          <button type="button" class="btn-secondary stepper text-button" aria-label="One round more" :disabled="pomo.rounds >= MAX_ROUNDS" @click="pomo.rounds++">+</button>
        </div>
        <DurationInput
          v-else v-model="pomo.totalSeconds"
          class="text-display" aria-label="Whole session, type digits" data-testid="pomodoro-total" @enter="nextStep"
        />
      </template>

      <p v-if="(STEPS[step].key === 'rhythm' && pomo.preset === 'custom') || (STEPS[step].key === 'length' && pomo.endBy === 'time')" class="text-body-small mt-1 mb-0">
        Click a time and type, e.g. 1 0 0 0 for 10:00
      </p>
      <p v-if="isLast && !stepError" class="text-body-strong mt-3 mb-0" data-testid="pomodoro-preview">{{ preview }}</p>

      <p class="text-body-small text-danger mt-3 mb-0" data-testid="pomodoro-error">{{ showError && stepError ? stepError : ' ' }}</p>

      <div class="d-flex justify-content-center gap-3 mt-3">
        <button v-if="step > 0" type="button" class="btn-secondary text-button" @click="backStep">Back</button>
        <button type="button" class="btn-primary border-0 text-button justify-content-center" data-testid="pomodoro-next" @click="nextStep">
          {{ isLast ? 'Start' : 'Next' }}
        </button>
      </div>
    </section>

    <!-- 2. running: tasks | timer | break ideas (stacked on small screens, timer first) -->
    <div v-else-if="pomo.phase === 'running'" class="session w-100">
      <SessionTodo class="side-card area-tasks" />

      <div class="area-timer d-flex flex-column align-items-center">
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
          <button v-if="pomo.running" type="button" class="btn-primary border-0 text-button justify-content-center" @click="pomo.pause()">❚❚ Pause</button>
          <button v-else type="button" class="btn-primary border-0 text-button justify-content-center" @click="pomo.resume()">▶ Resume</button>
          <button type="button" class="btn-secondary text-button" @click="pomo.endSession()">End early</button>
        </div>
      </div>

      <!-- right column: music, then break ideas -->
      <div class="area-side d-grid gap-4">
        <GardenRadio class="side-card" />
        <BreakIdeas class="side-card" />
      </div>
    </div>

    <!-- 3. finished -->
    <section v-else class="panel text-center" data-testid="pomodoro-done">
      <h2 class="mb-2">Session complete 🌱</h2>
      <p class="text-body-small mb-4">
        You focused on {{ pomo.topic }} for {{ pomo.focusTotal }} block{{ pomo.focusTotal === 1 ? '' : 's' }}.
        <template v-if="pomo.tasks.length">
          <br />You ticked off {{ tasksDone }} of {{ pomo.tasks.length }} task{{ pomo.tasks.length === 1 ? '' : 's' }}.
        </template>
      </p>
      <button type="button" class="btn-primary border-0 text-button justify-content-center mx-auto" @click="pomo.endSession()">
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

/* running layout: one column on phones (timer first), three columns on wide screens */
.session {
  display: grid;
  gap: 24px;
  justify-items: center;
  grid-template-areas: "timer" "tasks" "side";
}
@media (min-width: 992px) {
  .session {
    grid-template-columns: 1fr auto 1fr;
    grid-template-areas: "tasks timer side";
    align-items: start;
    gap: 40px;
  }
}
.area-tasks { grid-area: tasks; }
.area-timer { grid-area: timer; }
.area-side { grid-area: side; width: 100%; max-width: 320px; }

/* the white cards either side of the timer (scoped styles also reach a child component's root) */
.side-card {
  width: 100%;
  max-width: 320px;
  padding: 20px;
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
  border: 2px solid var(--linen);
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

/* rhythm choices: soft card, periwinkle when picked */
.rhythm {
  width: 100%;
  padding: 12px 16px;
  background: var(--paper);
  border: 2px solid var(--linen);
  border-radius: 12px;
  color: inherit;
  transition: border-color .15s, background .15s;
}
.rhythm:hover { border-color: var(--peri-soft); }
.rhythm.active { border-color: var(--periwinkle); background: var(--peri-soft); }

.stepper { min-width: 44px; font-size: 22px; }
.rounds { min-width: 2ch; font-variant-numeric: tabular-nums; }

.btn-primary { width: auto; min-width: 140px; order: 0; } /* global .btn-primary has order: 4 */
.form-control:focus { border-color: var(--periwinkle); box-shadow: 0 0 0 .2rem var(--peri-soft); }
</style>
