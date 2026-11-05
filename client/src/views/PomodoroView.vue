<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { usePomodoroStore, PRESETS, MAX_ROUNDS, lengthText, formatSeconds } from '@/stores/pomodoro'
import DurationInput from '@/components/DurationInput.vue'
import SessionTodo from '@/components/SessionTodo.vue'
import GardenRadio from '@/components/GardenRadio.vue'
import SproutIcon from '@/components/SproutIcon.vue'
import SceneryBackdrop from '@/components/SceneryBackdrop.vue'
import { foliageUrl } from '@/lib/plantSprites'
import { moodNow } from '@/lib/greeting'
import { vBurst } from '@/lib/burst'
import { useAuthStore } from '@/stores/auth'
import { useGardenStore } from '@/stores/garden'
import { usePlannerStore } from '@/stores/planner'
const pomo = usePomodoroStore()
const garden = useGardenStore()
const auth = useAuthStore()

// the sky follows the session: night while focusing, day on a break
const mood = computed(() => (pomo.phase === 'running' ? (pomo.mode === 'focus' ? 'night' : 'day') : pomo.phase === 'done' ? 'blush' : moodNow()))
const narrow = typeof window !== 'undefined' && window.innerWidth < 600
const flower = computed(() => auth.profile?.onboarding_answers?.flower || 'pink')
// the plant inside the ring grows as the focus block runs (seed → sprout → bud → flower)
const ringPlant = computed(() => {
  if (pomo.mode === 'break') return { src: foliageUrl(`tulip-${flower.value}-4`), small: false }
  const p = 1 - pomo.progress
  const art = p < 0.25 ? 'seed' : p < 0.5 ? 'sprout' : p < 0.8 ? `tulip-${flower.value}-3` : `tulip-${flower.value}-4`
  return { src: foliageUrl(art), small: art === 'seed' || art === 'sprout' }
})
// one plant per focus block under the ring: done ones bloom, the current one is a sprout
const blockArt = (n) => (n < pomo.current.number || (n === pomo.current.number && pomo.mode === 'break')
  ? { src: foliageUrl(`tulip-${flower.value}-4`), cls: 'done' }
  : n === pomo.current.number ? { src: foliageUrl('sprout'), cls: 'now s' } : { src: foliageUrl('seed'), cls: 'todo s' })

/* ---------- before Start ---------- */
const idle = computed(() => pomo.phase === 'setup')
const showError = ref(false) // the error only shows after Start is pressed

// start on 'custom' (keeps the current times; 25/5 the first time)
function openOnCustom() {
  if (!pomo.preset) pomo.choosePreset('custom')
}
// add the garden's "!" seeds (most worth revising) to the to-do list. Also runs on the way back from a review,
// so the next seed in line joins the list
async function suggestReviews() {
  try { await garden.fetchSeeds() } catch { return } // can't load them: the list just has the other tasks
  pomo.addReviewTasks([...garden.gardenSeeds].sort((a, b) => b.priority - a.priority))
}

onMounted(() => {
  openOnCustom()
  suggestReviews()
})

// back at the settings after a session: hide the error and get fresh review suggestions
watch(() => pomo.phase, (phase) => {
  if (phase !== 'setup') return
  showError.value = false
  openOnCustom()
  suggestReviews()
})

// changing a time after picking Classic / Deep work makes it 'custom'
watch(() => [pomo.focusSeconds, pomo.breakSeconds], ([focus, rest]) => {
  const p = PRESETS.find(x => x.key === pomo.preset)
  if (p && (p.focus !== focus || p.rest !== rest)) pomo.choosePreset('custom')
})

function start() {
  showError.value = true
  if (pomo.setupError) return
  showError.value = false
  pomo.startSession()
}

// − / + buttons: focus moves by 5 min (min 1 min), break by 1 min (min 0 = no breaks)
const FOCUS_STEP = 5 * 60, BREAK_STEP = 60
const MIN_FOCUS = 60, MIN_BREAK = 0
function nudge(which, dir) {
  const key = which === 'focus' ? 'focusSeconds' : 'breakSeconds'
  const size = which === 'focus' ? FOCUS_STEP : BREAK_STEP
  const min = which === 'focus' ? MIN_FOCUS : MIN_BREAK
  const next = Math.round(pomo[key] / size) * size + dir * size
  pomo[key] = Math.min(Math.max(next, min), 4 * 3600)
}

/* ---------- running ---------- */
const RADIUS = 136, CIRCUMFERENCE = 2 * Math.PI * RADIUS
const ringOffset = computed(() => CIRCUMFERENCE * (1 - pomo.progress))

const caption = computed(() => (pomo.mode === 'focus'
  ? `Focus · ${pomo.current.number} of ${pomo.focusTotal}`
  : `Break · ${pomo.current.number} of ${pomo.breakTotal}`))

const nextLabel = computed(() => {
  const next = pomo.next
  if (!next) return 'last one, almost done'
  return next.type === 'break' ? `then a break of ${lengthText(next.seconds)}` : `then focus round ${next.number}`
})

// ring text: before Start it shows what you've set, then it follows the timer
const ringCaption = computed(() => (idle.value ? `Ready · ${pomo.rounds} round${pomo.rounds === 1 ? '' : 's'}` : caption.value))
const ringNext = computed(() => (idle.value
  ? (pomo.breakSeconds ? `breaks of ${lengthText(pomo.breakSeconds)}` : 'no breaks')
  : nextLabel.value))

/* ---------- finished ---------- */
// tasks ticked during the session (this list and the planner), not ones already ticked at Start
const planner = usePlannerStore()
// done card's tulip colours: the user's own first, then the rest
const bouquet = computed(() => [flower.value, ...['pink', 'yellow', 'purple', 'red'].filter(c => c !== flower.value)])
const tasksDone = computed(() => [...pomo.tasks, ...planner.tasks]
  .filter(t => t.done && !pomo.doneAtStart.includes(t.id)).length)
// total focus time for the done card, e.g. "50 min"
const focusTime = computed(() => lengthText(pomo.blocks.filter(b => b.type === 'focus').reduce((sum, b) => sum + b.seconds, 0)))
</script>

<template>
  <main class="focus-page" :class="`is-${pomo.phase}`" data-testid="pomodoro">
    <SceneryBackdrop :mood="mood" :options="{ seed: 31, tulips: narrow ? 3 : 10, butterflies: 2, horizon: 0.64 }" />

    <div class="container position-relative py-4 d-flex flex-column align-items-center">
      <!-- before Start and while running: to-do | timer | music + settings (one column on smaller screens) -->
      <div v-if="pomo.phase !== 'done'" class="session w-100">
        <SessionTodo class="sp-card side-card area-tasks" />

        <div class="area-timer d-flex flex-column align-items-center">
          <!-- timer ring: shows the chosen focus time before Start, then counts down -->
          <div class="ring" :class="[pomo.mode, { paused: !idle && !pomo.running }]">
            <svg viewBox="0 0 300 300" aria-hidden="true">
              <circle class="track" cx="150" cy="150" :r="RADIUS" />
              <circle
                class="fill" cx="150" cy="150" :r="RADIUS"
                :stroke-dasharray="CIRCUMFERENCE" :stroke-dashoffset="ringOffset" transform="rotate(-90 150 150)"
              />
            </svg>
            <div class="ring-text text-center">
              <div class="text-label-caption ring-cap" data-testid="pomodoro-mode">{{ ringCaption }}<span v-if="!idle && !pomo.running"> · paused</span></div>
              <div class="text-timer my-2" data-testid="pomodoro-time">{{ idle ? formatSeconds(pomo.focusSeconds) : pomo.label }}</div>
              <div class="ring-next">{{ ringNext }}</div>
            </div>
            <img :key="ringPlant.src" class="ring-plant" :class="{ s: ringPlant.small }" :src="ringPlant.src" alt="" />
          </div>

          <!-- before Start: Start button -->
          <div v-if="idle" class="mt-4">
            <button type="button" class="sp-btn border-0 text-button justify-content-center" data-testid="pomodoro-start" @click="start">
              <SproutIcon glyph="play" :size="16" /> Start
            </button>
          </div>

          <!-- running: one plant per focus block, then Pause / Resume and End early -->
          <template v-else>
            <div class="blocks mt-3" :aria-label="`Focus round ${pomo.current.number} of ${pomo.focusTotal}`">
              <img v-for="n in pomo.focusTotal" :key="n" :class="blockArt(n).cls" :src="blockArt(n).src" alt="" />
            </div>
            <div class="d-flex gap-3 mt-4">
              <button v-if="pomo.running" type="button" class="sp-btn border-0 text-button justify-content-center" @click="pomo.pause()">
                <SproutIcon glyph="pause" :size="16" /> Pause
              </button>
              <button v-else type="button" class="sp-btn border-0 text-button justify-content-center" @click="pomo.resume()">
                <SproutIcon glyph="play" :size="16" /> Resume
              </button>
              <button type="button" class="sp-btn sp-btn-butter text-button" @click="pomo.endEarly()">End early</button>
            </div>
          </template>
        </div>

        <!-- music -->
        <GardenRadio class="sp-card side-card area-side" />

        <!-- timer settings (only before Start) -->
        <section v-if="idle" class="sp-card side-card area-settings" aria-labelledby="settings-title" data-testid="pomodoro-setup">
          <div id="settings-title" class="text-label-caption text-berry-deep mb-3">Timer settings</div>
          <div class="d-flex gap-2 mb-2" role="radiogroup" aria-label="Focus rhythm">
            <button
              v-for="r in PRESETS" :key="r.key" type="button" role="radio" class="quick-chip flex-fill justify-content-center"
              :class="{ active: pomo.preset === r.key }" :aria-checked="pomo.preset === r.key"
              :data-testid="`pomodoro-rhythm-${r.key}`" @click="pomo.choosePreset(r.key)"
            >
              <b>{{ r.name }}</b> <span>{{ r.focus / 60 }}/{{ r.rest / 60 }}</span>
            </button>
          </div>

          <!-- one row each: label, then − time + -->
          <div class="sp-rows">
            <div class="setting d-flex align-items-center justify-content-between gap-2">
              <span class="d-flex align-items-center gap-2"><SproutIcon name="focus" :size="22" /><span class="text-label-caption">Focus</span></span>
              <div class="d-flex align-items-center gap-2">
                <button type="button" class="nudge sm" aria-label="5 minutes less focus" @click="nudge('focus', -1)"><SproutIcon glyph="minus" :size="14" /></button>
                <DurationInput v-model="pomo.focusSeconds" class="text-button time-box sp-tnum" aria-label="Focus length, type digits" data-testid="pomodoro-focus" />
                <button type="button" class="nudge sm" aria-label="5 minutes more focus" @click="nudge('focus', 1)"><SproutIcon glyph="plus" :size="14" /></button>
              </div>
            </div>
            <div class="setting d-flex align-items-center justify-content-between gap-2">
              <span class="d-flex align-items-center gap-2"><SproutIcon name="coffee" :size="22" /><span class="text-label-caption">Break</span></span>
              <div class="d-flex align-items-center gap-2">
                <button type="button" class="nudge sm" aria-label="1 minute less break" @click="nudge('break', -1)"><SproutIcon glyph="minus" :size="14" /></button>
                <DurationInput v-model="pomo.breakSeconds" allow-zero class="text-button time-box sp-tnum" aria-label="Break length, type digits" data-testid="pomodoro-break" />
                <button type="button" class="nudge sm" aria-label="1 minute more break" @click="nudge('break', 1)"><SproutIcon glyph="plus" :size="14" /></button>
              </div>
            </div>
            <div class="setting d-flex align-items-center justify-content-between gap-2">
              <span class="d-flex align-items-center gap-2"><SproutIcon name="target" :size="22" /><span class="text-label-caption">Rounds</span></span>
              <div class="d-flex align-items-center gap-2">
                <button type="button" class="nudge sm" aria-label="One round less" :disabled="pomo.rounds <= 1" @click="pomo.rounds--"><SproutIcon glyph="minus" :size="14" /></button>
                <span class="text-button time-box sp-tnum" data-testid="pomodoro-rounds">{{ pomo.rounds }}</span>
                <button type="button" class="nudge sm" aria-label="One round more" :disabled="pomo.rounds >= MAX_ROUNDS" @click="pomo.rounds++"><SproutIcon glyph="plus" :size="14" /></button>
              </div>
            </div>
          </div>
          <!-- shown only after Start is pressed with times that aren't allowed -->
          <p v-if="showError && pomo.setupError" class="text-body-small text-berry-deep text-center mt-2 mb-0" role="alert" data-testid="pomodoro-error">{{ pomo.setupError }}</p>
          <p class="text-body-small text-center mt-2 mb-0">Tip: click a time to type it</p>
        </section>
      </div>

      <!-- finished -->
      <section v-else class="sp-paper panel text-center" data-testid="pomodoro-done">
        <span class="sp-tape is-leaf" aria-hidden="true"></span>
        <div class="bouquet" aria-hidden="true">
          <img v-for="n in Math.min(pomo.focusTotal, 7)" :key="n" :src="foliageUrl(`tulip-${bouquet[(n - 1) % bouquet.length]}-4`)" alt="" :style="{ animationDelay: `${n * 0.12}s` }" />
        </div>
        <h2 class="mb-2">Session complete</h2>
        <p class="text-body-small mb-4">
          You focused for {{ focusTime }}.
          <!-- only shown if something was ticked -->
          <template v-if="tasksDone">
            <br />You ticked off {{ tasksDone }} task{{ tasksDone === 1 ? '' : 's' }}.
          </template>
        </p>
        <button v-burst type="button" class="sp-btn border-0 text-button justify-content-center mx-auto" @click="pomo.endSession({ keepTasks: true })">
          Start another
        </button>
      </section>
    </div>
  </main>
</template>

<style scoped>
/* page (the meadow scenery sits behind) */
.focus-page { position: relative; min-height: calc(100vh - 92px); overflow-x: clip; padding-bottom: calc(var(--dock-h) + 40px); }

/* done card (paper look from theme.css .sp-paper) */
.panel { width: 100%; max-width: 460px; margin-top: 4vh; padding: 30px; }
.panel > .sp-tape { top: -12px; left: calc(50% - 46px); transform: rotate(-3deg); }
@media (max-width: 575.98px) { .panel { border-radius: 20px; } }


.nudge {
  display: grid; place-items: center;
  width: 36px; height: 36px; padding: 0;
  border: 0; border-radius: 50%;
  background: var(--paper); color: var(--ink);
  box-shadow: 0 3px 0 var(--line);
  transition: transform .15s, box-shadow .15s;
}
.nudge:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 0 var(--line); }
.nudge:active:not(:disabled) { transform: translateY(2px); box-shadow: 0 1px 0 var(--line); }
.nudge:disabled { opacity: .4; }
.nudge:focus-visible, .quick-chip:focus-visible { outline: 3px solid var(--leaf); outline-offset: 2px; }


/* Classic / Deep work chips */
.quick-chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 14px;
  border: 2px solid var(--line); border-radius: var(--r-pill);
  background: var(--paper); color: var(--ink);
  font-size: 14px;
  transition: border-color .15s, background .15s, transform .2s var(--spring);
}
.quick-chip span { color: var(--ink-soft); }
.quick-chip:hover { border-color: var(--leaf-soft); transform: translateY(-1px); }
.quick-chip.active { border-color: var(--leaf); background: var(--leaf-soft); }

/* timer settings card (label and dashed rows from theme.css) */
.setting { padding: 8px 0; }
.time-box { width: 64px; text-align: center; }
/* soft pill so the times look clickable */
.setting .time-box { padding: 2px 0; border-radius: var(--r-sm); background: var(--sheet-2); }
/* wider while typing, to fit "00h 25m 00s" */
.time-box.editing { width: 124px; }
.nudge.sm { width: 28px; height: 28px; box-shadow: 0 2px 0 var(--line); }

/* layout: one column below 1200px, three columns from 1200px */
.session {
  display: grid;
  gap: 24px;
  justify-items: center;
  grid-template-areas: "timer" "settings" "tasks" "side"; /* settings right under Start */
}
@media (min-width: 1200px) {
  .session {
    grid-template-columns: 1fr auto 1fr;
    grid-template-rows: auto 1fr; /* a long to-do list stretches the last row, so the settings stay under the radio */
    grid-template-areas: "tasks timer side" "tasks timer settings"; /* settings under Garden Radio */
    align-items: start;
    gap: 40px;
  }
}
.area-tasks { grid-area: tasks; }
.area-timer { grid-area: timer; }
.area-side { grid-area: side; }
.area-settings { grid-area: settings; }

/* width of the cards beside the timer (paper look from theme.css .sp-card) */
.side-card { width: 100%; max-width: 320px; }

/* timer ring: night look while focusing, paper and green on a break */
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
.ring-next { font-family: var(--f-hand); font-size: 1.3rem; opacity: .85; }
.ring.paused .text-timer { animation: paused 1.4s ease-in-out infinite; }
@keyframes paused { 50% { opacity: .35; } }
.ring-plant { position: absolute; left: 50%; bottom: 12%; height: 26%; width: auto; transform: translateX(-50%); transform-origin: 50% 100%; animation: sprout-in .6s var(--spring); }
.ring-plant.s { height: 38%; bottom: 5%; }
@keyframes sprout-in { from { transform: translateX(-50%) scale(.4); } }
.blocks { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; padding: 8px 14px; border-radius: var(--r-pill); background: color-mix(in srgb, var(--sheet) 85%, transparent); box-shadow: var(--shadow-1); }
.blocks img { width: 34px; height: 34px; transition: transform .5s var(--spring); }
.blocks img.s { transform: scale(2); transform-origin: 50% 90%; }
.blocks img.todo { filter: grayscale(1) opacity(.3); }
.blocks img.now { animation: nod 1.2s ease-in-out infinite alternate; }
@keyframes nod { to { translate: 0 -3px; } }
.bouquet { display: flex; justify-content: center; align-items: flex-end; height: 170px; margin-bottom: 8px; }
/* the tulips shrink to share the card's width, so any number of rounds fits */
.bouquet img { flex: 0 1 auto; min-width: 0; height: 150px; width: auto; object-fit: contain; object-position: 50% 100%; margin: 0 -14px; transform-origin: 50% 100%; animation: bloom .8s var(--spring) both; }
.bouquet img:nth-child(odd) { height: 128px; }
@keyframes bloom { from { transform: scale(0) rotate(-10deg); } }

.sp-btn { width: auto; min-width: 140px; order: 0; } /* global .sp-btn has order: 4 */
@media (prefers-reduced-motion: reduce) {
  .blocks img.now, .ring.paused .text-timer { animation: none; }
}
</style>
