<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import SceneryBackdrop from '@/components/SceneryBackdrop.vue'
import SproutIcon from '@/components/SproutIcon.vue'
import { foliageUrl } from '@/lib/plantSprites'
import { vBurst } from '@/lib/burst'
import potArt from '@/assets/ui/pot.svg'
import plannerArt from '@/assets/ui/planner.svg'
import focusArt from '@/assets/ui/focus.svg'
import coinArt from '@/assets/ui/coin.svg'

// Public landing page (journal look). Static content; "Start growing" goes to sign-up, "Log in" to log-in.
// Signed-in users never land here: the router guard sends them to the garden (or onboarding).
const narrow = typeof window !== 'undefined' && window.innerWidth < 700
const signup = { name: 'auth', query: { mode: 'signup' } }
const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

/* hero: mini calendar + ticking timer + parallax fan of cards */
const heroCal = Array.from({ length: 35 }, (_, k) => k - 2)
const ht = ref(18 * 60 + 42)
const heroTime = computed(() => `${String(Math.floor(ht.value / 60)).padStart(2, '0')}:${String(ht.value % 60).padStart(2, '0')}`)
const stack = ref(null)
const fan = ref(false)
const tilt = ref({ x: 0, y: 0 })
const canHover = typeof window !== 'undefined' && matchMedia('(hover: hover)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches
function onStackMove(e) {
  if (!canHover) return
  const r = stack.value.getBoundingClientRect()
  tilt.value = { x: (e.clientX - r.left) / r.width - 0.5, y: (e.clientY - r.top) / r.height - 0.5 }
}
const shift = (d) => ({ translate: `${tilt.value.x * d}px ${tilt.value.y * d}px` })

/* feature showcase (pill menu + stage, like the cake-shop reference) */
const FEATURES = [
  { name: 'Planner', icon: plannerArt, eyebrow: 'Plan', title: 'Open-book planner', spec: 'Left page: to-do · Right page: calendar',
    text: 'A real two-page planner. Your tasks sit on the left, the month sits on the right, and both pages follow the day you pick.', chips: ['Page-turn months', 'Washi tape', 'Ribbon bookmark'], viz: 'book' },
  { name: 'To-do list', icon: foliageUrl('sprout'), small: true, eyebrow: 'Tasks', title: 'A to-do list that grows', spec: 'Subjects · Due dates · Priorities',
    text: "Write tasks by subject, star the important ones and tick them off with an ink stroke. The day's sprout grows as you go.", chips: ['Double-click to edit', 'Upcoming view', 'Stars for priorities'], viz: 'list' },
  { name: 'Focus timer', icon: focusArt, eyebrow: 'Focus', title: 'Focus in short blocks', spec: 'Your own rhythm · 25/5 classic · 50/10 deep work',
    text: 'Set your focus and break, a topic and a length. The ring counts down with break ideas ready when you need them.', chips: ['Pause & resume', 'Break ideas', 'Earn coins per block'], viz: 'ring' },
  { name: 'Memory seeds', icon: foliageUrl('tulip-pink-3'), eyebrow: 'Remember', title: 'Memory seeds', spec: 'Flashcards · Quizzes · Exam dates',
    text: 'Plant a seed for a topic with cards from your notes. Review it on time and it grows; leave it too long and it wilts. After the exam, it goes on your shelf.', chips: ['Multiple choice quizzes', 'Flashcards', 'Flower shelf'], viz: 'flash' },
  { name: 'Garden Radio', icon: potArt, eyebrow: 'Listen', title: 'Garden Radio', spec: 'Calm lo-fi, matched to the weather',
    text: 'Quiet music for studying that follows the sky: bright tracks on sunny days, softer ones when it rains.', chips: ['Weather-matched', 'Volume control', 'CC0 music'], viz: 'vinyl' },
  { name: 'Streaks & coins', icon: coinArt, eyebrow: 'Rewards', title: 'Streaks and coins', spec: 'Daily streak · Coins',
    text: 'Come back each day to grow your streak. Finishing focus blocks and quizzes earns coins to spend on new seeds in the garden shop.', chips: ['Daily streak', 'Garden shop'], viz: 'coins' },
]
const fi = ref(0)
const feature = computed(() => FEATURES[fi.value])
const show = (n) => { fi.value = (n + FEATURES.length) % FEATURES.length }
let sx = null
const vizDown = (e) => { sx = e.clientX }
const vizUp = (e) => { if (sx !== null && Math.abs(e.clientX - sx) > 40) show(fi.value + (e.clientX < sx ? 1 : -1)); sx = null }


/* 20-second focus demo */
const mt = ref({ left: 20, running: false, note: 'a real block is 25 minutes' })
let mtTimer = null
const mtStage = computed(() => { const p = 1 - mt.value.left / 20; return p < .33 ? 'seed' : p < .66 ? 'sprout' : p < 1 ? 'tulip-3' : 'tulip-yellow-4' })
function toggleDemo() {
  if (mt.value.running) { clearInterval(mtTimer); mt.value = { ...mt.value, running: false }; return }
  const end = Date.now() + 20000
  mt.value = { left: 20, running: true, note: 'a real block is 25 minutes' }
  mtTimer = setInterval(() => {
    const left = Math.max(0, (end - Date.now()) / 1000)
    mt.value.left = left
    if (left <= 0) { clearInterval(mtTimer); mt.value = { left: 0, running: false, note: 'In the app, that block would earn 10 coins.' } }
  }, 100)
}

let heroTimer = null
onMounted(() => {
  heroTimer = setInterval(() => { ht.value = ht.value <= 0 ? 25 * 60 : ht.value - 1 }, 1000)
})
onBeforeUnmount(() => { clearInterval(heroTimer); clearInterval(mtTimer) })
</script>

<template>
  <div class="landing">
    <header class="site-head">
      <div class="head-inner">
        <RouterLink class="brand" :to="{ name: 'landing' }" aria-label="Sproutly home">
          <img :src="potArt" alt="" width="38" height="38" />
          <span><span class="brand-name">Sproutly</span><span class="brand-sub">study garden &amp; planner</span></span>
        </RouterLink>
        <ul class="navlinks">
          <li><button type="button" @click="scrollTo('about')">About</button></li>
          <li><button type="button" @click="scrollTo('features')">Features</button></li>
          <li><button type="button" @click="scrollTo('focus')">Focus</button></li>
          <li><button type="button" @click="scrollTo('how')">How it works</button></li>
        </ul>
        <div class="bar-right">
          <RouterLink class="sp-btn sp-btn-ghost sp-btn-sm login-link" :to="{ name: 'auth' }">Log in</RouterLink>
          <RouterLink v-burst class="sp-btn sp-btn-sm" :to="signup" data-testid="start-growing">Start growing</RouterLink>
        </div>
      </div>
    </header>

    <main>
      <!-- HERO -->
      <section class="hero" aria-labelledby="hero-title">
        <SceneryBackdrop :page="false" mood="day" :options="{ seed: 3, horizon: narrow ? 0.78 : 0.66, petals: 10, butterflies: 3, clearCenter: true }" />
        <div class="wrap hero-grid">
          <div class="hero-copy">
            <span class="sp-eyebrow">Study planner · Focus garden</span>
            <h1 id="hero-title"><span class="sp-hand">good habits grow here</span>Study a little. <em>Grow</em> a lot.</h1>
            <p class="sp-lede">Sproutly is a cozy study space. Plan your days in an open-book planner, focus in short blocks, and turn revision into a garden that blooms before your exams.</p>
            <div class="cta-row">
              <RouterLink v-burst class="sp-btn" :to="signup">Start growing <span class="arrow">→</span></RouterLink>
              <button class="sp-btn sp-btn-ghost" type="button" @click="scrollTo('features')">See the garden tools</button>
            </div>
            <div class="proof">
              <span><img :src="plannerArt" alt="" />To-do + calendar</span>
              <span><img :src="focusArt" alt="" />Focus blocks</span>
              <span><img :src="coinArt" alt="" />Coins &amp; streaks</span>
            </div>
          </div>
          <div ref="stack" class="stack" :class="{ fan }" aria-label="Preview of Sproutly screens" @mousemove="onStackMove" @mouseleave="tilt = { x: 0, y: 0 }" @click="!canHover && (fan = !fan)">
            <div class="pcard c-focus" :style="shift(28)">
              <div class="ring-mini">
                <svg viewBox="0 0 180 180"><circle cx="90" cy="90" r="80" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="8" /><circle cx="90" cy="90" r="80" fill="none" stroke="#F7CD5D" stroke-width="8" stroke-linecap="round" stroke-dasharray="503" :stroke-dashoffset="503 * ht / 1500" /></svg>
                <b>{{ heroTime }}</b>
                <img :src="foliageUrl('tulip-3')" alt="" />
              </div>
            </div>
            <div class="pcard c-planner" :style="shift(12)">
              <div class="pc-date">Friday<small>TO-DO · 23 OCTOBER</small></div>
              <ul class="pc-tasks">
                <li class="d"><i></i><span>Calculus problem set</span></li>
                <li><i></i><span>Statistics flashcards</span></li>
                <li><i></i><span>WAD lab: Vue router</span></li>
                <li><i></i><span>Water 5 seeds</span></li>
              </ul>
              <img class="pc-sprout" :src="foliageUrl('tulip-3')" alt="" />
            </div>
            <div class="pcard c-garden" :style="shift(18)">
              <div class="polaroid"><img :src="foliageUrl('tulip-yellow-4')" alt="" /><img :src="foliageUrl('tulip-pink-4')" alt="" /><img :src="foliageUrl('tulip-purple-4')" alt="" /></div>
              <div class="pol-cap">Statistics · in bloom</div>
            </div>
            <div class="pcard c-cal" :style="shift(22)">
              <div class="pc-cal-h">October</div>
              <div class="pc-grid"><span v-for="d in heroCal" :key="d" :class="{ t: d === 23, h: d === 16, x: d === 31 }">{{ d > 0 && d < 32 ? d : '' }}</span></div>
            </div>
            <div class="anno a1"><svg viewBox="0 0 60 40" aria-hidden="true"><path d="M4 30C18 34 34 30 44 14M44 14l-9 2M44 14l1 9" fill="none" stroke="#4A362E" stroke-width="2" stroke-linecap="round" /></svg>your whole week, one book</div>
          </div>
        </div>
      </section>

      <!-- ABOUT -->
      <section id="about" class="paper-sec sec" aria-labelledby="about-title">
        <div class="wrap about-grid">
          <div class="sec-head" style="margin: 0">
            <span class="sp-eyebrow">Why Sproutly</span>
            <h2 id="about-title">Revision is easier when you can <em>see it growing</em></h2>
            <p class="sp-lede">Students juggle tasks in one app, dates in another and flashcards somewhere else, then lose track of what they've done. Sproutly puts it all in one calm place and makes progress visible, one sprout at a time.</p>
          </div>
          <div class="notes">
            <article class="note"><span class="sp-tape" aria-hidden="true"></span><span class="was">Tasks scattered across apps and sticky notes</span><span class="now">One planner for tasks and dates</span><p>A to-do list and a month calendar on facing pages. Pick a day and see what's due.</p></article>
            <article class="note"><span class="sp-tape is-leaf" aria-hidden="true"></span><span class="was">Hours of study with nothing to show</span><span class="now">Every focus block earns coins</span><p>A focus timer with breaks built in. Finish a block, earn coins, grow your garden.</p></article>
            <article class="note"><span class="sp-tape is-butter" aria-hidden="true"></span><span class="was">Cramming the night before</span><span class="now">Memory seeds remind you to review</span><p>Flashcards from your notes, timed to your exam. Skip a review and the seed wilts.</p></article>
          </div>
        </div>
      </section>

      <!-- FEATURES -->
      <section id="features" class="sec" aria-labelledby="feat-title" style="background: var(--sheet)">
        <div class="wrap">
          <div class="sec-head">
            <p class="script-title" aria-hidden="true">Our <em>garden tools</em></p>
            <h2 id="feat-title" class="sr-only">Features</h2>
            <p class="sp-lede">Everything a student needs to plan, focus and remember, in one place.</p>
          </div>
          <div class="showcase">
            <div class="tools sp-menu" role="tablist" aria-label="Features">
              <button v-for="(f, k) in FEATURES" :key="f.name" class="sp-menu-btn" role="tab" type="button" :aria-selected="k === fi" @click="show(k)">
                <span class="mi"><img :class="{ s: f.small }" :src="f.icon" alt="" /></span>{{ f.name }}
              </button>
            </div>
            <div class="stage-card">
              <div class="viz" @pointerdown="vizDown" @pointerup="vizUp">
                <span class="sp-plate"></span>
                <div :key="fi" class="v">
                  <div v-if="feature.viz === 'book'" class="v-book"><div><b>Today</b></div><div></div></div>
                  <div v-else-if="feature.viz === 'list'" class="v-list"><div class="d"><i></i><span>Calculus problem set</span></div><div><i></i><span>Statistics flashcards</span><span class="st">★</span></div><div><i></i><span>UI/UX usability notes</span></div><div><i></i><span>Finance NPV questions</span></div></div>
                  <div v-else-if="feature.viz === 'ring'" class="v-ring"><svg viewBox="0 0 232 232" width="232" height="232"><circle cx="116" cy="116" r="104" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="9" /><circle cx="116" cy="116" r="104" fill="none" stroke="#F7CD5D" stroke-width="9" stroke-linecap="round" stroke-dasharray="653" stroke-dashoffset="230" /></svg><b>16:20</b><img :src="foliageUrl('tulip-3')" alt="" /></div>
                  <div v-else-if="feature.viz === 'flash'" class="v-flash-wrap"><div class="v-flash"><div><small>STATISTICS · SEED 3</small>What is a p-value?</div></div><div class="v-flash"></div></div>
                  <div v-else-if="feature.viz === 'vinyl'" class="v-vinyl"></div>
                  <div v-else class="v-coins"><span class="v-counter"><SproutIcon name="flame" :size="30" />12</span><span class="v-counter"><img :src="coinArt" alt="" />1,250</span></div>
                </div>
              </div>
              <div :key="`i${fi}`" class="info" aria-live="polite">
                <span class="sp-eyebrow">{{ feature.eyebrow }}</span>
                <h3>{{ feature.title }}</h3>
                <span class="spec">{{ feature.spec }}</span>
                <p>{{ feature.text }}</p>
                <div style="display: flex; gap: 8px; flex-wrap: wrap"><span v-for="c in feature.chips" :key="c" class="sp-chip">{{ c }}</span></div>
              </div>
              <div class="strip" role="tablist" aria-label="Features">
                <button v-for="(f, k) in FEATURES" :key="f.name" class="sp-thumb" role="tab" type="button" :aria-label="f.name" :aria-selected="k === fi" @click="show(k)"><img :class="{ s: f.small }" :src="f.icon" alt="" /></button>
                <span class="hint">tap a tool, or swipe the picture</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- FOCUS -->
      <section id="focus" class="night" aria-labelledby="focus-title">
        <SceneryBackdrop :page="false" mood="night" :options="{ seed: 41, horizon: narrow ? 0.86 : 0.7, butterflies: 0, tulips: narrow ? 2 : 6, sunX: narrow ? 92 : 84, sunY: narrow ? 3 : 18 }" />
        <div class="wrap night-grid">
          <div>
            <span class="sp-eyebrow">Focus mode</span>
            <h2 id="focus-title" style="margin-top: 10px">The garden goes quiet. <em>You get to work.</em></h2>
            <p class="sp-lede" style="margin-top: 14px">Set your own focus and break, or pick 25 on and 5 off. While you focus, night falls over the meadow and the fireflies come out. On a break, the sun comes back.</p>
            <ul class="feat-list">
              <li><img :src="focusArt" alt="" />Your own rhythm, classic or deep work</li>
              <li><img :src="coinArt" alt="" />+ coins for every block you finish</li>
              <li><img :src="plannerArt" alt="" />"Focus on this" straight from your planner</li>
            </ul>
          </div>
          <div class="mini-timer">
            <div class="mt-ring" role="timer" aria-label="Demo focus timer">
              <svg viewBox="0 0 200 200"><circle class="trk" cx="100" cy="100" r="92" /><circle class="fil" cx="100" cy="100" r="92" stroke-dasharray="578" :stroke-dashoffset="578 * (mt.left / 20)" /></svg>
              <div class="mt-time">00:{{ String(Math.ceil(mt.left)).padStart(2, '0') }}</div>
              <img :key="mtStage" :class="{ s: mtStage === 'seed' || mtStage === 'sprout' }" :src="foliageUrl(mtStage)" alt="" />
            </div>
            <button v-burst class="sp-btn sp-btn-butter" type="button" @click="toggleDemo">{{ mt.running ? 'Stop' : mt.left === 0 ? 'Grow another' : 'Try a 20-second focus' }}</button>
            <span class="mt-note">{{ mt.note }}</span>
          </div>
        </div>
      </section>

      <!-- HOW -->
      <section id="how" class="paper-sec sec" aria-labelledby="how-title">
        <div class="wrap">
          <div class="sec-head center">
            <span class="sp-eyebrow">How it works</span>
            <h2 id="how-title">From seed to <em>bloom</em> in three steps</h2>
          </div>
          <div class="how">
            <svg class="vine" viewBox="0 0 1000 60" preserveAspectRatio="none" aria-hidden="true"><path d="M0 30 C120 0 220 60 340 30 S560 0 660 30 880 60 1000 30" /></svg>
            <div class="how-step"><div class="how-art"><span class="n">one</span><img class="s" :src="foliageUrl('seed')" alt="" /></div><h3>Plant</h3><p>Add your subjects and exam dates, and plant a seed of flashcards for each topic.</p></div>
            <div class="how-step"><div class="how-art"><span class="n">two</span><img class="s" :src="foliageUrl('sprout')" alt="" /></div><h3>Tend</h3><p>Tick off tasks, run focus blocks and review memory seeds when they're due.</p></div>
            <div class="how-step"><div class="how-art"><span class="n">three</span><img :src="foliageUrl('tulip-pink-4')" alt="" /></div><h3>Bloom</h3><p>By exam day your garden is full, and each flower is a topic you know.</p></div>
          </div>
        </div>
      </section>

      <!-- CTA -->
      <section class="sec" style="background: var(--sheet); padding-top: 0" aria-labelledby="cta-title">
        <div class="wrap">
          <div class="cta">
            <SceneryBackdrop :page="false" mood="blush" :options="{ seed: 17, horizon: 0.72, tulips: 0, butterflies: 2, clouds: 3, sunX: 70, sunY: 26 }" />
            <span class="sp-eyebrow">Free for students</span>
            <h2 id="cta-title">Your garden is <em>waiting</em></h2>
            <p class="sp-lede">Made for IGCSE, IB, A-Level and university students who want a calmer way to revise.</p>
            <div class="boards"><span class="sp-chip">IGCSE</span><span class="sp-chip">IB Diploma</span><span class="sp-chip">A-Levels</span><span class="sp-chip">University</span></div>
            <div class="cta-row">
              <RouterLink v-burst class="sp-btn" :to="signup">Create your garden <span class="arrow">→</span></RouterLink>
              <RouterLink class="sp-btn sp-btn-ghost" :to="{ name: 'auth' }">I already have one</RouterLink>
            </div>
            <img class="pot" :src="potArt" alt="" />
          </div>
        </div>
      </section>
    </main>

    <footer style="background: var(--sheet-2)">
      <div class="wrap">
        <div class="foot-grid">
          <div>
            <span class="brand"><img :src="potArt" alt="" width="38" height="38" /><span><span class="brand-name">Sproutly</span><span class="brand-sub">study garden &amp; planner</span></span></span>
            <p>A study planner and focus timer that turns revision into a garden.</p>
          </div>
          <div><h4>Get started</h4><ul><li><RouterLink :to="signup">Sign up</RouterLink></li><li><RouterLink :to="{ name: 'auth' }">Log in</RouterLink></li></ul></div>
          <div><h4>Explore</h4><ul><li><button type="button" @click="scrollTo('features')">Garden tools</button></li><li><button type="button" @click="scrollTo('focus')">Focus</button></li></ul></div>
          <div><h4>About</h4><ul><li><button type="button" @click="scrollTo('about')">Why Sproutly</button></li><li><button type="button" @click="scrollTo('how')">How it works</button></li></ul><p style="font-size: .8rem; margin-top: 12px">Built with Vue 3, Express and Supabase. Garden Radio music from open-lofi (CC0).</p></div>
        </div>
        <div class="foot-base"><span>© 2026 Sproutly. A student project.</span><span class="sp-hand">Study a little, grow a lot.</span></div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.landing { overflow-x: clip; }
.wrap { max-width: 1200px; margin: 0 auto; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
section { position: relative; }
.sec { padding-block: clamp(64px, 9vw, 120px); }
.sec-head { display: grid; gap: 12px; max-width: 640px; margin-bottom: clamp(30px, 4vw, 52px); }
.sec-head.center { margin-inline: auto; text-align: center; justify-items: center; }
.sec h2, .night h2, .cta h2 { font-size: clamp(1.9rem, 3.6vw, 2.9rem); line-height: 1.08; margin: 0; text-wrap: balance; }
.script-title { font-family: var(--f-hand); font-weight: 700; font-size: clamp(2.6rem, 5vw, 3.8rem); line-height: .9; color: var(--ink); margin: 0; }
.script-title em { font-style: normal; color: var(--berry); }

/* header */
.site-head { position: sticky; top: 0; z-index: 40; padding: 12px max(16px, env(safe-area-inset-right, 0px)) 0 max(16px, env(safe-area-inset-left, 0px)); }
.head-inner { max-width: 1200px; margin: 0 auto; display: flex; align-items: center; gap: 18px; padding: 8px 10px 8px 14px; border-radius: 999px; background: color-mix(in srgb, var(--sheet) 82%, transparent); backdrop-filter: blur(14px) saturate(1.2); -webkit-backdrop-filter: blur(14px) saturate(1.2); box-shadow: 0 1px 0 rgba(255,255,255,.7) inset, var(--shadow-1); }
.brand { display: inline-flex; align-items: center; gap: 10px; text-decoration: none; color: var(--ink); flex: none; }
.brand img { width: 38px; height: 38px; transition: transform .5s var(--spring); }
.brand:hover img { transform: rotate(-10deg) scale(1.08); }
.brand-name { font-family: var(--f-display); font-style: italic; font-weight: 600; font-size: 1.45rem; line-height: 1; display: block; }
.brand-sub { display: block; font-size: .6rem; font-weight: 800; letter-spacing: .2em; text-transform: uppercase; color: var(--ink-soft); margin-top: 3px; }
.navlinks { display: flex; gap: 4px; margin: 0 auto; padding: 0; list-style: none; }
.navlinks button { border: 0; background: none; padding: .45em .95em; border-radius: 999px; font-weight: 800; font-size: .78rem; letter-spacing: .1em; text-transform: uppercase; color: var(--ink-soft); transition: color .2s, background .2s; }
.navlinks button:hover { color: var(--ink); background: color-mix(in srgb, var(--sheet-2) 80%, transparent); }
.bar-right { display: flex; align-items: center; gap: 8px; flex: none; }
.bar-right .sp-btn { min-height: 40px; }
@media (max-width: 860px) { .navlinks { display: none; } .bar-right { margin-left: auto; } .login-link { display: none; } .brand-sub { display: none; } }

/* hero */
.hero { margin-top: -78px; padding-top: 78px; min-height: min(860px, 100vh); overflow: hidden; isolation: isolate; }
.hero-grid { position: relative; z-index: 1; display: grid; grid-template-columns: 1fr 1.05fr; align-items: center; gap: 30px; padding-block: clamp(36px, 7vw, 90px) clamp(160px, 18vw, 230px); }
.hero-copy { display: grid; gap: 20px; justify-items: start; position: relative; z-index: 2; }
.hero h1 { font-size: clamp(2.8rem, 6.6vw, 5.4rem); line-height: .98; text-shadow: 0 2px 0 rgba(255,255,255,.5); margin: 0; }
.hero h1 .sp-hand { display: block; font-size: .62em; font-weight: 700; color: var(--leaf-deep); margin-bottom: .1em; transform: rotate(-3deg); transform-origin: left; }
.hero .sp-lede { color: #5c483f; font-size: 1.15rem; }
.cta-row { display: flex; flex-wrap: wrap; gap: 12px; }
.proof { display: flex; flex-wrap: wrap; gap: 8px 20px; margin-top: 6px; }
.proof span { display: inline-flex; align-items: center; gap: 8px; font-weight: 800; font-size: .82rem; color: var(--ink); background: color-mix(in srgb, var(--sheet) 70%, transparent); padding: 6px 12px 6px 6px; border-radius: 999px; backdrop-filter: blur(6px); }
.proof img { width: 26px; height: 26px; }
.stack { position: relative; height: 520px; perspective: 1400px; z-index: 2; }
.pcard { position: absolute; border-radius: 20px; background: var(--sheet); box-shadow: var(--shadow-2); transition: transform .7s var(--spring), translate .4s ease, box-shadow .3s; overflow: hidden; }
.pcard::after { content: ""; position: absolute; inset: 0; background-image: var(--grain); opacity: .14; mix-blend-mode: multiply; pointer-events: none; }
.pcard.c-planner { width: 300px; height: 380px; left: 4%; top: 60px; transform: rotate(-8deg); padding: 22px 20px; background-image: linear-gradient(90deg, transparent 36px, var(--margin) 36px 37.5px, transparent 37.5px), repeating-linear-gradient(180deg, transparent 0 33px, var(--rule) 33px 34px); background-position: 0 70px; }
.pcard.c-focus { width: 250px; height: 270px; right: 4%; top: 10px; transform: rotate(7deg); background: radial-gradient(circle at 50% 110%, #2b3566, #0f1736 70%); color: #fdf3d6; display: grid; place-items: center; }
.pcard.c-cal { width: 260px; height: 245px; right: 2%; bottom: 40px; transform: rotate(-3deg); padding: 18px; }
.pcard.c-garden { width: 200px; height: 245px; left: 30%; bottom: -6px; transform: rotate(5deg); padding: 10px 10px 0; background: #fff; }
.stack:hover .c-planner, .stack.fan .c-planner { transform: rotate(-12deg) translate(-30px, 10px); }
.stack:hover .c-focus, .stack.fan .c-focus { transform: rotate(11deg) translate(30px, -16px); }
.stack:hover .c-cal, .stack.fan .c-cal { transform: rotate(2deg) translate(24px, 24px); }
.stack:hover .c-garden, .stack.fan .c-garden { transform: rotate(-3deg) translate(-10px, 26px); }
.pcard:hover { box-shadow: 0 30px 60px -20px rgba(74,54,46,.55); z-index: 5; }
.pc-date { font-family: var(--f-hand); font-size: 1.9rem; line-height: 1; padding-left: 26px; }
.pc-date small { display: block; font-family: var(--f-body); font-size: .62rem; font-weight: 800; letter-spacing: .16em; color: var(--ink-soft); margin-top: 6px; }
.pc-tasks { list-style: none; padding: 0 0 0 26px; margin: 18px 0 0; }
.pc-tasks li { height: 34px; display: flex; align-items: center; gap: 10px; font-family: var(--f-hand); font-size: 1.25rem; }
.pc-tasks i { width: 18px; height: 18px; border-radius: 50%; border: 1.6px solid var(--ink-faint); background: #fff; flex: none; position: relative; left: -32px; margin-right: -28px; }
.pc-tasks li.d i { background: var(--leaf); border-color: var(--leaf); box-shadow: inset 0 0 0 3px #fff; }
.pc-tasks li.d span { text-decoration: line-through; text-decoration-color: var(--berry-deep); color: var(--ink-faint); }
.pc-sprout { position: absolute; right: 14px; bottom: 6px; width: 90px; height: 90px; }
.ring-mini { position: relative; width: 180px; height: 180px; display: grid; place-items: center; }
.ring-mini svg { position: absolute; inset: 0; transform: rotate(-90deg); }
.ring-mini b { font-family: var(--f-display); font-size: 2.6rem; font-weight: 500; font-variant-numeric: tabular-nums; margin-top: -30px; }
.ring-mini img { position: absolute; bottom: 22px; height: 64px; }
.pc-cal-h { font-family: var(--f-display); font-style: italic; font-weight: 600; font-size: 1.5rem; }
.pc-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; margin-top: 10px; }
.pc-grid span { aspect-ratio: 1; display: grid; place-items: center; font-family: var(--f-display); font-size: .72rem; border-radius: 6px; position: relative; }
.pc-grid span.t::after { content: ""; position: absolute; inset: -1px; border: 1.8px solid var(--berry); border-radius: 50%; transform: rotate(-10deg); }
.pc-grid span.h { background: color-mix(in srgb, var(--butter) 60%, transparent); }
.pc-grid span.x::before { content: "EXAM"; position: absolute; top: -4px; right: -10px; font-family: var(--f-body); font-size: .4rem; font-weight: 900; color: var(--berry); border: 1px solid var(--berry); padding: 0 2px; border-radius: 2px; transform: rotate(10deg); background: #fff; }
.polaroid { height: 186px; border-radius: 4px; background: linear-gradient(#bfe2f1 0 45%, #9dc781 45%); position: relative; overflow: hidden; display: flex; align-items: flex-end; justify-content: center; }
.polaroid img { height: 120px; width: auto; margin: 0 -14px -4px; }
.polaroid img:nth-child(2) { height: 150px; }
.pol-cap { font-family: var(--f-hand); font-size: 1.3rem; text-align: center; padding-top: 8px; }
.anno { position: absolute; z-index: 6; font-family: var(--f-hand); font-size: 1.4rem; color: var(--ink); display: flex; align-items: center; gap: 4px; }
.anno svg { width: 60px; height: 40px; }
.anno.a1 { left: -4%; bottom: -34px; transform: rotate(-4deg); }

/* torn paper edge */
.paper-sec { background: var(--sheet); position: relative; z-index: 2; }
.paper-sec::before { content: ""; position: absolute; left: 0; right: 0; top: -22px; height: 24px; background: var(--sheet); -webkit-mask: radial-gradient(14px 12px at 14px 24px, #000 98%, transparent) 0 0 / 28px 24px repeat-x; mask: radial-gradient(14px 12px at 14px 24px, #000 98%, transparent) 0 0 / 28px 24px repeat-x; }
.paper-sec::after { content: ""; position: absolute; inset: 0; background-image: var(--grain); opacity: .12; mix-blend-mode: multiply; pointer-events: none; }

/* about */
.about-grid { display: grid; grid-template-columns: 1fr 1.35fr; gap: clamp(30px, 5vw, 70px); align-items: start; }
.about-grid h2 { font-size: clamp(2rem, 4vw, 3.1rem); }
.notes { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
.note { position: relative; padding: 26px 18px 18px; border-radius: 6px; box-shadow: var(--shadow-1); display: grid; gap: 10px; align-content: start; transition: transform .35s var(--spring); }
.note:nth-child(1) { background: var(--butter-soft); transform: rotate(-2deg); }
.note:nth-child(2) { background: var(--leaf-soft); transform: rotate(1.5deg) translateY(18px); }
.note:nth-child(3) { background: var(--berry-soft); transform: rotate(-1deg); }
.note:hover { transform: rotate(0) translateY(-6px); }
.note .sp-tape { top: -12px; left: calc(50% - 46px); width: 80px; }
.note .was { font-family: var(--f-hand); font-size: 1.3rem; line-height: 1.1; color: var(--ink-soft); text-decoration: line-through; text-decoration-color: var(--berry); text-decoration-thickness: 2px; }
.note .now { font-family: var(--f-display); font-weight: 600; font-size: 1.12rem; line-height: 1.25; }
.note p { margin: 0; font-size: .88rem; color: var(--ink-soft); line-height: 1.5; }

/* features */
.showcase { display: grid; grid-template-columns: 210px 1fr; gap: 26px; }
.tools { display: grid; gap: 8px; align-content: start; }
.stage-card { position: relative; border-radius: 28px; background: linear-gradient(135deg, var(--paper)0%, var(--sheet) 50%, var(--berry-soft) 140%); box-shadow: var(--shadow-2); padding: 34px; display: grid; grid-template-columns: 1.1fr 1fr; grid-template-rows: 1fr auto; gap: 24px; min-height: 520px; overflow: hidden; }
.viz { position: relative; display: grid; place-items: center; min-height: 340px; touch-action: pan-y; }
.viz .sp-plate { width: min(360px, 90%); }
.viz > .v { position: relative; animation: viz-in .7s var(--spring); }
@keyframes viz-in { from { opacity: 0; transform: scale(.82) rotate(-6deg) translateY(16px); } }
.info { display: flex; flex-direction: column; justify-content: center; gap: 12px; }
.info > * { animation: copy-in .55s var(--ease) both; }
.info > *:nth-child(2) { animation-delay: .05s; } .info > *:nth-child(3) { animation-delay: .1s; } .info > *:nth-child(4) { animation-delay: .15s; } .info > *:nth-child(5) { animation-delay: .2s; }
@keyframes copy-in { from { opacity: 0; transform: translateX(22px); } }
.info h3 { font-style: italic; font-size: clamp(1.9rem, 3vw, 2.5rem); line-height: 1.1; color: var(--berry-deep); font-weight: 600; margin: 0; }
.info .spec { font-weight: 800; color: var(--ink); font-size: .95rem; }
.info p { margin: 0; color: var(--ink-soft); }
.strip { grid-column: 1 / -1; display: flex; gap: 10px; align-items: center; justify-content: center; flex-wrap: wrap; }
.strip .hint { font-family: var(--f-hand); font-size: 1.15rem; color: var(--ink-soft); width: 100%; text-align: center; }
.v-book { width: 340px; aspect-ratio: 1.5; padding: 8px; border-radius: 12px; background: linear-gradient(#3d6b4c, #31593f); display: grid; grid-template-columns: 1fr 1fr; transform: rotate(-4deg); box-shadow: 0 26px 30px -20px rgba(30,40,25,.6); }
.v-book div { background: var(--sheet); padding: 12px; }
.v-book div:first-child { border-radius: 7px 2px 2px 7px; background-image: linear-gradient(90deg, transparent 86%, rgba(110,80,50,.16)), repeating-linear-gradient(180deg, transparent 0 21px, var(--rule) 21px 22px); }
.v-book div:last-child { border-radius: 2px 7px 7px 2px; background-image: linear-gradient(270deg, transparent 86%, rgba(110,80,50,.16)), repeating-linear-gradient(90deg, transparent 0 18px, var(--line) 18px 19px), repeating-linear-gradient(180deg, transparent 0 18px, var(--line) 18px 19px); }
.v-book b { font-family: var(--f-hand); font-size: 1.2rem; }
.v-list { width: 300px; background: #fff; border-radius: 16px; padding: 18px; box-shadow: var(--shadow-1); display: grid; gap: 10px; transform: rotate(2deg); }
.v-list div { display: flex; gap: 10px; align-items: center; font-family: var(--f-hand); font-size: 1.3rem; }
.v-list i { width: 20px; height: 20px; border-radius: 50%; border: 1.6px solid var(--ink-faint); flex: none; }
.v-list .d i { background: var(--leaf); border-color: var(--leaf); box-shadow: inset 0 0 0 3px #fff; }
.v-list .d span { text-decoration: line-through; color: var(--ink-faint); text-decoration-color: var(--berry-deep); }
.v-list .st { margin-left: auto; color: var(--butter-deep); font-size: 1rem; }
.v-ring { width: 260px; height: 260px; border-radius: 50%; background: radial-gradient(circle at 50% 120%, #2b3566, #0f1736 70%); display: grid; place-items: center; color: #fdf3d6; position: relative; box-shadow: 0 26px 40px -24px rgba(15,23,54,.8); }
.v-ring svg { position: absolute; inset: 14px; transform: rotate(-90deg); }
.v-ring b { font-family: var(--f-display); font-size: 3rem; font-weight: 500; margin-top: -40px; font-variant-numeric: tabular-nums; }
.v-ring img { position: absolute; bottom: 30px; height: 84px; }
.v-flash { width: 260px; height: 170px; border-radius: 18px; background: #fff; border: 2px solid var(--line); box-shadow: var(--shadow-1); display: grid; place-items: center; text-align: center; padding: 18px; font-family: var(--f-display); font-size: 1.15rem; transform: rotate(-3deg); }
.v-flash small { display: block; font-family: var(--f-body); font-size: .62rem; font-weight: 800; letter-spacing: .14em; color: var(--ink-soft); margin-bottom: 6px; }
.v-flash-wrap { position: relative; }
.v-flash-wrap .v-flash:nth-child(2) { position: absolute; inset: 0; transform: rotate(6deg) translate(26px, 16px); z-index: -1; background: var(--leaf-soft); border-color: var(--leaf); }
.v-vinyl { width: 230px; height: 230px; border-radius: 50%; background: radial-gradient(circle, var(--berry) 0 16%, #2a201c 17% 28%, #3a2e29 29% 30%, #2a201c 31% 46%, #3a2e29 47% 48%, #2a201c 49% 64%, #3a2e29 65% 66%, #2a201c 67%); animation: spin 6s linear infinite; box-shadow: 0 24px 30px -20px rgba(0,0,0,.6); }
@keyframes spin { to { transform: rotate(360deg); } }
.v-coins { display: flex; gap: 14px; align-items: flex-end; }
.v-counter { display: inline-flex; align-items: center; gap: 8px; height: 46px; font-size: 1.2rem; font-weight: 800; padding: 0 16px 0 8px; border-radius: 999px; box-shadow: var(--shadow-1); background: #fff; }
.v-counter img { width: 32px; height: 32px; }


/* night focus band */
.night { position: relative; overflow: hidden; color: #f5ecd8; isolation: isolate; }
.night-grid { position: relative; z-index: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; align-items: center; padding-block: clamp(70px, 9vw, 120px) clamp(120px, 14vw, 180px); }
.night h2 { color: #fdf3d6; } .night h2 em { color: var(--butter); }
.night .sp-lede { color: #d9d3e6; }
.night .sp-eyebrow { color: #cfc7e0; }
.mini-timer { justify-self: center; display: grid; justify-items: center; gap: 16px; }
.mt-ring { position: relative; width: min(300px, 76vw); aspect-ratio: 1; border-radius: 50%; background: rgba(16,24,56,.55); backdrop-filter: blur(8px); box-shadow: inset 0 0 0 1px rgba(255,255,255,.12), 0 30px 60px -30px rgba(0,0,0,.7); display: grid; place-items: center; }
.mt-ring svg { position: absolute; inset: 5%; transform: rotate(-90deg); }
.mt-ring .trk { fill: none; stroke: rgba(255,255,255,.14); stroke-width: 9; }
.mt-ring .fil { fill: none; stroke: var(--butter); stroke-width: 9; stroke-linecap: round; transition: stroke-dashoffset .3s linear; }
.mt-time { font-family: var(--f-display); font-size: 3.4rem; font-weight: 500; font-variant-numeric: tabular-nums; margin-top: -54px; }
.mt-ring img { position: absolute; bottom: 12%; height: 28%; animation: pop .5s var(--spring); }
.mt-ring img.s { height: 40%; bottom: 6%; }
@keyframes pop { from { transform: scale(.5); } }
.mt-note { font-family: var(--f-hand); font-size: 1.25rem; color: #e9e1f3; }
.feat-list { list-style: none; padding: 0; margin: 20px 0 0; display: grid; gap: 10px; }
.feat-list li { display: flex; gap: 12px; align-items: center; }
.feat-list img { width: 30px; height: 30px; }

/* how */
.how { display: grid; grid-template-columns: repeat(3, 1fr); gap: 26px; position: relative; }
.vine { position: absolute; left: 8%; width: 84%; top: 64px; height: 60px; z-index: 0; }
.vine path { fill: none; stroke: var(--leaf); stroke-width: 3; stroke-dasharray: 8 9; stroke-linecap: round; }
.how-step { position: relative; z-index: 1; display: grid; justify-items: center; text-align: center; gap: 10px; }
.how-art { width: 140px; height: 140px; border-radius: 50%; background: radial-gradient(circle at 50% 40%, #fff, var(--sheet-2)); box-shadow: var(--shadow-1); display: grid; place-items: end center; overflow: hidden; position: relative; }
.how-art img { width: 120px; height: 120px; }
.how-art img.s { transform: scale(1.9); transform-origin: 50% 92%; }
.how-art .n { position: absolute; top: 10px; left: 50%; transform: translateX(-50%); font-family: var(--f-display); font-style: italic; font-weight: 600; color: var(--berry); }
.how-step h3 { font-size: 1.4rem; margin: 0; }
.how-step p { margin: 0; color: var(--ink-soft); max-width: 32ch; }

/* cta + footer */
.cta { position: relative; overflow: hidden; border-radius: 34px; padding: clamp(40px, 6vw, 70px); min-height: 380px; display: grid; align-content: center; justify-items: start; gap: 18px; box-shadow: var(--shadow-2); isolation: isolate; }
.cta > :not(.scenery) { position: relative; z-index: 1; }
.cta .scenery { border-radius: inherit; }
.cta h2 { font-size: clamp(2.2rem, 4.6vw, 3.6rem); max-width: 14ch; }
.cta .sp-lede { color: #5c483f; }
.cta .pot { position: absolute !important; right: clamp(20px, 8vw, 110px); bottom: 26px; width: clamp(130px, 20vw, 230px); animation: bob 3s ease-in-out infinite alternate; }
@keyframes bob { to { transform: translateY(-10px) rotate(2deg); } }
.boards { display: flex; flex-wrap: wrap; gap: 8px; }
.boards .sp-chip { background: color-mix(in srgb, var(--sheet) 85%, transparent); }
footer { padding-block: 60px 40px; }
.foot-grid { display: grid; grid-template-columns: 1.4fr repeat(3, 1fr); gap: 30px; }
.foot-grid h4 { margin: 0 0 12px; font-size: .74rem; font-weight: 900; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-soft); }
.foot-grid ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.foot-grid a, .foot-grid button { color: var(--ink); text-decoration: none; font-weight: 700; font-size: .95rem; border: 0; background: none; padding: 0; text-align: left; }
.foot-grid a:hover, .foot-grid button:hover { color: var(--berry-deep); text-decoration: underline; text-underline-offset: 3px; }
.foot-grid p { color: var(--ink-soft); font-size: .92rem; margin: 12px 0 0; max-width: 34ch; }
.foot-base { margin-top: 40px; padding-top: 20px; border-top: 1.5px dashed var(--line); display: flex; flex-wrap: wrap; justify-content: space-between; gap: 10px; font-size: .82rem; color: var(--ink-soft); }
.foot-base .sp-hand { font-size: 1.2rem; }

@media (max-width: 1000px) {
  .hero-grid { grid-template-columns: 1fr; padding-bottom: 150px; }
  .stack { height: 440px; max-width: 560px; width: 100%; margin: 0 auto; }
  .about-grid, .showcase, .night-grid { grid-template-columns: 1fr; }
  .tools { display: none; }
  .foot-grid { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 720px) {
  .notes { grid-template-columns: 1fr; }
  .note:nth-child(2) { transform: rotate(1deg); }
  .stage-card { grid-template-columns: 1fr; padding: 22px; min-height: 0; }
  .viz { min-height: 280px; transform: scale(.85); }
  .how { grid-template-columns: 1fr; gap: 40px; }
  .vine { display: none; }
  .cta .pot { position: relative !important; right: auto; bottom: auto; justify-self: end; margin-top: -20px; }
  .stack { height: 400px; transform: scale(.82); transform-origin: top center; margin-bottom: -60px; }
  .pcard.c-garden { left: 26%; }
  .anno.a1 { display: none; }
}
@media (max-width: 460px) {
  .stack { transform: scale(.66); margin-bottom: -130px; width: 150%; margin-left: -25%; }
  .foot-grid { grid-template-columns: 1fr; }
}
</style>
