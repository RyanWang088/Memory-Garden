<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { usePomodoroStore, PRESETS, MAX_ROUNDS, lengthText } from '@/stores/pomodoro'
import { useGardenStore } from '@/stores/garden'
import DurationInput from '@/components/DurationInput.vue'
import SessionTodo from '@/components/SessionTodo.vue'
import GardenRadio from '@/components/GardenRadio.vue'
import SproutIcon from '@/components/SproutIcon.vue'
import SceneryBackdrop from '@/components/SceneryBackdrop.vue'
import { foliageUrl } from '@/lib/plantSprites'
import { moodNow } from '@/lib/greeting'
import { vBurst } from '@/lib/burst'
import { useAuthStore } from '@/stores/auth'
const pomo = usePomodoroStore()
const garden = useGardenStore()
const auth = useAuthStore()

// the meadow behind the page follows the session: night falls while you focus, the sun is back on a break
const mood = computed(() => (pomo.phase === 'running' ? (pomo.mode === 'focus' ? 'night' : 'day') : pomo.phase === 'done' ? 'blush' : moodNow()))
const narrow = typeof window !== 'undefined' && window.innerWidth < 600
const flower = computed(() => auth.profile?.onboarding_answers?.flower || 'yellow')
// a plant grows inside the ring as the focus block runs (seed → sprout → bud → flower)
const ringPlant = computed(() => {
  if (pomo.mode === 'break') return { src: foliageUrl(`tulip-${flower.value}-4`), small: false }
  const p = 1 - pomo.progress
  const art = p < 0.25 ? 'seed' : p < 0.5 ? 'sprout' : p < 0.8 ? 'tulip-3' : `tulip-${flower.value}-4`
  return { src: foliageUrl(art), small: art === 'seed' || art === 'sprout', art }
})
// one plant per focus block under the ring: done ones bloom, the current one bobs
const blockArt = (n) => (n < pomo.current.number || (n === pomo.current.number && pomo.mode === 'break')
  ? { src: foliageUrl(`tulip-${flower.value}-4`), cls: 'done' }
  : n === pomo.current.number ? { src: foliageUrl('sprout'), cls: 'now s' } : { src: foliageUrl('seed'), cls: 'todo s' })

/* ---------- setup: one question per step ----------
   Same three questions and the same store checks as before; the page now opens on the
   custom focus/break times (the step people change most), then the topic, then the length. */
const STEPS = [
  { key: 'rhythm', title: 'Set your focus & break', short: 'Rhythm', icon: 'clock' },
  { key: 'topic', title: 'What are you focusing on?', short: 'Topic', icon: 'todo' },
  { key: 'length', title: 'How long is this session?', short: 'Length', icon: 'target' },
]
const QUICK_PICKS = PRESETS.map(p => ({ ...p, detail: `${lengthText(p.focus)} · ${lengthText(p.rest)}` }))
const step = ref(0)
const isLast = computed(() => step.value === STEPS.length - 1)
const stepError = computed(() => pomo.errors[STEPS[step.value].key])
const showError = ref(false) // errors show only after the user tries to move on

// open straight on Custom, keeping whatever times are already there (25/5 the first time)
function openOnCustom() {
  if (!pomo.preset) pomo.choosePreset('custom')
}
onMounted(() => {
  pomo.endBy = 'rounds' // sessions are set by rounds only
  openOnCustom()
  if (!garden.seeds.length) garden.fetchSeeds().catch(() => {}) // only for the topic suggestions
})

// back to setup (Start another, End early, or the mini player's session ending): begin again at step 1
watch(() => pomo.phase, (phase) => {
  if (phase !== 'setup') return
  step.value = 0
  showError.value = false
  openOnCustom()
})

// typing or nudging a time after picking Classic / Deep work turns it into your own rhythm
watch(() => [pomo.focusSeconds, pomo.breakSeconds], ([focus, rest]) => {
  const p = PRESETS.find(x => x.key === pomo.preset)
  if (p && (p.focus !== focus || p.rest !== rest)) pomo.choosePreset('custom')
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
function goTo(i) {
  if (i < step.value) { showError.value = false; step.value = i }
}

// − / + buttons next to each time box (typing still works: click the time and type digits)
// focus can go down to 1 minute, a break down to 0 (no breaks: focus blocks run back to back)
const FOCUS_STEP = 5 * 60, BREAK_STEP = 60
const MIN_FOCUS = 60, MIN_BREAK = 0
function nudge(which, dir) {
  const key = which === 'focus' ? 'focusSeconds' : 'breakSeconds'
  const size = which === 'focus' ? FOCUS_STEP : BREAK_STEP
  const min = which === 'focus' ? MIN_FOCUS : MIN_BREAK
  const next = Math.round(pomo[key] / size) * size + dir * size
  pomo[key] = Math.min(Math.max(next, min), 4 * 3600)
}

const hint = computed(() => ({
  topic: 'Name it, or pick a subject from your garden.',
  rhythm: 'Focus from 1 minute, breaks from 0. Click a time to type it, or use − / +.',
  length: pomo.breakSeconds > 0
    ? 'One round is one focus block. Breaks go in between.'
    : 'One round is one focus block. With a 0-minute break they run back to back.',
}[STEPS[step.value].key]))

// a quick look at one round: focus then break, drawn to scale
const roundShare = computed(() => {
  const sum = pomo.focusSeconds + pomo.breakSeconds
  return { focus: (pomo.focusSeconds / sum) * 100, rest: (pomo.breakSeconds / sum) * 100 }
})

// subjects already planted, offered as one-click topics
const subjects = computed(() => [...new Set(garden.gardenSeeds.map(s => s.subject).filter(Boolean))].slice(0, 6))

// shown on the last step: "4 focus blocks · 3 breaks · 1h 55 min · ends at 4:50 pm"
const planSeconds = computed(() => pomo.plan.reduce((sum, b) => sum + b.seconds, 0))
const preview = computed(() => {
  const focus = pomo.plan.filter(b => b.type === 'focus').length
  const breaks = pomo.plan.length - focus
  const end = new Date(Date.now() + planSeconds.value * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return `${focus} focus block${focus === 1 ? '' : 's'} · ${breaks ? `${breaks} break${breaks === 1 ? '' : 's'}` : 'no breaks'}`
    + ` · ${lengthText(planSeconds.value)} · ends at ${end}`
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
  <main class="focus-page" :class="`is-${pomo.phase}`" data-testid="pomodoro">
    <SceneryBackdrop :mood="mood" :options="{ seed: 31, tulips: narrow ? 3 : 10, butterflies: 2, horizon: 0.64 }" />

    <div class="container position-relative py-4 d-flex flex-column align-items-center">
      <!-- 1. setup questions -->
      <section v-if="pomo.phase === 'setup'" class="panel setup" data-testid="pomodoro-setup">
        <span class="sp-tape" aria-hidden="true"></span>
        <ol class="stepper-track list-unstyled d-flex justify-content-center gap-2 mb-4" aria-label="Setup steps">
          <li v-for="(s, i) in STEPS" :key="s.key">
            <button
              type="button" class="step-chip" :class="{ current: i === step, done: i < step }"
              :aria-current="i === step ? 'step' : undefined" :disabled="i > step" @click="goTo(i)"
            >
              <SproutIcon :name="s.icon" :size="22" />
              <span class="text-label-field">{{ s.short }}</span>
            </button>
          </li>
        </ol>

        <div class="text-center">
          <div class="text-label-caption step-count mb-1">Step {{ step + 1 }} of {{ STEPS.length }}</div>
          <h2 class="mb-1">{{ STEPS[step].title }}</h2>
          <p class="text-body-small mb-4">{{ hint }}</p>
        </div>

        <Transition name="step" mode="out-in">
          <!-- step 1: custom focus & break first; the presets are quick picks that fill both boxes -->
          <div v-if="STEPS[step].key === 'rhythm'" key="rhythm">
            <div class="dials">
              <div class="dial focus-dial">
                <div class="dial-head">
                  <SproutIcon name="focus" :size="34" />
                  <span class="text-label-caption">Focus</span>
                </div>
                <DurationInput
                  v-model="pomo.focusSeconds" class="text-display dial-time" aria-label="Focus length, type digits"
                  data-testid="pomodoro-focus" @enter="nextStep"
                />
                <div class="dial-nudge">
                  <button type="button" class="nudge" aria-label="5 minutes less focus" @click="nudge('focus', -1)"><SproutIcon glyph="minus" :size="18" /></button>
                  <span class="text-body-small">5 min steps</span>
                  <button type="button" class="nudge" aria-label="5 minutes more focus" @click="nudge('focus', 1)"><SproutIcon glyph="plus" :size="18" /></button>
                </div>
              </div>

              <div class="dial break-dial">
                <div class="dial-head">
                  <SproutIcon name="coffee" :size="34" />
                  <span class="text-label-caption">Break</span>
                </div>
                <DurationInput
                  v-model="pomo.breakSeconds" allow-zero class="text-display dial-time" aria-label="Break length, type digits"
                  data-testid="pomodoro-break" @enter="nextStep"
                />
                <div class="dial-nudge">
                  <button type="button" class="nudge" aria-label="1 minute less break" @click="nudge('break', -1)"><SproutIcon glyph="minus" :size="18" /></button>
                  <span class="text-body-small">1 min steps</span>
                  <button type="button" class="nudge" aria-label="1 minute more break" @click="nudge('break', 1)"><SproutIcon glyph="plus" :size="18" /></button>
                </div>
              </div>
            </div>

            <div class="round-bar mt-3" aria-hidden="true">
              <span class="seg focus" :style="{ flexBasis: `${roundShare.focus}%` }"></span>
              <span class="seg rest" :style="{ flexBasis: `${roundShare.rest}%` }"></span>
            </div>
            <div class="d-flex justify-content-between text-body-small mt-1">
              <span>one round</span><span>{{ lengthText(pomo.focusSeconds + pomo.breakSeconds) }}</span>
            </div>

            <div class="quick mt-4" role="radiogroup" aria-label="Focus rhythm">
              <span class="text-label-caption quick-label">Quick picks</span>
              <button
                type="button" role="radio" class="quick-chip" :class="{ active: pomo.preset === 'custom' }"
                :aria-checked="pomo.preset === 'custom'" data-testid="pomodoro-rhythm-custom" @click="pomo.choosePreset('custom')"
              >
                <SproutIcon glyph="edit" :size="14" /> Custom
              </button>
              <button
                v-for="r in QUICK_PICKS" :key="r.key" type="button" role="radio" class="quick-chip"
                :class="{ active: pomo.preset === r.key }" :aria-checked="pomo.preset === r.key"
                :data-testid="`pomodoro-rhythm-${r.key}`" @click="pomo.choosePreset(r.key)"
              >
                <b>{{ r.name }}</b> <span>{{ r.detail }}</span>
              </button>
            </div>
          </div>

          <!-- step 2: topic -->
          <div v-else-if="STEPS[step].key === 'topic'" key="topic">
            <input
              v-model="pomo.topic" type="text" maxlength="60"
              class="form-control form-control-lg text-center topic-input" placeholder="e.g. Statistics, Week 3" autofocus
              data-testid="pomodoro-topic" @keydown.enter.prevent="nextStep"
            />
            <div v-if="subjects.length" class="quick justify-content-center mt-3">
              <span class="text-label-caption quick-label text-center">From your garden</span>
              <button
                v-for="s in subjects" :key="s" type="button" class="quick-chip" :class="{ active: pomo.topic === s }"
                @click="pomo.topic = s"
              >
                <SproutIcon name="leaf" :size="16" /> {{ s }}
              </button>
            </div>
          </div>

          <!-- step 3: how many rounds -->
          <div v-else key="length">
            <!-- the session is set by rounds only (the total-time option was removed) -->
            <div class="d-flex justify-content-center align-items-center gap-4">
              <button type="button" class="nudge big" aria-label="One round less" :disabled="pomo.rounds <= 1" @click="pomo.rounds--"><SproutIcon glyph="minus" /></button>
              <div class="text-center">
                <div class="text-display rounds" data-testid="pomodoro-rounds">{{ pomo.rounds }}</div>
                <div class="text-label-caption">round{{ pomo.rounds === 1 ? '' : 's' }}</div>
              </div>
              <button type="button" class="nudge big" aria-label="One round more" :disabled="pomo.rounds >= MAX_ROUNDS" @click="pomo.rounds++"><SproutIcon glyph="plus" /></button>
            </div>

            <!-- the whole session drawn to scale: focus blocks and the breaks between them -->
            <div v-if="!stepError" class="timeline mt-4" aria-hidden="true">
              <span
                v-for="(b, i) in pomo.plan" :key="i" class="seg" :class="b.type === 'focus' ? 'focus' : 'rest'"
                :style="{ flexGrow: b.seconds }" :title="`${b.type} ${lengthText(b.seconds)}`"
              ></span>
            </div>
            <p v-if="!stepError" class="text-body-strong text-center mt-2 mb-0" data-testid="pomodoro-preview">{{ preview }}</p>
          </div>
        </Transition>

        <p class="text-body-small text-danger text-center mt-3 mb-0 error-line" role="alert" data-testid="pomodoro-error">{{ showError && stepError ? stepError : ' ' }}</p>

        <div class="d-flex justify-content-center gap-3 mt-2">
          <button v-if="step > 0" type="button" class="btn-secondary text-button" @click="backStep">
            <SproutIcon glyph="chevron-left" :size="16" /> Back
          </button>
          <button type="button" class="btn-primary border-0 text-button justify-content-center" data-testid="pomodoro-next" @click="nextStep">
            <template v-if="isLast"><SproutIcon glyph="play" :size="16" /> Start</template>
            <template v-else>Next <SproutIcon glyph="chevron-right" :size="16" /></template>
          </button>
        </div>
      </section>

      <!-- 2. running: tasks | timer | break ideas (stacked on small screens, timer first) -->
      <div v-else-if="pomo.phase === 'running'" class="session w-100">
        <SessionTodo class="side-card area-tasks" />

        <div class="area-timer d-flex flex-column align-items-center">
          <div class="ring" :class="[pomo.mode, { paused: !pomo.running }]">
            <svg viewBox="0 0 300 300" aria-hidden="true">
              <circle class="track" cx="150" cy="150" :r="RADIUS" />
              <circle
                class="fill" cx="150" cy="150" :r="RADIUS"
                :stroke-dasharray="CIRCUMFERENCE" :stroke-dashoffset="ringOffset" transform="rotate(-90 150 150)"
              />
            </svg>
            <div class="ring-text text-center">
              <div class="text-label-caption ring-cap" data-testid="pomodoro-mode">{{ caption }}<span v-if="!pomo.running"> · paused</span></div>
              <div class="text-timer my-2" data-testid="pomodoro-time">{{ pomo.label }}</div>
              <div class="ring-next">{{ nextLabel }}</div>
            </div>
            <img :key="ringPlant.src" class="ring-plant" :class="{ s: ringPlant.small }" :src="ringPlant.src" alt="" />
          </div>
          <div class="blocks mt-3" :aria-label="`Focus block ${focusStarted} of ${pomo.focusTotal}`">
            <img v-for="n in pomo.focusTotal" :key="n" :class="blockArt(n).cls" :src="blockArt(n).src" alt="" />
          </div>

          <div class="d-flex gap-3 mt-4">
            <button v-if="pomo.running" type="button" class="btn-primary border-0 text-button justify-content-center" @click="pomo.pause()">
              <SproutIcon glyph="pause" :size="16" /> Pause
            </button>
            <button v-else type="button" class="btn-primary border-0 text-button justify-content-center" @click="pomo.resume()">
              <SproutIcon glyph="play" :size="16" /> Resume
            </button>
            <button type="button" class="btn-secondary text-button" @click="pomo.endSession()">End early</button>
          </div>
        </div>

        <!-- right column: music -->
        <div class="area-side d-grid gap-4">
          <GardenRadio class="side-card" />
        </div>
      </div>

      <!-- 3. finished -->
      <section v-else class="panel text-center done-card" data-testid="pomodoro-done">
        <span class="sp-tape is-leaf" aria-hidden="true"></span>
        <div class="bouquet" aria-hidden="true">
          <img v-for="n in Math.min(pomo.focusTotal, 7)" :key="n" :src="foliageUrl(`tulip-${['pink', 'yellow', 'purple', 'red', 'white'][(n - 1) % 5]}-4`)" alt="" :style="{ animationDelay: `${n * 0.12}s` }" />
        </div>
        <h2 class="mb-2">Session complete</h2>
        <p class="text-body-small mb-4">
          You focused on {{ pomo.topic }} for {{ pomo.focusTotal }} block{{ pomo.focusTotal === 1 ? '' : 's' }}.
          <template v-if="pomo.tasks.length">
            <br />You ticked off {{ tasksDone }} of {{ pomo.tasks.length }} task{{ pomo.tasks.length === 1 ? '' : 's' }}.
          </template>
        </p>
        <button v-burst type="button" class="btn-primary border-0 text-button justify-content-center mx-auto" @click="pomo.endSession()">
          Start another
        </button>
      </section>
    </div>
  </main>
</template>

<style scoped>
/* page: the meadow scenery sits behind (SceneryBackdrop) */
.focus-page { position: relative; min-height: calc(100vh - 92px); overflow-x: clip; padding-bottom: calc(var(--dock-h) + 40px); }

.panel {
  position: relative; isolation: isolate;
  width: 100%; max-width: 460px; margin-top: 3vh; padding: 28px;
  background: var(--sheet); border-radius: 26px; box-shadow: var(--shadow-2);
}
.panel::after { content: ""; position: absolute; inset: 0; border-radius: inherit; background-image: var(--grain); opacity: .14; mix-blend-mode: multiply; pointer-events: none; z-index: -1; }
.panel > .sp-tape { top: -12px; left: calc(50% - 46px); transform: rotate(-3deg); }
.setup h2 { font-size: clamp(1.8rem, 3.4vw, 2.4rem); line-height: 1.1; }
.topic-input { font-family: var(--f-hand) !important; font-size: 1.7rem; min-height: 58px; }
.setup { max-width: 640px; padding: 28px 32px 32px; }
@media (max-width: 575.98px) { .setup, .panel { padding: 22px 18px 24px; border-radius: 20px; } }

/* step chips: done steps can be clicked to go back */
.stepper-track li { position: relative; }
.stepper-track li + li::before {
  content: ''; position: absolute; left: -10px; top: 50%; width: 12px; height: 2px; background: var(--linen);
}
.step-chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 12px 4px 6px;
  border: 2px solid var(--linen); border-radius: 999px;
  background: var(--paper); color: var(--bark-muted);
  transition: background .2s, border-color .2s, transform .2s var(--spring);
}
.step-chip.current { border-color: var(--peach); background: var(--cream); color: var(--bark); transform: scale(1.04); }
.step-chip.done { border-color: var(--mint-deep); color: var(--bark); }
.step-chip.done:hover { background: var(--mint); }
.step-chip:disabled { opacity: .6; cursor: default; }
.step-count { color: var(--berry-ink); }

/* focus & break dials */
.dials { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
@media (max-width: 479.98px) { .dials { grid-template-columns: 1fr; } }
.dial {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 16px 12px 12px;
  border-radius: 20px;
  border: 2px solid transparent;
  transition: border-color .2s, transform .25s var(--spring);
}
.dial:focus-within { transform: translateY(-2px); }
.focus-dial { background: color-mix(in srgb, var(--peach) 28%, var(--paper)); }
.focus-dial:focus-within { border-color: var(--peach); }
.break-dial { background: color-mix(in srgb, var(--mint) 45%, var(--paper)); }
.break-dial:focus-within { border-color: var(--mint-deep); }
.dial-head { display: flex; align-items: center; gap: 8px; }
.dial-time { max-width: 220px; }
.dial-time:hover:not(.editing) { color: var(--berry-ink); }
.dial-nudge { display: flex; align-items: center; gap: 10px; }

.nudge {
  display: grid; place-items: center;
  width: 36px; height: 36px; padding: 0;
  border: 0; border-radius: 50%;
  background: var(--paper); color: var(--bark);
  box-shadow: 0 3px 0 var(--linen);
  transition: transform .15s, box-shadow .15s;
}
.nudge:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 0 var(--linen); }
.nudge:active:not(:disabled) { transform: translateY(2px); box-shadow: 0 1px 0 var(--linen); }
.nudge:disabled { opacity: .4; }
.nudge:focus-visible, .quick-chip:focus-visible, .step-chip:focus-visible { outline: 3px solid var(--periwinkle); outline-offset: 2px; }
.nudge.big { width: 48px; height: 48px; background: var(--butter); box-shadow: 0 4px 0 var(--butter-deep); }

/* one round, and the whole plan, drawn to scale */
.round-bar, .timeline { display: flex; gap: 4px; height: 14px; }
.round-bar .seg, .timeline .seg { border-radius: 999px; transition: flex-basis .35s var(--spring), flex-grow .35s var(--spring); }
.timeline .seg { flex-basis: 0; min-width: 6px; }
.seg.focus { background: var(--peach); }
.seg.rest { background: var(--mint-deep); }

/* quick picks / subject chips */
.quick { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px; }
.quick-label { flex: 0 0 100%; text-align: center; color: var(--bark-muted); }
.quick-chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 14px;
  border: 2px solid var(--linen); border-radius: 999px;
  background: var(--paper); color: var(--bark);
  font-size: 14px;
  transition: border-color .15s, background .15s, transform .2s var(--spring);
}
.quick-chip span { color: var(--bark-muted); }
.quick-chip:hover { border-color: var(--peri-soft); transform: translateY(-1px); }
.quick-chip.active { border-color: var(--periwinkle); background: var(--peri-soft); }

.topic-input { border: 2px solid var(--linen); border-radius: 16px; }
.total-box { max-width: 320px; padding: 12px; border-radius: 20px; background: var(--cream); }
.rounds { min-width: 2ch; font-variant-numeric: tabular-nums; }
.error-line { min-height: 22px; }

.step-enter-active, .step-leave-active { transition: opacity .18s, transform .22s var(--spring); }
.step-enter-from { opacity: 0; transform: translateX(14px); }
.step-leave-to { opacity: 0; transform: translateX(-14px); }

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
  position: relative; isolation: isolate;
  width: 100%; max-width: 320px; padding: 20px;
  background: var(--sheet); border-radius: 22px; box-shadow: var(--shadow-2);
}

/* countdown ring (journal look): a night disc with a butter ring while focusing, paper and leaf on a break */
.ring {
  --disc: rgba(16, 24, 56, .55); --ring-fg: #fdf3d6; --track: rgba(255,255,255,.14); --fill: var(--butter);
  position: relative; width: min(390px, 84vw); aspect-ratio: 1; border-radius: 50%;
  background: radial-gradient(circle at 50% 35%, color-mix(in srgb, var(--disc) 70%, transparent), var(--disc));
  backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
  box-shadow: 0 0 0 1px rgba(255,255,255,.12) inset, 0 30px 60px -30px rgba(0,0,0,.6), 0 0 80px -10px rgba(255, 230, 150, .25);
  color: var(--ring-fg); transition: background .8s, color .8s, box-shadow .8s;
}
.ring.break { --disc: rgba(252, 246, 236, .9); --ring-fg: var(--ink); --track: var(--sheet-3); --fill: var(--leaf); box-shadow: var(--shadow-2); }
.ring svg { position: absolute; inset: 5%; width: 90%; height: 90%; overflow: visible; }
.ring circle { fill: none; stroke-width: 10; stroke-linecap: round; }
.ring .track { stroke: var(--track); transition: stroke .8s; }
.ring .fill { stroke: var(--fill); transition: stroke-dashoffset .4s linear, stroke .8s; filter: drop-shadow(0 0 6px color-mix(in srgb, var(--fill) 60%, transparent)); }
.ring-text { position: absolute; inset: 0; display: grid; place-content: center; text-align: center; gap: 4px; padding-bottom: 16%; }
.ring-cap { color: inherit; opacity: .8; letter-spacing: .16em; }
.ring .text-timer { font-size: clamp(3.4rem, 9vw, 4.6rem); line-height: 1; letter-spacing: -.02em; }
.ring-next { font-family: var(--f-hand); font-size: 1.3rem; opacity: .85; }
.ring.paused .text-timer { animation: paused 1.4s ease-in-out infinite; }
@keyframes paused { 50% { opacity: .35; } }
.ring-plant { position: absolute; left: 50%; bottom: 12%; height: 26%; width: auto; transform: translateX(-50%); transform-origin: 50% 100%; animation: sprout-in .6s var(--spring); }
.ring-plant.s { height: 38%; bottom: 5%; }
@keyframes sprout-in { from { transform: translateX(-50%) scale(.4); } }
.blocks { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; padding: 8px 14px; border-radius: 999px; background: color-mix(in srgb, var(--sheet) 85%, transparent); box-shadow: var(--shadow-1); }
.blocks img { width: 34px; height: 34px; transition: transform .5s var(--spring); }
.blocks img.s { transform: scale(2); transform-origin: 50% 90%; }
.blocks img.todo { filter: grayscale(1) opacity(.3); }
.blocks img.now { animation: nod 1.2s ease-in-out infinite alternate; }
@keyframes nod { to { translate: 0 -3px; } }
.bouquet { display: flex; justify-content: center; align-items: flex-end; height: 170px; margin-bottom: 8px; }
.bouquet img { height: 150px; width: auto; margin: 0 -14px; transform-origin: 50% 100%; animation: bloom .8s var(--spring) both; }
.bouquet img:nth-child(odd) { height: 128px; }
@keyframes bloom { from { transform: scale(0) rotate(-10deg); } }
.done-card { margin-top: 4vh; padding: 30px; }

.btn-primary { width: auto; min-width: 140px; order: 0; } /* global .btn-primary has order: 4 */
.btn-secondary { min-height: 44px; }


@keyframes bob { 50% { transform: translateY(-4px) rotate(-3deg); } }
@media (prefers-reduced-motion: reduce) {
  .blocks img.now, .ring.paused .text-timer { animation: none; }
  .step-enter-active, .step-leave-active { transition: none; }
}
</style>
