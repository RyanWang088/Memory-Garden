<script setup>
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import SceneryBackdrop from '@/components/SceneryBackdrop.vue'
import { foliageUrl } from '@/lib/plantSprites'
import { vBurst } from '@/lib/burst'
import potArt from '@/assets/ui/pot.svg'

// Onboarding tour (journal look): four short "how it works" steps, an About-you step, then Ready.
// Saves through auth.completeOnboarding(answers, avatar) as before, plus the optional name as display_name.
const auth = useAuthStore()
const router = useRouter()

const STEPS = [
  { name: 'Welcome', art: 'seed' },
  { name: 'Planner', art: 'sprout' },
  { name: 'Focus', art: 'tulip-3' },
  { name: 'Seeds', art: 'tulip-pink-3' },
  { name: 'About you', art: 'tulip-yellow-3' },
  { name: 'Ready', art: 'FLOWER' },
]
const GOALS = ['IGCSE', 'IB Diploma', 'A-Levels', 'University', 'Something else']
const FLOWERS = ['pink', 'red', 'purple', 'yellow', 'white']

const saved = auth.profile?.onboarding_answers ?? {}
const answers = reactive({
  goal: saved.goal ?? '',
  hours: saved.hours ?? 8,
  name: saved.name ?? '',
  flower: saved.flower ?? 'pink',
})
const i = ref(0)
const reached = ref(0)
const back = ref(false)
const saving = ref(false)
const error = ref('')
const isSmall = (a) => a === 'seed' || a === 'sprout'
const artOf = (s) => (s.art === 'FLOWER' ? `tulip-${answers.flower}-4` : s.art)
const flowerUrl = computed(() => foliageUrl(`tulip-${answers.flower}-4`))
const blocksPerDay = computed(() => Math.max(1, Math.round((answers.hours * 60) / 30 / 7)))

function go(n) {
  if (n < 0 || n >= STEPS.length || n === i.value) return
  back.value = n < i.value
  i.value = n
  reached.value = Math.max(reached.value, n)
  if (n === STEPS.length - 1) finish()
}

let savePromise = null
function finish() {
  savePromise ??= save().finally(() => { if (error.value) savePromise = null })
  return savePromise
}
watch(answers, () => { savePromise = null }, { deep: true }) // edited after saving: save again
// leave only once the answers are saved, or the router guard would send us back here
async function leaveTo(name) {
  await finish()
  if (!error.value) router.push({ name })
}
async function save() {
  saving.value = true
  error.value = ''
  try {
    await auth.completeOnboarding({ ...answers }, answers.flower)
    if (answers.name.trim()) await auth.updateProfile({ display_name: answers.name.trim() })
  } catch (e) {
    error.value = "Couldn't save your answers. Check your connection and try again."
  } finally {
    saving.value = false
  }
}
const skip = () => leaveTo('garden')

/* illustrations: a ticking focus clock and a confetti burst on the last step */
const ft = ref(25 * 60)
let tick = null
const ftime = computed(() => `${String(Math.floor(ft.value / 60)).padStart(2, '0')}:${String(ft.value % 60).padStart(2, '0')}`)
const confetti = computed(() => (i.value === STEPS.length - 1 && !matchMedia('(prefers-reduced-motion: reduce)').matches
  ? Array.from({ length: 40 }, (_, k) => ({ left: `${(k * 37) % 100}%`, bg: ['#E0546A', '#F7CD5D', '#3E8B57', '#B9A7E8', '#F6B3BF'][k % 5], x: `${((k * 53) % 160) - 80}px`, delay: `${2 + ((k * 7) % 8) / 10}s` }))
  : []))
const miniCal = Array.from({ length: 35 }, (_, k) => k - 2)

/* keyboard ← → and swipe on the picture */
function onKey(e) {
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return
  if (e.key === 'ArrowRight') go(i.value + 1)
  if (e.key === 'ArrowLeft') go(i.value - 1)
}
let sx = null
const onDown = (e) => { sx = e.clientX }
const onUp = (e) => { if (sx === null) return; const dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 50) go(i.value + (dx < 0 ? 1 : -1)) }
onMounted(() => {
  tick = setInterval(() => { ft.value = ft.value <= 0 ? 25 * 60 : ft.value - 7 }, 120)
  window.addEventListener('keydown', onKey)
  window.addEventListener('pointerup', onUp)
})
onBeforeUnmount(() => { clearInterval(tick); window.removeEventListener('keydown', onKey); window.removeEventListener('pointerup', onUp) })
const narrow = typeof window !== 'undefined' && window.innerWidth < 600
</script>

<template>
  <div class="ob">
    <SceneryBackdrop mood="day" :options="{ seed: 5, butterflies: 3, tulips: narrow ? 2 : 10 }" />
    <div class="sp-page-top">
      <span class="brand">
        <img :src="potArt" alt="" width="38" height="38" />
        <span><span class="brand-name">Sproutly</span><span class="brand-sub">study garden &amp; planner</span></span>
      </span>
      <button class="sp-pill-link" type="button" data-testid="onboarding-skip" @click="skip">Skip tour</button>
    </div>

    <main class="ob-card" data-testid="onboarding">
      <span class="sp-tape is-butter" aria-hidden="true"></span>
      <nav class="steps" aria-label="Onboarding steps">
        <p class="script">Let's get <em>growing</em></p>
        <p class="small">Six quick steps. You can jump around.</p>
        <div class="sp-menu">
          <button
            v-for="(s, k) in STEPS" :key="s.name" type="button" class="sp-menu-btn" :class="{ done: k < i }"
            :aria-current="k === i ? 'step' : undefined" @click="go(k)"
          >
            <span class="mi"><img :class="{ s: isSmall(artOf(s)) }" :src="foliageUrl(artOf(s))" alt="" /></span>
            {{ s.name }}
            <span class="chev" aria-hidden="true">{{ k < i ? '✓' : '›' }}</span>
          </button>
        </div>
        <p class="foot">Each step grows your seed a little.</p>
      </nav>

      <section class="stage" :class="{ 'dir-back': back }" aria-live="polite">
        <div class="slide-art" aria-hidden="true" @pointerdown="onDown">
          <span class="sp-plate"></span>
          <Transition name="art">
            <!-- 1 welcome -->
            <div v-if="i === 0" key="a0" class="art a-welcome">
              <div class="orbit">
                <img :src="foliageUrl('tulip-pink-4')" alt="" style="left: -4%; top: 30%" /><img :src="foliageUrl('tulip-yellow-4')" alt="" style="right: -2%; top: 6%" />
                <img :src="foliageUrl('tulip-purple-4')" alt="" style="right: 6%; bottom: -2%" /><img :src="foliageUrl('tulip-white-4')" alt="" style="left: 18%; bottom: -6%" />
              </div>
              <!-- avatar goes here (left empty for now) -->
              <div class="avatar-slot" aria-hidden="true"></div>
              <span class="sparkle" style="left: 30%; top: 22%"></span><span class="sparkle" style="right: 28%; top: 30%; animation-delay: -.6s"></span>
            </div>
            <!-- 2 planner -->
            <div v-else-if="i === 1" key="a1" class="art a-planner">
              <div class="mini-book">
                <div class="pg"><div class="mb-title">Today</div>
                  <div class="mb-task"><i></i><span>Statistics flashcards</span></div>
                  <div class="mb-task"><i></i><span>Calculus Q1–6</span></div>
                  <div class="mb-task"><i></i><span>WAD lab: Pinia</span></div>
                  <div class="mb-task"><i></i><span>UI/UX wireframes</span></div>
                </div>
                <div class="pg"><div class="mb-month">October</div>
                  <div class="mb-cal"><b v-for="d in miniCal" :key="d" :class="{ hl: d === 23, ex: d === 31 }">{{ d > 0 && d < 32 ? d : '' }}</b></div>
                </div>
              </div>
            </div>
            <!-- 3 focus -->
            <div v-else-if="i === 2" key="a2" class="art a-focus">
              <div class="focus-art">
                <svg class="ring" viewBox="0 0 200 200"><circle class="trk" cx="100" cy="100" r="92" /><circle class="fil" cx="100" cy="100" r="92" /></svg>
                <div class="time">{{ ftime }}</div>
                <img class="tul" :src="foliageUrl('tulip-yellow-4')" alt="" />
                <i class="ff" style="left: 22%; top: 30%"></i><i class="ff" style="left: 72%; top: 44%; animation-delay: -.7s"></i><i class="ff" style="left: 34%; top: 70%; animation-delay: -1.2s"></i>
              </div>
            </div>
            <!-- 4 seeds -->
            <div v-else-if="i === 3" key="a3" class="art a-seeds">
              <div class="seeds-art">
                <div class="flash"><div class="flash-in">
                  <div class="face q"><div><small>STATISTICS · SEED 3</small>What is a Type I error?</div></div>
                  <div class="face a"><div><small>ANSWER</small>Rejecting a true null hypothesis</div></div>
                </div></div>
                <span class="tag-w">review on time → it grows</span>
                <div class="bed"><img class="s" :src="foliageUrl('sprout')" alt="" /><img :src="foliageUrl('tulip-3')" alt="" /><img :src="foliageUrl('tulip-red-4')" alt="" /></div>
              </div>
            </div>
            <!-- 5 you -->
            <div v-else-if="i === 4" key="a4" class="art a-you">
              <div class="you-art">
                <span class="hours">{{ answers.hours }} h / week</span>
                <img :key="answers.flower" class="flower" :src="flowerUrl" alt="" :style="{ transform: `scale(${0.55 + (Math.min(answers.hours, 30) / 30) * 0.6})` }" />
              </div>
            </div>
            <!-- 6 ready -->
            <div v-else key="a5" class="art a-ready">
              <div class="ready-art">
                <img class="s" :src="foliageUrl('seed')" alt="" /><img class="s" :src="foliageUrl('sprout')" alt="" /><img :src="foliageUrl('tulip-3')" alt="" /><img :src="flowerUrl" alt="" />
              </div>
              <div class="avatar-slot ready-slot" aria-hidden="true"></div>
              <div class="confetti"><i v-for="(c, k) in confetti" :key="k" :style="{ left: c.left, background: c.bg, '--x': c.x, animationDelay: c.delay }"></i></div>
            </div>
          </Transition>
          <!-- corner space for the avatar on the middle steps (left empty for now) -->
          <div v-if="i > 0 && i < STEPS.length - 1" class="avatar-slot guide-slot" aria-hidden="true"></div>
        </div>

        <div class="copy">
          <Transition name="copy" mode="out-in">
            <div v-if="i === 0" key="s0" class="slide">
              <span class="sp-eyebrow">Welcome</span>
              <h1>Welcome to <em>Sproutly</em></h1>
              <p>A calm study space where your plans, focus time and revision grow into a garden. Here's a quick look around before you plant your first seed.</p>
              <div class="chips"><span class="sp-chip">Planner</span><span class="sp-chip">To-do list</span><span class="sp-chip">Calendar</span><span class="sp-chip">Focus timer</span><span class="sp-chip">Memory seeds</span></div>
            </div>
            <div v-else-if="i === 1" key="s1" class="slide">
              <span class="sp-eyebrow">Your planner</span>
              <h1>Know your <em>study plan</em></h1>
              <p>An open book with your to-do list on the left and a month calendar on the right. Pick a date and the list follows.</p>
              <ul class="points"><li>Tick tasks off and watch the day's sprout grow.</li><li>Exams from your garden are stamped on the calendar.</li><li>Turn the page corner to flip to next month.</li></ul>
            </div>
            <div v-else-if="i === 2" key="s2" class="slide">
              <span class="sp-eyebrow">Focus</span>
              <h1>Grow with <em>focus</em></h1>
              <p>Short focus blocks with breaks in between, like 25 minutes on and 5 off. Night falls over the meadow while you work.</p>
              <ul class="points"><li>Earn coins for every focus block you finish.</li><li>Keep a small to-do list for the session.</li><li>Play Garden Radio: calm lo-fi picked to match the weather.</li></ul>
            </div>
            <div v-else-if="i === 3" key="s3" class="slide">
              <span class="sp-eyebrow">Memory seeds</span>
              <h1>Plant <em>memory seeds</em></h1>
              <p>Turn your notes into a seed of flashcards for one topic. Review it when it's due and it grows from sprout to flower by your exam date.</p>
              <ul class="points"><li>Quizzes, flexible decks and short answers.</li><li>Forget to water a seed and it starts to wilt.</li><li>After the exam, keep your flower on a shelf.</li></ul>
            </div>
            <div v-else-if="i === 4" key="s4" class="slide form-slide">
              <span class="sp-eyebrow">About you</span>
              <h1 style="font-size: clamp(1.8rem, 3vw, 2.4rem)">Tell us <em>a little</em></h1>
              <div class="q"><span id="goal-l" class="sp-label">What are you studying for?</span>
                <div class="chips" role="group" aria-labelledby="goal-l">
                  <button v-for="g in GOALS" :key="g" class="sp-chip" type="button" :aria-pressed="answers.goal === g" @click="answers.goal = g">{{ g }}</button>
                </div>
              </div>
              <div class="q"><label class="sp-label" for="ob-hours">How many hours a week can you study?</label>
                <div class="range-row"><input id="ob-hours" v-model.number="answers.hours" class="range" type="range" min="1" max="40" /><output for="ob-hours">{{ answers.hours }} h</output></div>
              </div>
              <div class="q"><label class="sp-label" for="ob-name">What should we call you? <span class="sp-muted" style="font-weight: 600">(optional)</span></label>
                <input id="ob-name" v-model="answers.name" class="sp-input" maxlength="24" placeholder="e.g. Mia" autocomplete="given-name" data-testid="onboarding-name" />
              </div>
              <div class="q"><span id="fl-l" class="sp-label">Pick your gardener flower</span>
                <div class="swatches" role="group" aria-labelledby="fl-l">
                  <button v-for="c in FLOWERS" :key="c" class="sw" type="button" :aria-label="`${c} tulip`" :aria-pressed="answers.flower === c" @click="answers.flower = c">
                    <img :src="foliageUrl(`tulip-${c}-4`)" alt="" />
                  </button>
                </div>
              </div>
            </div>
            <div v-else key="s5" class="slide">
              <span class="sp-eyebrow">All set</span>
              <h1>{{ answers.name.trim() ? `${answers.name.trim()}, your` : 'Your' }} garden is <em>ready</em></h1>
              <div class="summary">
                <span>Studying for <b>{{ answers.goal || 'your exams' }}</b></span>
                <span>About <b>{{ answers.hours }} hours</b> a week · try {{ blocksPerDay }} focus block{{ blocksPerDay === 1 ? '' : 's' }} a day</span>
                <span>Your flower: <b>{{ answers.flower }} tulip</b></span>
              </div>
              <p v-if="error" class="status-err" role="alert">{{ error }} <button class="linkish" type="button" @click="finish()">Try again</button></p>
              <div style="display: flex; gap: 10px; flex-wrap: wrap">
                <button v-burst class="sp-btn" type="button" :disabled="saving" data-testid="onboarding-finish" @click="leaveTo('garden')">Go to my garden <span class="arrow">→</span></button>
              </div>
            </div>
          </Transition>
        </div>
      </section>

      <div class="ob-foot">
        <div class="sp-thumbs" role="tablist" aria-label="Steps">
          <button
            v-for="(s, k) in STEPS" :key="s.name" class="sp-thumb" :class="{ dim: k > reached }" role="tab" type="button"
            :aria-label="`Step ${k + 1}: ${s.name}`" :aria-selected="k === i" @click="go(k)"
          ><img :class="{ s: isSmall(artOf(s)) }" :src="foliageUrl(artOf(s))" alt="" /></button>
        </div>
        <span class="hint">swipe, or use ← →</span>
        <div class="nav-btns">
          <span class="count">{{ i + 1 }} / {{ STEPS.length }}</span>
          <button class="sp-btn sp-btn-ghost" type="button" :style="{ visibility: i === 0 ? 'hidden' : 'visible' }" @click="go(i - 1)">Back</button>
          <button v-if="i < STEPS.length - 1" v-burst class="sp-btn" type="button" data-testid="onboarding-next" @click="go(i + 1)">
            {{ i === STEPS.length - 2 ? 'Finish' : 'Next' }} <span class="arrow">→</span>
          </button>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.ob { min-height: 100vh; min-height: 100dvh; display: flex; flex-direction: column; padding: 0 max(16px, env(safe-area-inset-right, 0px)) 24px max(16px, env(safe-area-inset-left, 0px)); }
.brand { display: inline-flex; align-items: center; gap: 10px; color: var(--ink); }
.brand img { width: 38px; height: 38px; }
.brand-name { font-family: var(--f-display); font-style: italic; font-weight: 600; font-size: 1.45rem; line-height: 1; display: block; }
.brand-sub { display: block; font-size: .6rem; font-weight: 800; letter-spacing: .2em; text-transform: uppercase; color: var(--ink-soft); margin-top: 3px; }
.sp-pill-link { border: 0; }

.ob-card {
  position: relative; width: 100%; max-width: 1180px; margin: auto; flex: 1; max-height: 760px; min-height: 600px;
  display: grid; grid-template-columns: 230px 1fr; grid-template-rows: 1fr auto;
  border-radius: 30px; background: color-mix(in srgb, var(--sheet) 94%, transparent); box-shadow: var(--shadow-2);
  backdrop-filter: blur(10px);
}
.ob-card::after { content: ""; position: absolute; inset: 0; border-radius: inherit; background-image: var(--grain); opacity: .14; mix-blend-mode: multiply; pointer-events: none; }
.ob-card .sp-tape { top: -12px; left: 46%; transform: rotate(-3deg); }

.steps { grid-row: 1 / 3; padding: 34px 18px 24px 24px; border-right: 1.5px dashed var(--line); display: flex; flex-direction: column; gap: 10px; }
.steps .script { font-family: var(--f-hand); font-size: 2.3rem; line-height: .95; color: var(--ink); margin: 0 0 4px 4px; }
.steps .script em { color: var(--berry); font-style: normal; }
.steps p.small { margin: 0 0 14px 4px; font-size: .8rem; color: var(--ink-soft); }
.steps .foot { margin-top: auto; font-family: var(--f-hand); font-size: 1.2rem; color: var(--ink-soft); line-height: 1.1; }

.stage { position: relative; overflow: hidden; display: grid; grid-template-columns: 1.1fr 1fr; align-items: center; gap: 24px; padding: 34px 42px 10px; min-height: 0; }
.slide-art { position: relative; height: 100%; min-height: 380px; display: grid; place-items: center; touch-action: pan-y; }
.art { position: absolute; inset: 0; display: grid; place-items: center; }
.art-enter-active { animation: art-in .8s var(--spring) both; }
.dir-back .art-enter-active { animation-name: art-in-back; }
.art-leave-active { animation: art-out .45s var(--ease) both; }
@keyframes art-in { from { opacity: 0; transform: translateX(50px) scale(.85) rotate(4deg); } to { opacity: 1; transform: none; } }
@keyframes art-in-back { from { opacity: 0; transform: translateX(-50px) scale(.85) rotate(-4deg); } to { opacity: 1; transform: none; } }
@keyframes art-out { to { opacity: 0; transform: scale(.9) translateY(14px); } }

.copy { position: relative; min-height: 380px; height: 100%; display: flex; align-items: center; }
.slide { display: flex; flex-direction: column; justify-content: center; gap: 14px; width: 100%; }
.slide > * { animation: copy-in .6s var(--ease) both; }
.slide > *:nth-child(2) { animation-delay: .06s; } .slide > *:nth-child(3) { animation-delay: .12s; }
.slide > *:nth-child(4) { animation-delay: .18s; } .slide > *:nth-child(5) { animation-delay: .24s; }
@keyframes copy-in { from { opacity: 0; transform: translateX(26px); } }
.dir-back .slide > * { animation-name: copy-in-back; }
@keyframes copy-in-back { from { opacity: 0; transform: translateX(-26px); } }
.copy-leave-active { transition: opacity .15s; }
.copy-leave-to { opacity: 0; }
.slide h1 { font-size: clamp(2.1rem, 3.8vw, 3.2rem); line-height: 1.05; margin: 0; }
.slide p { margin: 0; color: var(--ink-soft); max-width: 44ch; }
.points { list-style: none; margin: 4px 0 0; padding: 0; display: grid; gap: 8px; }
.points li { display: flex; gap: 10px; align-items: flex-start; font-size: .95rem; }
.points li::before { content: ""; flex: none; width: 18px; height: 18px; margin-top: 3px; border-radius: 0 100% 0 100%; background: var(--leaf); transform: rotate(-10deg); }
.chips { display: flex; flex-wrap: wrap; gap: 8px; }

.ob-foot { grid-column: 2; display: flex; align-items: center; gap: 16px; padding: 14px 42px 22px; }
.sp-thumbs { flex-wrap: nowrap; }
.hint { font-family: var(--f-hand); font-size: 1.15rem; color: var(--ink-soft); white-space: nowrap; }
.nav-btns { margin-left: auto; display: flex; gap: 10px; align-items: center; }
.count { font-weight: 800; font-size: .78rem; letter-spacing: .1em; color: var(--ink-soft); text-transform: uppercase; }

/* art 1 */
/* reserved space for the onboarding avatar (empty for now; drop an <img> inside .avatar-slot later) */
.avatar-slot { position: relative; width: min(220px, 50%); height: min(340px, 88%); }
.guide-slot { position: absolute; z-index: 4; left: 0; bottom: 0; width: 110px; height: 150px; }
.ready-slot { position: absolute; left: 4%; bottom: 0; width: 26%; height: 62%; }
.orbit { position: absolute; width: min(380px, 86%); aspect-ratio: 1; animation: orbit 26s linear infinite; }
.orbit img { position: absolute; height: 130px; width: auto; animation: orbit 26s linear infinite reverse; }
@keyframes orbit { to { transform: rotate(360deg); } }
.sparkle { position: absolute; width: 16px; height: 16px; background: var(--butter); clip-path: polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%); animation: twinkle 1.6s ease-in-out infinite alternate; }
@keyframes twinkle { from { opacity: .3; } to { opacity: 1; } }
/* art 2 */
.mini-book { position: relative; width: min(440px, 96%); aspect-ratio: 1.55; display: grid; grid-template-columns: 1fr 1fr; padding: 9px; border-radius: 14px; background: linear-gradient(#3d6b4c, #31593f); box-shadow: 0 30px 40px -24px rgba(30,40,25,.6); transform: rotate(-3deg); }
.mini-book .pg { background: var(--sheet); padding: 16px 14px; position: relative; }
.mini-book .pg:first-child { border-radius: 8px 2px 2px 8px; background-image: linear-gradient(90deg, transparent 88%, rgba(110,80,50,.16)), repeating-linear-gradient(180deg, transparent 0 25px, var(--rule) 25px 26px); }
.mini-book .pg:last-child { border-radius: 2px 8px 8px 2px; background-image: linear-gradient(270deg, transparent 88%, rgba(110,80,50,.16)); }
.mb-title { font-family: var(--f-hand); font-size: 1.3rem; line-height: 1; margin-bottom: 8px; }
.mb-task { display: flex; align-items: center; gap: 7px; height: 26px; font-family: var(--f-hand); font-size: 1.05rem; }
.mb-task i { width: 14px; height: 14px; border-radius: 50%; border: 1.5px solid var(--ink-faint); flex: none; background: #fff; animation: tick-fill .3s ease forwards; }
.mb-task span { background: linear-gradient(var(--berry-deep), var(--berry-deep)) no-repeat 0 58% / 0 1.5px; animation: strike .4s ease forwards; }
.mb-task:nth-child(3) i, .mb-task:nth-child(3) span { animation-delay: .9s; }
.mb-task:nth-child(4) i, .mb-task:nth-child(4) span { animation-delay: 1.6s; }
.mb-task:nth-child(5) i, .mb-task:nth-child(5) span { animation: none; }
@keyframes tick-fill { to { background: var(--leaf); border-color: var(--leaf); box-shadow: inset 0 0 0 2.5px #fff; } }
@keyframes strike { to { background-size: 100% 1.5px; color: var(--ink-faint); } }
.mb-cal { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; margin-top: 6px; }
.mb-cal b { aspect-ratio: 1; border-radius: 3px; background: var(--sheet-2); font-size: .5rem; font-weight: 700; color: var(--ink-soft); display: grid; place-items: center; position: relative; }
.mb-cal b.ex::after { content: ""; position: absolute; inset: -2px; border: 1.5px solid var(--berry); border-radius: 50%; transform: rotate(-8deg); }
.mb-cal b.hl { animation: hl .5s ease 2.1s forwards; }
@keyframes hl { to { background: var(--butter); color: var(--ink); } }
.mb-month { font-family: var(--f-display); font-style: italic; font-weight: 600; font-size: 1.15rem; }
/* art 3 */
.focus-art { position: relative; width: min(320px, 80%); aspect-ratio: 1; border-radius: 50%; background: radial-gradient(circle at 50% 120%, #2b3566, #0f1736 70%); box-shadow: 0 30px 50px -25px rgba(15,23,54,.7), inset 0 0 0 10px rgba(255,255,255,.06); display: grid; place-items: center; overflow: hidden; }
.focus-art svg.ring { position: absolute; inset: 6%; width: 88%; height: 88%; transform: rotate(-90deg); }
.focus-art .trk { fill: none; stroke: rgba(255,255,255,.12); stroke-width: 8; }
.focus-art .fil { fill: none; stroke: var(--butter); stroke-width: 8; stroke-linecap: round; stroke-dasharray: 600; stroke-dashoffset: 600; animation: fill-ring 6s linear infinite; }
@keyframes fill-ring { to { stroke-dashoffset: 0; } }
.focus-art .time { position: relative; z-index: 2; font-family: var(--f-display); font-size: 2.6rem; color: #fdf3d6; font-variant-numeric: tabular-nums; margin-top: -40px; }
.focus-art .tul { position: absolute; bottom: 12%; height: 48%; width: auto; transform-origin: 50% 100%; animation: grow-tul 6s ease-in-out infinite; }
@keyframes grow-tul { 0% { transform: scale(.3); } 80%, 100% { transform: scale(1); } }
.focus-art i.ff { position: absolute; width: 5px; height: 5px; border-radius: 50%; background: #fff3a8; box-shadow: 0 0 8px 3px rgba(255,236,140,.6); animation: glow 1.8s ease-in-out infinite alternate; }
@keyframes glow { from { opacity: .15; } to { opacity: 1; } }
/* art 4 */
.seeds-art { position: relative; width: min(420px, 96%); height: 300px; }
.flash { position: absolute; left: 50%; top: 10px; width: 210px; height: 140px; margin-left: -105px; perspective: 900px; }
.flash-in { position: absolute; inset: 0; transform-style: preserve-3d; animation: flip-card 4s ease-in-out infinite; }
@keyframes flip-card { 0%, 35% { transform: rotateY(0); } 50%, 85% { transform: rotateY(180deg); } 100% { transform: rotateY(360deg); } }
.face { position: absolute; inset: 0; backface-visibility: hidden; border-radius: 16px; display: grid; place-items: center; padding: 16px; text-align: center; box-shadow: var(--shadow-1); }
.face.q { background: #fff; border: 2px solid var(--line); font-family: var(--f-display); font-size: 1.05rem; }
.face.a { background: var(--leaf-soft); border: 2px solid var(--leaf); transform: rotateY(180deg); font-family: var(--f-hand); font-size: 1.5rem; color: var(--leaf-deep); }
.face small { display: block; font-family: var(--f-body); font-size: .62rem; font-weight: 800; letter-spacing: .14em; color: var(--ink-soft); margin-bottom: 4px; }
.bed { position: absolute; left: 0; right: 0; bottom: 0; height: 120px; border-radius: 50% 50% 18px 18px / 30% 30% 18px 18px; background: linear-gradient(#8a5a3f, #6e4532); display: flex; justify-content: space-around; align-items: flex-end; padding: 0 20px 34px; }
.bed img { width: 80px; height: 80px; margin-bottom: -6px; animation: pop-in .6s var(--spring) both; }
.bed img.s { transform: scale(1.7); transform-origin: 50% 90%; animation-name: pop-in-s; }
.bed img:nth-child(2) { animation-delay: .25s; } .bed img:nth-child(3) { animation-delay: .5s; }
@keyframes pop-in { from { transform: scale(0); } }
@keyframes pop-in-s { from { transform: scale(0); } to { transform: scale(1.7); } }
.tag-w { position: absolute; right: 0; top: 152px; font-family: var(--f-hand); font-size: 1.2rem; color: var(--berry-deep); transform: rotate(-6deg); }
/* art 5 */
.you-art { position: relative; width: min(300px, 80%); display: grid; place-items: end center; height: 340px; }
.you-art .flower { position: absolute; bottom: 0; height: 330px; width: auto; transform-origin: 50% 100%; transition: transform .6s var(--spring); animation: pop-in .5s var(--spring); }
.you-art .hours { position: absolute; top: 10px; left: -30px; z-index: 2; font-family: var(--f-hand); font-size: 1.6rem; color: var(--ink); transform: rotate(6deg); background: var(--butter-soft); padding: 4px 12px; border-radius: 10px; box-shadow: var(--shadow-1); }
.q { display: grid; gap: 8px; }
.range { width: 100%; accent-color: var(--leaf); }
.range-row { display: flex; gap: 12px; align-items: center; }
.range-row output { font-family: var(--f-hand); font-size: 1.5rem; min-width: 5ch; }
.swatches { display: flex; gap: 10px; flex-wrap: wrap; }
.sw { width: 52px; height: 52px; border-radius: 14px; border: 2px solid var(--line); background: #fff; padding: 0; display: grid; place-items: end center; overflow: hidden; transition: transform .25s var(--spring), border-color .2s; }
.sw img { width: 46px; height: 46px; }
.sw[aria-pressed="true"] { border-color: var(--berry); transform: translateY(-3px) rotate(-4deg); box-shadow: 0 0 0 3px var(--berry-soft); }
.form-slide { gap: 12px; }
/* art 6 */
.ready-art { position: relative; width: 260px; height: 320px; display: grid; place-items: end center; }
.ready-art img { position: absolute; bottom: 0; height: 300px; width: auto; opacity: 0; transform-origin: 50% 100%; animation: stage 3.2s ease forwards; }
.ready-art img.s { height: 150px; transform: scale(1.4); }
.ready-art img:nth-child(2) { animation-delay: .7s; }
.ready-art img:nth-child(3) { height: 220px; animation-delay: 1.4s; }
.ready-art img:nth-child(4) { animation: bloom-in 1s var(--spring) 2.1s forwards; }
@keyframes stage { 0% { opacity: 0; } 8%, 20% { opacity: 1; } 28%, 100% { opacity: 0; } }
@keyframes bloom-in { from { opacity: 0; transform: scale(.6); } to { opacity: 1; transform: scale(1); } }
.confetti { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
.confetti i { position: absolute; top: -10px; width: 9px; height: 12px; border-radius: 80% 0 80% 0; animation: conf 2.6s ease-in both; }
@keyframes conf { from { opacity: 1; } to { transform: translate(var(--x), 440px) rotate(600deg); opacity: 0; } }
.summary { display: grid; gap: 6px; padding: 14px 16px; border-radius: 16px; background: #fff; box-shadow: var(--shadow-1); font-size: .92rem; }
.summary b { font-family: var(--f-hand); font-size: 1.35rem; font-weight: 700; }
.status-err { color: var(--berry-deep) !important; font-weight: 700; font-size: .9rem; }
.linkish { border: 0; background: none; padding: 0; font-weight: 800; color: var(--berry-deep); text-decoration: underline; }
@keyframes bob { to { transform: translateY(-10px) rotate(2deg); } }

@media (max-width: 1000px) {
  .ob-card { grid-template-columns: 1fr; max-height: none; }
  .steps { display: none; }
  .ob-foot { grid-column: 1; }
}
@media (max-width: 760px) {
  .stage { grid-template-columns: 1fr; padding: 22px 18px 0; gap: 4px; align-items: start; }
  .slide-art { min-height: 260px; height: 260px; }
  .copy { min-height: 380px; align-items: flex-start; }
  .sp-plate { width: 250px; }
  .orbit img { height: 76px; }
  .avatar-slot { height: 230px; }
  .guide-slot { width: 70px; height: 96px; }
  .ready-slot { height: 52%; }
  .orbit { width: 270px; }
  .mini-book { width: 300px; }
  .focus-art { width: 220px; }
  .seeds-art { transform: scale(.78); transform-origin: top center; }
  .you-art { transform: scale(.55); transform-origin: bottom center; height: 260px; }
  .ready-art { transform: scale(.62); transform-origin: bottom center; }
  .slide-art { overflow: hidden; }
  .ob-foot { flex-wrap: wrap; padding: 12px 18px 18px; gap: 10px; }
  .hint { display: none; }
  .sp-thumbs { width: 100%; justify-content: space-between; }
  .sp-thumb { width: 46px; height: 46px; } .sp-thumb img { width: 40px; height: 40px; }
  .nav-btns { width: 100%; }
  .nav-btns .sp-btn:last-child { flex: 1; }
}
</style>
