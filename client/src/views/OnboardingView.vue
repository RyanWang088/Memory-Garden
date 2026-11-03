<script setup>
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import SceneryBackdrop from '@/components/SceneryBackdrop.vue'
import { foliageUrl } from '@/lib/plantSprites'
import { vBurst } from '@/lib/burst'
import potArt from '@/assets/ui/pot.svg'
import canArt from '@/assets/ui/wateringcan.png'
import SproutIcon from '@/components/SproutIcon.vue'

// Onboarding tour (journal look): five short "how it works" steps, an About-you step, then Ready.
// Saves through auth.completeOnboarding(answers, avatar) as before, plus the required name as display_name.
const auth = useAuthStore()
const router = useRouter()

const STEPS = [
  { name: 'Welcome', art: 'seed' },
  { name: 'Planner', art: 'sprout' },
  { name: 'Focus', art: 'tulip-3' },
  { name: 'Plant', art: 'tulip-purple-3' },
  { name: 'Review', art: 'tulip-pink-3' },
  { name: 'About you', art: 'tulip-yellow-3' },
  { name: 'Ready', art: 'FLOWER' },
]
const GOALS = ['IGCSE', 'IB Diploma', 'A-Levels', 'University', 'Something else']
const FLOWERS = ['pink', 'red', 'purple', 'yellow']

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
// ‹ › beside the About you tulip step through the flower colours
function stepFlower(d) {
  const k = FLOWERS.indexOf(answers.flower)
  answers.flower = FLOWERS[(k + d + FLOWERS.length) % FLOWERS.length]
}
const isSmall = (a) => a === 'seed' || a === 'sprout'
const artOf = (s) => (s.art === 'FLOWER' ? `tulip-${answers.flower}-4` : s.art)
const flowerUrl = computed(() => foliageUrl(`tulip-${answers.flower}-4`))
const blocksPerDay = computed(() => Math.max(1, Math.round((answers.hours * 60) / 30 / 7)))

// the name is required: steps past About you (and Skip tour) stay locked until it is filled in
const ABOUT = STEPS.findIndex((s) => s.name === 'About you')
const nameMissing = ref(false) // shown after trying to move on without a name
const nameInput = ref(null)
watch(() => answers.name, (n) => { if (n.trim()) nameMissing.value = false })
function needName() {
  nameMissing.value = true
  if (i.value !== ABOUT) go(ABOUT)
  setTimeout(() => nameInput.value?.focus(), 350) // after the slide transition
}

function go(n) {
  if (n < 0 || n >= STEPS.length || n === i.value) return
  if (n > ABOUT && !answers.name.trim()) return needName()
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
    await auth.updateProfile({ display_name: answers.name.trim() })
  } catch (e) {
    error.value = "Couldn't save your answers. Check your connection and try again."
  } finally {
    saving.value = false
  }
}
const skip = () => (answers.name.trim() ? leaveTo('garden') : needName())

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
  if (e.target.closest?.('.flower-carousel')) return // ← → change the flower there, not the step
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
        <p class="small">Seven quick steps. You can jump around.</p>
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
        <div class="slide-art" :aria-hidden="i === 5 ? undefined : 'true'" @pointerdown="onDown">
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
            <!-- 4 plant -->
            <div v-else-if="i === 3" key="a3" class="art a-plant">
              <div class="plant-art">
                <!-- mini Seeds tab (same theme classes as the shed) -->
                <div class="shed-mini">
                  <div class="sp-packet-grid">
                    <div>
                      <article class="sp-packet">
                        <span class="sp-tape"></span>
                        <span class="sp-packet-art"><img :src="foliageUrl('tulip-pink-4')" alt="" /><span class="sp-ledge"></span></span>
                        <span class="sp-packet-name">Tulip seed</span>
                        <span class="sp-chip owned-chip">Free</span>
                      </article>
                    </div>
                    <div>
                      <article class="sp-packet picked">
                        <span class="sp-tape is-leaf"></span>
                        <span class="sp-packet-art">
                          <img class="c-pink" :src="foliageUrl('hyacinth-pink-4')" alt="" /><img class="c-red" :src="foliageUrl('hyacinth-red-4')" alt="" /><img class="c-purple" :src="foliageUrl('hyacinth-purple-4')" alt="" />
                          <span class="sp-ledge"></span>
                        </span>
                        <span class="sp-packet-name">Hyacinth seed</span>
                        <span class="sp-chip owned-chip">Owned</span>
                        <div class="mini-drawer">
                          <p class="swatch-label">Petal colour · <span class="word"><span class="c-red">red</span><span class="c-purple">purple</span></span></p>
                          <div class="sp-swatches"><i class="sp-swatch red"></i><i class="sp-swatch purple"></i><i class="sp-swatch yellow"></i><i class="sp-swatch pink"></i></div>
                          <p class="drag-hint">← Drag the flower to the field</p>
                        </div>
                      </article>
                    </div>
                  </div>
                </div>
                <div class="bed plant-bed">
                  <span class="spot"></span><span class="puff"></span>
                  <img class="grow seed" :src="foliageUrl('seed')" alt="" />
                </div>
                <div class="drag"><img :src="foliageUrl('seed')" alt="" /><SproutIcon class="cursor" glyph="pointer" :size="32" /></div>
              </div>
            </div>
            <!-- 5 review -->
            <div v-else-if="i === 4" key="a4" class="art a-seeds">
              <div class="seeds-art">
                <!-- mini "Choose a goal" pop-up (same look as SeedReviewView) -->
                <div class="goal-mini">
                  <div class="goal-dialog">
                    <h2 class="goal-title">Choose a goal for this session</h2>
                    <p class="goal-sub">Statistics · 12 cards · Mastery 40%</p>
                    <span class="goal-option pick"><span class="goal-icon"><SproutIcon name="flashcard" :size="34" /></span><span class="goal-text"><span class="goal-name">Flashcard Mode</span><span class="goal-sub">Flip through up to 20 flashcards.</span></span></span>
                    <span class="goal-option"><span class="goal-icon">🎯</span><span class="goal-text"><span class="goal-name">Multiple Choice Quiz</span><span class="goal-sub">Up to 10 quick multiple-choice questions.</span></span></span>
                    <span class="goal-option"><span class="goal-icon">✍️</span><span class="goal-text"><span class="goal-name">Short Structured Mode</span><span class="goal-sub">Think you've mastered 'em all? Try this out</span></span></span>
                  </div>
                </div>
                <div class="bed"><img class="s" :src="foliageUrl('sprout')" alt="" /><img :src="foliageUrl('tulip-3')" alt="" /><img :src="foliageUrl('tulip-red-4')" alt="" /></div>
                <img class="tap-can" :src="canArt" alt="" />
              </div>
            </div>
            <!-- 6 you -->
            <div v-else-if="i === 5" key="a5" class="art a-you">
              <div class="you-art">
                <span class="hours">{{ answers.hours }} h / week</span>
                <img :key="answers.flower" class="flower" :src="flowerUrl" alt="" :style="{ transform: `scale(${0.55 + (Math.min(answers.hours, 30) / 30) * 0.6})` }" />
              </div>
              <!-- sized like the round backdrop, so the arrows sit at its sides however tall the tulip grows -->
              <div class="flower-carousel" @pointerdown.stop @keydown.left.prevent="stepFlower(-1)" @keydown.right.prevent="stepFlower(1)">
                <button class="fc-btn prev" type="button" data-testid="flower-prev" @click="stepFlower(-1)"><SproutIcon glyph="chevron-left" :size="30" /></button>
                <button class="fc-btn next" type="button" data-testid="flower-next" @click="stepFlower(1)"><SproutIcon glyph="chevron-right" :size="30" /></button>
              </div>
            </div>
            <!-- 7 ready -->
            <div v-else key="a6" class="art a-ready">
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
              <p>Short focus rounds with breaks in between, like 25 minutes on and 5 off. Night falls over the meadow while you work.</p>
              <ul class="points"><li>Earn coins for every focus round you finish.</li><li>Keep a small to-do list for the session.</li><li>Play Garden Radio: calm lo-fi picked to match the weather.</li></ul>
            </div>
            <div v-else-if="i === 3" key="s3" class="slide">
              <span class="sp-eyebrow">Planting</span>
              <h1>Plant your <em>first seed</em></h1>
              <p>Each seed holds the flashcards for one topic. Open the shed in your garden, choose a seed from the Seeds tab and plant it in the garden.</p>
              <ul class="points"><li>Tap a seed packet, pick a colour, then drag it onto any free spot in the garden.</li><li>On a phone, press and hold the seed packet for a moment before dragging.</li><li>Then type your cards, or upload your notes and let AI write them for you.</li></ul>
            </div>
            <div v-else-if="i === 4" key="s4" class="slide">
              <span class="sp-eyebrow">Reviewing</span>
              <h1>Review to help it <em>grow</em></h1>
              <p>Click a seed or flower in your garden to review its content. Review it when it's due and it grows from sprout to flower by your exam date.</p>
              <ul class="points"><li>Pick Flashcard Mode, a Multiple Choice Quiz or Short Structured Mode.</li><li>Forget to water a seed and it starts to wilt.</li><li>After the exam, you have the choice to keep your flower on a collection shelf.</li></ul>
            </div>
            <div v-else-if="i === 5" key="s5" class="slide form-slide">
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
              <div class="q"><label class="sp-label" for="ob-name">What should we call you?</label>
                <input id="ob-name" ref="nameInput" v-model="answers.name" class="sp-input" :class="{ 'is-invalid': nameMissing }" maxlength="24"
                  placeholder="e.g. Mia" autocomplete="given-name" required :aria-invalid="nameMissing"
                  :aria-describedby="nameMissing ? 'ob-name-err' : undefined" data-testid="onboarding-name" />
                <p v-if="nameMissing" id="ob-name-err" class="status-err" role="alert">Please enter a name to continue.</p>
              </div>
            </div>
            <div v-else key="s6" class="slide">
              <span class="sp-eyebrow">All set</span>
              <h1>{{ answers.name.trim() ? `${answers.name.trim()}, your` : 'Your' }} garden is <em>ready</em></h1>
              <div class="summary">
                <span>Studying for <b>{{ answers.goal || 'your exams' }}</b></span>
                <span>About <b>{{ answers.hours }} hours</b> a week · try {{ blocksPerDay }} focus round{{ blocksPerDay === 1 ? '' : 's' }} a day</span>
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
/* art 5 */
.seeds-art { position: relative; width: min(420px, 96%); height: 300px; }
/* mini goal pop-up: SeedReviewView's dialog at full size, shrunk to fit */
.goal-mini { position: absolute; z-index: 3; left: 50%; top: -14px; width: 440px; transform: translateX(-50%) scale(.56); transform-origin: top center; }
.goal-dialog { display: flex; flex-direction: column; gap: 16px; padding: 24px; border-radius: 1rem; background: var(--paper); box-shadow: var(--shadow-2); opacity: 0; animation: goal-open 5s var(--spring) infinite; }
.goal-title { margin: 0; text-align: center; font-family: var(--f-display); font-weight: 600; font-size: 1.75rem; line-height: 1.3; letter-spacing: -.01em; }
.goal-sub { margin: 0; font-size: 14px; line-height: 22px; color: var(--ink-soft); }
.goal-dialog > .goal-sub { margin-top: -12px; text-align: center; }
.goal-option { display: flex; align-items: center; gap: 16px; padding: 16px 20px; border: 2px solid var(--line); border-radius: 16px; background: var(--paper); color: var(--ink); box-shadow: 0 4px 0 var(--line); }
.goal-option.pick { animation: goal-pick 5s ease infinite; }
.goal-icon { display: grid; place-items: center; flex: 0 0 48px; height: 48px; border-radius: 12px; background: var(--sheet); font-size: 24px; }
.goal-text { display: flex; flex-direction: column; }
.goal-name { font-family: var(--f-body); font-weight: 600; font-size: 1.05rem; line-height: 1.4; }
@keyframes goal-open { 0%, 24% { opacity: 0; transform: translateY(24px) scale(.94); } 30%, 88% { opacity: 1; transform: none; } 94%, 100% { opacity: 0; transform: translateY(10px); } }
@keyframes goal-pick { 0%, 46%, 84%, 100% { transform: none; } 52%, 80% { transform: translateY(-2px); border-color: var(--peach); box-shadow: 0 6px 0 var(--peach); } }
.bed { position: absolute; left: 0; right: 0; bottom: 0; height: 120px; border-radius: 50% 50% 18px 18px / 30% 30% 18px 18px; background: linear-gradient(#8a5a3f, #6e4532); display: flex; justify-content: space-around; align-items: flex-end; padding: 0 20px 34px; }
.bed img { width: 80px; height: 80px; margin-bottom: -6px; animation: pop-in .6s var(--spring) both; }
.bed img.s { transform: scale(1.7); transform-origin: 50% 90%; animation-name: pop-in-s; }
.bed img:nth-child(2) { animation-delay: .25s; } .bed img:nth-child(3) { animation-delay: .5s; }
@keyframes pop-in { from { transform: scale(0); } }
@keyframes pop-in-s { from { transform: scale(0); } to { transform: scale(1.7); } }
/* cursor (plant) */
.cursor { color: var(--sheet); filter: drop-shadow(0 0 1px var(--ink)) drop-shadow(0 0 1px var(--ink)) drop-shadow(0 3px 3px rgba(74, 54, 46, .4)); }
/* watering can (the garden's Study cursor) glides onto the middle plant and clicks it, then the pop-up opens */
.tap-can { position: absolute; z-index: 2; left: calc(50% - 4px); bottom: 60px; width: 52px; height: auto; transform-origin: 10% 40%; filter: drop-shadow(0 3px 3px rgba(74, 54, 46, .3)); animation: tap-can 5s ease-in-out infinite; }
@keyframes tap-can { 0% { transform: translate(70px, 30px); opacity: 0; } 4% { opacity: 1; } 14%, 19% { transform: none; } 21% { transform: scale(.85); } 23% { transform: none; opacity: 1; } 30%, 100% { transform: none; opacity: 0; } }
/* art 4: tap packet → pick purple → drag straight to the soil → planted as a seed (6.5s loop) */
.plant-art { position: relative; width: min(420px, 96%); height: 300px; }
.shed-mini { position: absolute; left: 0; top: -6px; width: 360px; transform: scale(.52); transform-origin: top left; }
.shed-mini .sp-packet-grid { padding-top: 0; }
.shed-mini .sp-packet { transition: none; }
.owned-chip { padding: .1em .7em; font-size: .72rem; background: var(--leaf-soft); border-color: var(--leaf); color: var(--leaf-deep); }
.sp-packet-art img { grid-area: 1 / 1; }
.picked { animation: plant-pick 6.5s ease infinite; }
.picked .c-red, .picked .c-purple { opacity: 0; }
.picked img.c-pink { animation: plant-c-pink 6.5s ease infinite; }
.picked .c-red { animation: plant-c-red 6.5s ease infinite; }
.picked .c-purple { animation: plant-c-purple 6.5s ease infinite; }
.swatch-label .word { display: inline-grid; } .swatch-label .word > span { grid-area: 1 / 1; }
/* colour drawer */
.mini-drawer { display: grid; justify-items: center; width: 100%; height: 0; overflow: hidden; opacity: 0; animation: plant-drawer 6.5s ease infinite; }
.swatch-label { position: relative; margin: 8px 0; font-family: var(--f-hand); font-size: 1.15rem; line-height: 1; color: var(--ink-soft); }
.drag-hint { margin: 10px 0 2px; font-family: var(--f-hand); font-size: 1.1rem; line-height: 1; color: var(--berry-deep); }
.sp-swatch.red { --sw: var(--berry); }
.sp-swatch.purple { --sw: var(--lilac); }
.sp-swatch.yellow { --sw: var(--butter); }
.sp-swatch.pink { --sw: var(--margin); }
.mini-drawer .sp-swatch.red { animation: plant-sw-red 6.5s ease infinite; }
.mini-drawer .sp-swatch.purple { animation: plant-sw-purple 6.5s ease infinite; }
.plant-bed { height: 110px; }
.spot, .puff { position: absolute; left: 70%; top: 26px; width: 74px; height: 30px; margin-left: -37px; border-radius: 50%; opacity: 0; }
.spot { border: 2px dashed var(--butter); animation: plant-spot 6.5s ease-in-out infinite; }
.puff { border: 3px dotted var(--sheet-3); animation: plant-puff 6.5s ease-out infinite; }
.plant-bed img.grow { position: absolute; left: 70%; top: -24px; width: 70px; height: 70px; margin: 0 0 0 -35px; transform: scale(0); transform-origin: 50% 90%; }
.plant-bed img.seed { animation: plant-seed 6.5s var(--spring) infinite; }
.drag { position: absolute; z-index: 2; left: 0; top: 0; width: 62px; animation: plant-drag 6.5s ease-in-out infinite; }
.drag img { display: block; height: 62px; width: auto; margin: 0 auto; opacity: 0; transform: scale(1.6); transform-origin: 50% 90%; animation: plant-carry 6.5s ease-in-out infinite; } /* see-through seed, like the garden's drag ghost */
.drag .cursor { position: absolute; right: 2px; bottom: 0; }
@keyframes plant-drag {
  0% { transform: translate(150px, 150px); opacity: 0; }
  6% { opacity: 1; }
  12%, 18% { transform: translate(111px, 11px); }
  15% { transform: translate(111px, 11px) scale(.92); }
  25%, 30% { transform: translate(98px, 109px); }
  27% { transform: translate(98px, 109px) scale(.92); }
  36% { transform: translate(111px, 11px); }
  58% { transform: translate(263px, 170px); opacity: 1; }
  64%, 100% { transform: translate(263px, 174px); opacity: 0; }
}
@keyframes plant-carry { 0%, 35% { opacity: 0; } 37%, 58% { opacity: .6; } 61%, 100% { opacity: 0; } }
@keyframes plant-pick { 0%, 14%, 94%, 100% { transform: rotate(var(--r, 0deg)); } 16%, 90% { transform: translateY(-3px) rotate(0deg); box-shadow: 0 0 0 3px var(--berry-soft), var(--shadow-2); } }
@keyframes plant-drawer { 0%, 15%, 92%, 100% { height: 0; opacity: 0; } 20%, 88% { height: 108px; opacity: 1; } }
@keyframes plant-c-pink { 0%, 15% { opacity: 1; } 16%, 94% { opacity: 0; } 97%, 100% { opacity: 1; } }
@keyframes plant-c-red { 0%, 15% { opacity: 0; } 16%, 27% { opacity: 1; } 28%, 100% { opacity: 0; } }
@keyframes plant-c-purple { 0%, 27% { opacity: 0; } 28%, 94% { opacity: 1; } 97%, 100% { opacity: 0; } }
@keyframes plant-sw-red { 0%, 27%, 100% { box-shadow: 0 0 0 2.5px var(--ink); transform: scale(1.15) translateY(-2px); } 28%, 99% { box-shadow: 0 0 0 1.5px var(--line); transform: none; } }
@keyframes plant-sw-purple { 0%, 27%, 100% { box-shadow: 0 0 0 1.5px var(--line); transform: none; } 28%, 99% { box-shadow: 0 0 0 2.5px var(--ink); transform: scale(1.15) translateY(-2px); } }
@keyframes plant-spot { 0%, 35% { opacity: 0; } 40%, 58% { opacity: 1; } 63%, 100% { opacity: 0; } }
@keyframes plant-puff { 0%, 57% { opacity: 0; transform: scale(.4); } 60% { opacity: 1; } 70%, 100% { opacity: 0; transform: scale(1.7); } }
/* stays a seed (it grows on the Review step) */
@keyframes plant-seed { 0% { transform: scale(1.7); } 6%, 59% { transform: scale(0); } 64%, 100% { transform: scale(1.7); } }
/* art 6 */
.you-art { position: relative; width: min(300px, 80%); display: grid; place-items: end center; height: 340px; }
.you-art .flower { position: absolute; bottom: 0; height: 330px; width: auto; transform-origin: 50% 100%; transition: transform .6s var(--spring); animation: pop-in .5s var(--spring); }
.you-art .hours { position: absolute; top: 10px; left: -30px; z-index: 2; font-family: var(--f-hand); font-size: 1.6rem; color: var(--ink); transform: rotate(6deg); background: var(--butter-soft); padding: 4px 12px; border-radius: 10px; box-shadow: var(--shadow-1); }
.q { display: grid; gap: 8px; }
.range { width: 100%; accent-color: var(--leaf); }
.range-row { display: flex; gap: 12px; align-items: center; }
.range-row output { font-family: var(--f-hand); font-size: 1.5rem; min-width: 5ch; }
.flower-carousel { position: absolute; z-index: 2; width: min(400px, 92%); aspect-ratio: 1; pointer-events: none; }
.fc-btn { position: absolute; top: 50%; width: 44px; height: 44px; margin-top: -22px; padding: 0; border: 0; background: none; color: var(--ink); opacity: .45; display: grid; place-items: center; pointer-events: auto; transition: opacity .2s, transform .2s var(--spring); }
.fc-btn.prev { left: 2%; }
.fc-btn.next { right: 2%; }
.fc-btn:hover, .fc-btn:focus-visible { opacity: 1; }
.fc-btn.prev:hover { transform: translateX(-3px); }
.fc-btn.next:hover { transform: translateX(3px); }
.form-slide { gap: 12px; }
/* art 7 */
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
  .flower-carousel { width: 250px; }
  .orbit img { height: 76px; }
  .avatar-slot { height: 230px; }
  .guide-slot { width: 70px; height: 96px; }
  .ready-slot { height: 52%; }
  .orbit { width: 270px; }
  .mini-book { width: 300px; }
  .focus-art { width: 220px; }
  .seeds-art, .plant-art { transform: scale(.78); transform-origin: top center; }
  .plant-art, .seeds-art { margin-top: 14px; } /* room for the packets' tape and the pop-up */
  .you-art { transform: scale(.55); transform-origin: bottom center; height: 260px; }
  .ready-art { transform: scale(.62); transform-origin: bottom center; }
  .slide-art { overflow: hidden; }
  .ob-foot { flex-wrap: wrap; padding: 12px 18px 18px; gap: 10px; }
  .hint { display: none; }
  .sp-thumbs { width: 100%; justify-content: space-between; }
  /* thumbnails share the row */
  .sp-thumbs { gap: 4px; }
  .sp-thumb { flex: 1 1 0; min-width: 0; max-width: 46px; width: auto; height: auto; aspect-ratio: 1; padding: 2px; }
  .sp-thumb img { width: 100%; height: auto; }
  .nav-btns { width: 100%; }
  .nav-btns .sp-btn:last-child { flex: 1; }
}
</style>
