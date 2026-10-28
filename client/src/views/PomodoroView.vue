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

/* ---------- before Start ----------
   No setup steps: the page opens on the timer screen with the ring not started yet. The focus, break and
   rounds controls sit under the ring until Start is pressed (Start runs the same store checks as before). */
const idle = computed(() => pomo.phase === 'setup')
const showError = ref(false) // the error shows only after Start is pressed

// open straight on Custom, keeping whatever times are already there (25/5 the first time)
function openOnCustom() {
  if (!pomo.preset) pomo.choosePreset('custom')
}
// the garden marks the seeds most worth revising with "!"; offer them as to-do items before each session
// (seeds come from the Express API through the garden store, like everywhere else)
async function suggestReviews() {
  try { await garden.fetchSeeds() } catch { return } // can't load them: the list just has the user's own tasks
  const due = garden.seeds.filter(s => s.alert).sort((a, b) => b.priority - a.priority)
  pomo.addReviewTasks(due)
}

onMounted(() => {
  pomo.endBy = 'rounds' // sessions are set by rounds only
  openOnCustom()
  if (idle.value) suggestReviews()
})

// back to setup (Start another, End early, or the mini player's session ending)
watch(() => pomo.phase, (phase) => {
  if (phase !== 'setup') return
  showError.value = false
  openOnCustom()
  suggestReviews()
})

// typing or nudging a time after picking Classic / Deep work turns it into your own rhythm
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

// the ring's text: before Start it describes the session you've set, then it follows the timer
const ringCaption = computed(() => (idle.value ? `Ready · ${pomo.rounds} round${pomo.rounds === 1 ? '' : 's'}` : caption.value))
const ringNext = computed(() => (idle.value
  ? (pomo.breakSeconds ? `breaks of ${lengthText(pomo.breakSeconds)}` : 'no breaks')
  : nextLabel.value))

// one dot per focus block, filled once it has started (break n comes right after focus block n)
const focusStarted = computed(() => pomo.current.number)

/* ---------- finished ---------- */
const tasksDone = computed(() => pomo.tasks.filter(t => t.done).length)
// done screen: total focus time, e.g. "50 min" or "1h 40 min" (only shown after every block is finished)
const focusTime = computed(() => lengthText(pomo.blocks.filter(b => b.type === 'focus').reduce((sum, b) => sum + b.seconds, 0)))
</script>

<template>
  <main class="focus-page" :class="`is-${pomo.phase}`" data-testid="pomodoro">
    <SceneryBackdrop :mood="mood" :options="{ seed: 31, tulips: narrow ? 3 : 10, butterflies: 2, horizon: 0.64 }" />

    <div class="container position-relative py-4 d-flex flex-column align-items-center">
      <!-- 1 + 2. before Start and while running: tasks | timer | music (stacked on small screens, timer first) -->
      <div v-if="pomo.phase !== 'done'" class="session w-100">
        <SessionTodo class="sp-card side-card area-tasks" />

        <div class="area-timer d-flex flex-column align-items-center">
          <!-- the timer ring: before Start it shows the chosen focus time, then it counts down -->
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

          <!-- before Start: just the Start button here (the timer settings are in the right column) -->
          <div v-if="idle" class="mt-4">
            <button type="button" class="btn-primary border-0 text-button justify-content-center" data-testid="pomodoro-start" @click="start">
              <SproutIcon glyph="play" :size="16" /> Start
            </button>
          </div>

          <!-- running: one plant per focus block, and the pause / end buttons -->
          <template v-else>
            <div class="blocks mt-3" :aria-label="`Focus round ${focusStarted} of ${pomo.focusTotal}`">
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
          </template>
        </div>

        <!-- right column: music -->
        <div class="area-side d-grid gap-4">
          <GardenRadio class="sp-card side-card" />
        </div>

        <!-- timer settings, only before Start: under Garden Radio on wide screens, right under Start on phones -->
        <section v-if="idle" class="sp-card side-card area-settings" aria-labelledby="settings-title" data-testid="pomodoro-setup">
          <div id="settings-title" class="text-label-caption sp-card-label mb-3">Timer settings</div>
          <div class="d-flex gap-2 mb-2" role="radiogroup" aria-label="Focus rhythm">
            <button
              v-for="r in PRESETS" :key="r.key" type="button" role="radio" class="quick-chip flex-fill justify-content-center"
              :class="{ active: pomo.preset === r.key }" :aria-checked="pomo.preset === r.key"
              :data-testid="`pomodoro-rhythm-${r.key}`" @click="pomo.choosePreset(r.key)"
            >
              <b>{{ r.name }}</b> <span>{{ r.focus / 60 }}/{{ r.rest / 60 }}</span>
            </button>
          </div>

          <!-- one row each: label on the left, then - value + -->
          <div class="settings sp-rows">
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
          <!-- shown after Start is pressed with a time that isn't allowed -->
          <p v-if="showError && pomo.setupError" class="text-body-small text-danger text-center mt-2 mb-0" role="alert" data-testid="pomodoro-error">{{ pomo.setupError }}</p>
          <p class="text-body-small text-center mt-2 mb-0">Tip: click a time to type it</p>
        </section>
      </div>

      <!-- 3. finished -->
      <section v-else class="sp-paper panel text-center done-card" data-testid="pomodoro-done">
        <span class="sp-tape is-leaf" aria-hidden="true"></span>
        <div class="bouquet" aria-hidden="true">
          <img v-for="n in Math.min(pomo.focusTotal, 7)" :key="n" :src="foliageUrl(`tulip-${['pink', 'yellow', 'purple', 'red'][(n - 1) % 5]}-4`)" alt="" :style="{ animationDelay: `${n * 0.12}s` }" />
        </div>
        <h2 class="mb-2">Session complete</h2>
        <p class="text-body-small mb-4">
          You focused for {{ focusTime }}.
          <!-- only celebrate ticked tasks; "0 of 2" would feel like a telling-off -->
          <template v-if="tasksDone">
            <br />You ticked off {{ tasksDone }} task{{ tasksDone === 1 ? '' : 's' }}.
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

/* the done card: its paper look comes from theme.css .sp-paper */
.panel { width: 100%; max-width: 460px; margin-top: 3vh; padding: 28px; }
.panel > .sp-tape { top: -12px; left: calc(50% - 46px); transform: rotate(-3deg); }
@media (max-width: 575.98px) { .panel { padding: 22px 18px 24px; border-radius: 20px; } }


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
.nudge:focus-visible, .quick-chip:focus-visible { outline: 3px solid var(--periwinkle); outline-offset: 2px; }


/* Classic / Deep work chips */
.quick-chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 14px;
  border: 2px solid var(--linen); border-radius: var(--r-pill);
  background: var(--paper); color: var(--bark);
  font-size: 14px;
  transition: border-color .15s, background .15s, transform .2s var(--spring);
}
.quick-chip span { color: var(--bark-muted); }
.quick-chip:hover { border-color: var(--peri-soft); transform: translateY(-1px); }
.quick-chip.active { border-color: var(--periwinkle); background: var(--peri-soft); }

/* the timer settings card: label and dashed rows come from theme.css (.sp-card-label, .sp-rows) */
.setting { padding: 8px 0; }
.time-box { width: 64px; text-align: center; }
/* a soft paper pill, so the times look clickable (.setting adds weight over the input's own styles) */
.setting .time-box { padding: 2px 0; border-radius: var(--r-sm); background: var(--sheet-2); }
/* while typing, the box shows "00h 25m 00s", so it gets wider to fit it all without scrolling */
.time-box.editing { width: 124px; }
.nudge.sm { width: 28px; height: 28px; box-shadow: 0 2px 0 var(--linen); }

/* running layout: one column below 1200px (timer first), three columns on wide screens */
.session {
  display: grid;
  gap: 24px;
  justify-items: center;
  grid-template-areas: "timer" "settings" "tasks" "side"; /* settings right under Start */
}
@media (min-width: 1200px) {
  .session {
    grid-template-columns: 1fr auto 1fr;
    grid-template-areas: "tasks timer side" "tasks timer settings"; /* settings under Garden Radio */
    align-items: start;
    gap: 40px;
  }
}
.area-tasks { grid-area: tasks; }
.area-timer { grid-area: timer; }
.area-side { grid-area: side; width: 100%; max-width: 320px; }
.area-settings { grid-area: settings; }

/* the cards either side of the timer: the paper look is theme.css .sp-card, this only sets their width
   (scoped styles also reach a child component's root) */
.side-card { width: 100%; max-width: 320px; }

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
.blocks { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; padding: 8px 14px; border-radius: var(--r-pill); background: color-mix(in srgb, var(--sheet) 85%, transparent); box-shadow: var(--shadow-1); }
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

@media (prefers-reduced-motion: reduce) {
  .blocks img.now, .ring.paused .text-timer { animation: none; }
}
</style>
