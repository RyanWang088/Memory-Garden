<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import SceneryBackdrop from '@/components/SceneryBackdrop.vue'
import { foliageUrl } from '@/lib/plantSprites'
import { vBurst } from '@/lib/burst'
import potArt from '@/assets/ui/pot.svg'

// Log in / sign up (journal look). Same calls as before: auth.signIn (Supabase Auth) and
// auth.signUp (POST /api/auth/register, then sign-in). The router guard sends new accounts to onboarding.
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const mode = ref(route.query.mode === 'signup' ? 'signup' : 'login')
const email = ref('')
const password = ref('')
const showPw = ref(false)
const errors = ref({ email: '', password: '' })
const status = ref(null) // { tone: 'ok' | 'err', text }
const busy = ref(false)
const isSignup = computed(() => mode.value === 'signup')
const next = computed(() => (typeof route.query.next === 'string' && route.query.next.startsWith('/') ? route.query.next : null))

/* ---------- Sprig, the pot who watches you type ---------- */
const bubble = ref("Hi! I'm Sprig.")
const bubbleSwap = ref(false)
const sprigPose = ref('')   // '' | 'cover' | 'peek'
const sprigMood = ref('')   // '' | 'happy' | 'shake'
const bloomed = ref(false)
const mouth = ref('small')
const pupil = ref('')
const MOUTHS = { smile: 'M90 183 Q100 193 110 183', flat: 'M93 186 L107 186', o: 'M96 186 Q100 180 104 186 Q100 191 96 186', small: 'M92 184 Q100 190 108 184' }
function say(text) {
  bubbleSwap.value = true
  setTimeout(() => { bubble.value = text; bubbleSwap.value = false }, 160)
}
function look() {
  const dx = Math.max(-5, Math.min(5, -5 + email.value.length * 0.45))
  pupil.value = `translate(${dx}px, 3px)`
}
function shake() { sprigMood.value = ''; requestAnimationFrame(() => (sprigMood.value = 'shake')) }

function onEmailFocus() { sprigPose.value = ''; look(); say('Type away, I am reading along.') }
function onEmailInput() { look(); errors.value.email = ''; mouth.value = /^\S+@\S+\.\S+$/.test(email.value) ? 'smile' : 'small' }
function onPwFocus() { sprigPose.value = showPw.value ? 'peek' : 'cover'; say(showPw.value ? 'Peeking… just a little.' : "I won't look!") }
function toggleShow(e) {
  showPw.value = !showPw.value
  if (document.activeElement === e.currentTarget) sprigPose.value = showPw.value ? 'peek' : 'cover'
}

// password growth meter: seed → sprout → bud → bloom
const level = computed(() => {
  const v = password.value
  if (!v) return 0
  if (v.length < 4) return 1
  if (v.length < 8) return 2
  return v.length >= 12 || (/\d/.test(v) && /[^A-Za-z0-9]/.test(v)) ? 4 : 3
})
const meter = [
  { label: 'seed', art: 'seed', small: true }, { label: 'sprout', art: 'sprout', small: true },
  { label: 'bud', art: 'tulip-3' }, { label: 'bloom', art: 'tulip-pink-4' },
]

const heading = computed(() => (isSignup.value
  ? { title: 'Every garden starts with', em: 'one seed', lede: 'Plan your week in a journal, focus in short blocks, and grow a flower for every subject you study.' }
  : { title: 'Your garden', em: 'missed you', lede: "Pick up where you left off: today's tasks, a focus session and the seeds that need watering." }))

const headKey = ref(0)
watch(mode, (m) => {
  status.value = null
  errors.value = { email: '', password: '' }
  headKey.value++
  say(m === 'signup' ? 'Ooh, a new gardener!' : 'Welcome back!')
  router.replace({ query: { ...route.query, mode: m === 'signup' ? 'signup' : undefined } })
})

async function submit() {
  errors.value = { email: '', password: '' }
  status.value = null
  let ok = true
  if (!/^\S+@\S+\.\S+$/.test(email.value.trim())) { errors.value.email = 'Enter an email like name@school.edu.'; ok = false }
  if (!password.value) { errors.value.password = 'Enter your password.'; ok = false }
  else if (isSignup.value && password.value.length < 8) { errors.value.password = `Use at least 8 characters (${8 - password.value.length} more).`; ok = false }
  if (!ok) { shake(); mouth.value = 'o'; say('Hmm, check the red bits.'); return }

  busy.value = true
  try {
    await (isSignup.value ? auth.signUp(email.value.trim(), password.value) : auth.signIn(email.value.trim(), password.value))
    status.value = { tone: 'ok', text: isSignup.value ? 'Garden created! Taking you to set it up…' : 'Logged in! Taking you to your garden…' }
    sprigPose.value = ''; sprigMood.value = 'happy'; bloomed.value = true; mouth.value = 'smile'
    say(isSignup.value ? 'Yay! Let me show you around.' : 'Yay! Today is a good day.')
    // new accounts take the onboarding tour; returning users go straight back in (never to onboarding)
    const signedUp = isSignup.value
    setTimeout(() => router.push(signedUp ? { name: 'onboarding' } : (next.value ?? { name: 'garden' })), 1200)
  } catch (e) {
    busy.value = false
    status.value = { tone: 'err', text: e.code === 'invalid_credentials' ? 'Wrong email or password.' : e.message }
    shake(); mouth.value = 'flat'; say('Oh no. Try again?')
  }
}

const narrow = typeof window !== 'undefined' && window.innerWidth < 600
onMounted(() => { if (next.value) status.value = { tone: 'ok', text: 'Log in to keep going.' } })
</script>

<template>
  <div class="auth-page">
    <SceneryBackdrop mood="morning" :options="{ seed: 23, petals: 14, tulips: narrow ? 3 : 10, sunX: 18, sunY: 18 }" />
    <div class="sp-page-top" style="max-width: 1000px">
      <RouterLink class="brand" :to="{ name: 'landing' }" aria-label="Sproutly home">
        <img :src="potArt" alt="" width="38" height="38" />
        <span><span class="brand-name">Sproutly</span><span class="brand-sub">study garden &amp; journal</span></span>
      </RouterLink>
      <RouterLink class="sp-pill-link" :to="{ name: 'landing' }">‹ Back to home</RouterLink>
    </div>

    <main class="auth" data-testid="auth">
      <span class="sp-tape a" aria-hidden="true"></span>
      <span class="sp-tape is-leaf b" aria-hidden="true"></span>

      <section class="window">
        <div :key="headKey" class="intro fade-swap">
          <h1>{{ heading.title }} <em>{{ heading.em }}</em></h1>
          <p class="sp-lede">{{ heading.lede }}</p>
        </div>
        <div class="bubble" :class="{ swap: bubbleSwap }" aria-hidden="true">{{ bubble }}</div>
        <svg class="sprig" :class="[sprigPose, sprigMood, { bloomed }]" viewBox="0 0 200 230" aria-hidden="true">
          <ellipse cx="100" cy="222" rx="62" ry="8" fill="rgba(60,40,20,.18)" />
          <g class="body">
            <path d="M100 128 C100 112 100 104 100 96" stroke="#3E8B57" stroke-width="7" stroke-linecap="round" fill="none" />
            <g class="bloom">
              <path d="M100 40c-16 0-22 14-20 26 2 10 10 14 20 14s18-4 20-14c2-12-4-26-20-26z" fill="#F08A9C" />
              <path d="M100 42c-6 8-6 22 0 36 6-14 6-28 0-36z" fill="#E0546A" />
              <path d="M84 50c4 8 8 14 16 16-2-10-8-16-16-16zM116 50c-4 8-8 14-16 16 2-10 8-16 16-16z" fill="#F6B3BF" />
            </g>
            <path d="M42 128 h116 l-12 86 a8 8 0 0 1 -8 7 H62 a8 8 0 0 1 -8 -7z" fill="#D9825F" />
            <path d="M42 128 h116 l-2 14 H44z" fill="#C46E4E" />
            <rect x="34" y="114" width="132" height="22" rx="8" fill="#E39570" />
            <rect x="34" y="114" width="132" height="6" rx="3" fill="#EEAA86" />
            <ellipse cx="100" cy="116" rx="58" ry="5" fill="#5B3E33" />
            <g class="face">
              <ellipse cx="70" cy="176" rx="9" ry="5" fill="#F4A3A8" opacity=".75" />
              <ellipse cx="130" cy="176" rx="9" ry="5" fill="#F4A3A8" opacity=".75" />
              <g><circle cx="80" cy="162" r="10" fill="#fff" /><circle class="pupil" cx="80" cy="163" r="5.5" fill="#3A2A24" :style="{ transform: pupil }" /><circle class="pupil" cx="82" cy="161" r="1.8" fill="#fff" :style="{ transform: pupil }" /></g>
              <g><circle cx="120" cy="162" r="10" fill="#fff" /><circle class="pupil" cx="120" cy="163" r="5.5" fill="#3A2A24" :style="{ transform: pupil }" /><circle class="pupil" cx="122" cy="161" r="1.8" fill="#fff" :style="{ transform: pupil }" /></g>
              <g class="lids" fill="#D9825F"><rect x="68" y="150" width="24" height="24" rx="10" /><rect x="108" y="150" width="24" height="24" rx="10" /></g>
              <path class="mouth" :d="MOUTHS[mouth]" stroke="#3A2A24" stroke-width="3" stroke-linecap="round" fill="none" />
            </g>
            <g class="leafL"><path d="M100 104 C84 70 52 66 34 78 C46 104 76 112 100 104z" fill="#5FB070" /><path d="M100 104 C80 92 60 84 40 80" stroke="#3E8B57" stroke-width="2.5" fill="none" stroke-linecap="round" /></g>
            <g class="leafR"><path d="M100 104 C116 70 148 66 166 78 C154 104 124 112 100 104z" fill="#6CBF7C" /><path d="M100 104 C120 92 140 84 160 80" stroke="#3E8B57" stroke-width="2.5" fill="none" stroke-linecap="round" /></g>
          </g>
        </svg>
        <div class="meadow" aria-hidden="true"></div>
        <span class="tree" style="left: 12%" aria-hidden="true"></span><span class="tree" style="left: 74%; transform: scale(.7)" aria-hidden="true"></span>
        <div class="sill"></div>
      </section>

      <section class="form-side">
        <div class="sp-seg" role="tablist" aria-label="Log in or sign up">
          <span class="sp-seg-thumb" :style="{ width: 'calc((100% - 8px) / 2)', transform: `translateX(${isSignup ? 100 : 0}%)` }"></span>
          <button type="button" role="tab" :aria-selected="!isSignup" data-testid="auth-mode-login" @click="mode = 'login'">Log in</button>
          <button type="button" role="tab" :aria-selected="isSignup" data-testid="auth-mode-signup" @click="mode = 'signup'">Sign up</button>
        </div>
        <div :key="headKey" class="fade-swap">
          <h2 v-if="isSignup">Plant your <em>first seed</em></h2>
          <h2 v-else>Welcome <em>back</em></h2>
          <p class="sub">{{ isSignup ? 'Create a free account. It takes about a minute.' : 'Log in to open your journal and garden.' }}</p>
        </div>

        <form novalidate @submit.prevent="submit">
          <div class="sp-field">
            <label for="auth-email">Email</label>
            <input
              id="auth-email" v-model="email" class="sp-input" :class="{ 'is-invalid': errors.email }" type="email" autocomplete="email"
              placeholder="you@school.edu" required data-testid="auth-email"
              @focus="onEmailFocus" @input="onEmailInput" @blur="pupil = ''"
            />
            <p class="sp-field-msg" aria-live="polite">{{ errors.email }}</p>
          </div>
          <div class="sp-field">
            <label for="auth-password">Password</label>
            <div class="pw">
              <input
                id="auth-password" v-model="password" class="sp-input" :class="{ 'is-invalid': errors.password }"
                :type="showPw ? 'text' : 'password'" :autocomplete="isSignup ? 'new-password' : 'current-password'"
                :placeholder="isSignup ? 'At least 8 characters' : 'Your password'" required data-testid="auth-password"
                @focus="onPwFocus" @blur="sprigPose = ''" @input="errors.password = ''"
              />
              <button class="eye" type="button" :aria-pressed="showPw" :aria-label="showPw ? 'Hide password' : 'Show password'" @click="toggleShow">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /><path v-if="!showPw" d="M4 4l16 16" /></svg>
              </button>
            </div>
            <p class="sp-field-msg" aria-live="polite">{{ errors.password }}</p>
          </div>
          <div v-if="isSignup" class="sp-field" aria-live="polite">
            <span class="sp-label">Password growth <span class="sp-muted" style="font-weight: 600; letter-spacing: 0">· 8+ characters to bloom</span></span>
            <div class="meter">
              <span v-for="(m, i) in meter" :key="m.label" :class="{ on: i < level }"><img :class="{ s: m.small }" :src="foliageUrl(m.art)" alt="" />{{ m.label }}</span>
            </div>
          </div>
          <div v-if="status" class="status" :class="status.tone" role="status" data-testid="auth-status">{{ status.text }}</div>
          <button v-burst class="sp-btn sp-btn-block" type="submit" :disabled="busy" data-testid="auth-submit">
            <template v-if="busy"><span class="spin"></span> {{ isSignup ? 'Planting…' : 'Opening the gate…' }}</template>
            <template v-else>{{ isSignup ? 'Create my garden' : 'Log in' }} <span class="arrow">→</span></template>
          </button>
        </form>
        <p class="switch-line">
          {{ isSignup ? 'Already growing?' : 'New here?' }}
          <button class="linkish" type="button" data-testid="auth-toggle" @click="mode = isSignup ? 'login' : 'signup'">{{ isSignup ? 'Log in instead' : 'Create an account' }}</button>
        </p>
      </section>
    </main>
  </div>
</template>

<style scoped>
.auth-page { min-height: 100vh; min-height: 100dvh; display: flex; flex-direction: column; padding: 0 max(16px, env(safe-area-inset-right, 0px)) 32px max(16px, env(safe-area-inset-left, 0px)); }
.brand { display: inline-flex; align-items: center; gap: 10px; text-decoration: none; color: var(--ink); }
.brand img { width: 38px; height: 38px; transition: transform .5s var(--spring); }
.brand:hover img { transform: rotate(-10deg) scale(1.08); }
.brand-name { font-family: var(--f-display); font-style: italic; font-weight: 600; font-size: 1.45rem; line-height: 1; display: block; }
.brand-sub { display: block; font-size: .6rem; font-weight: 800; letter-spacing: .2em; text-transform: uppercase; color: var(--ink-soft); margin-top: 3px; }
.auth {
  position: relative; margin: auto; width: 100%; max-width: 1000px;
  display: grid; grid-template-columns: 1.05fr 1fr; align-items: stretch;
  border-radius: 30px; background: var(--sheet); box-shadow: var(--shadow-2);
  animation: rise .8s var(--ease) both;
}
@keyframes rise { from { transform: translateY(24px); opacity: 0; } }
.auth::after { content: ""; position: absolute; inset: 0; border-radius: inherit; background-image: var(--grain); opacity: .15; mix-blend-mode: multiply; pointer-events: none; }
.sp-tape.a { top: -11px; left: 40px; transform: rotate(-5deg); }
.sp-tape.b { top: -10px; right: 50px; transform: rotate(4deg); }

.window {
  position: relative; overflow: hidden; border-radius: 30px 0 0 30px; min-height: 560px;
  background: linear-gradient(180deg, #bfe1ef 0%, #f6dccd 62%, #9dc781 62.2%, #74ad5a 100%);
  display: flex; flex-direction: column; justify-content: space-between; padding: 34px 34px 26px;
}
.window::before { content: ""; position: absolute; inset: 0; pointer-events: none; background: linear-gradient(90deg, transparent calc(50% - 4px), rgba(255,255,255,.55) calc(50% - 4px), rgba(255,255,255,.55) calc(50% + 4px), transparent calc(50% + 4px)) 0 0 / 100% 62% no-repeat; }
.window h1 { position: relative; font-size: clamp(2rem, 3.6vw, 2.9rem); line-height: 1.05; color: var(--ink); }
.window .sp-lede { position: relative; margin-top: 10px; color: #5f4b42; }
.meadow { position: absolute; left: -10%; right: -10%; bottom: 0; height: 40%; pointer-events: none;
  background:
    radial-gradient(circle, var(--paper)1.6px, transparent 2.2px) 0 30px / 38px 26px,
    radial-gradient(circle, #f9c9d3 1.8px, transparent 2.4px) 12px 40px / 46px 30px,
    radial-gradient(circle, #f7d86e 1.6px, transparent 2.2px) 22px 52px / 52px 34px,
    radial-gradient(120% 60% at 30% 0%, #a9cf8c 0 48%, transparent 49%),
    radial-gradient(120% 70% at 85% 10%, #8fc373 0 45%, transparent 46%),
    linear-gradient(#7cb661, #5f9f4f);
}
.tree { position: absolute; bottom: 40%; width: 56px; height: 56px; border-radius: 50%; background: #5d9a52; box-shadow: 22px 8px 0 -6px #4b8a4d, -18px 10px 0 -8px #6aa95c; margin-bottom: -6px; }
.sill { position: absolute; left: 0; right: 0; bottom: 0; height: 26px; background: linear-gradient(#f3e2c7, #e4cda9); box-shadow: 0 -2px 0 rgba(255,255,255,.6) inset; }
.sprig { position: relative; z-index: 2; width: min(270px, 68%); margin: 0 auto -6px; display: block; overflow: visible; }
.sprig .leafL, .sprig .leafR { transition: transform .55s var(--spring); transform-origin: 100px 104px; }
.sprig.cover .leafL { transform: rotate(-128deg) translate(-4px, 0); }
.sprig.cover .leafR { transform: rotate(128deg) translate(4px, 0); }
.sprig.peek .leafR { transform: rotate(70deg); }
.sprig .pupil { transition: transform .15s ease-out; }
.sprig .lids { transform-origin: center; transform-box: fill-box; animation: blink 5s infinite; }
@keyframes blink { 0%, 94%, 100% { transform: scaleY(0); } 96% { transform: scaleY(1); } }
.sprig .mouth { transition: d .3s; }
.sprig.happy { animation: hop .6s var(--spring); }
@keyframes hop { 40% { transform: translateY(-16px) rotate(-3deg); } }
.sprig.shake { animation: shake .45s ease; }
@keyframes shake { 20%, 60% { transform: translateX(-7px); } 40%, 80% { transform: translateX(7px); } }
.sprig .bloom { transform-origin: 100px 60px; transform: scale(0); transition: transform .6s var(--spring); }
.sprig.bloomed .bloom { transform: scale(1); }
.bubble {
  position: absolute; z-index: 3; right: 22px; bottom: 250px; max-width: 170px;
  padding: 10px 14px; border-radius: 16px 16px 4px 16px; background: #fff; box-shadow: var(--shadow-1);
  font-family: var(--f-hand); font-size: 1.25rem; line-height: 1.1; color: var(--ink);
  transition: transform .3s var(--spring), opacity .2s;
}
.bubble.swap { transform: scale(.85); opacity: 0; }

.form-side { position: relative; z-index: 1; padding: 40px clamp(22px, 4vw, 48px) 30px; display: flex; flex-direction: column; gap: 18px; }
.form-side .sp-seg { align-self: flex-start; }
.form-side h2 { font-size: clamp(1.8rem, 3vw, 2.3rem); line-height: 1.1; }
.form-side h2 em { color: var(--leaf); }
.sub { margin: 4px 0 0; color: var(--ink-soft); font-size: .95rem; }
form { display: grid; gap: 14px; }
.pw { position: relative; }
.pw .sp-input { padding-right: 52px; }
.eye { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); width: 40px; height: 40px; border: 0; background: none; border-radius: 10px; color: var(--ink-soft); display: grid; place-items: center; }
.eye:hover { background: var(--sheet-2); color: var(--ink); }
.eye svg { width: 22px; height: 22px; }
.meter { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; align-items: end; }
.meter span { display: grid; justify-items: center; gap: 4px; font-size: .68rem; font-weight: 800; color: var(--ink-faint); transition: color .3s; }
.meter img { width: 34px; height: 34px; filter: grayscale(1) opacity(.35); transition: filter .4s, transform .4s var(--spring); }
.meter img.s { transform: scale(1.7); transform-origin: 50% 90%; }
.meter span.on { color: var(--leaf-deep); }
.meter span.on img { filter: none; }
.meter span.on img:not(.s) { transform: translateY(-2px); }
.linkish { border: 0; background: none; padding: 0; font-weight: 800; font-size: .88rem; color: var(--berry-deep); text-decoration: underline; text-decoration-thickness: 1.5px; text-underline-offset: 3px; }
.status { padding: .75em 1em; border-radius: 12px; font-weight: 700; font-size: .9rem; }
.status.ok { background: var(--leaf-soft); color: var(--leaf-deep); }
.status.err { background: var(--berry-soft); color: var(--berry-deep); }
.spin { display: inline-block; vertical-align: -3px; width: 18px; height: 18px; border-radius: 0 100% 0 100%; background: currentColor; animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.switch-line { text-align: center; font-size: .9rem; color: var(--ink-soft); margin: 0; }
.fade-swap { animation: fade-swap .35s var(--ease); }
@keyframes fade-swap { from { opacity: 0; transform: translateY(6px); } }

@media (max-width: 820px) {
  .auth { grid-template-columns: 1fr; max-width: 520px; }
  .window { border-radius: 30px 30px 0 0; min-height: 0; padding: 26px 22px 0; display: grid; grid-template-columns: 1fr 130px; align-items: end; gap: 0 10px; background: linear-gradient(180deg, #bfe1ef 0%, #f6dccd 70%, #9dc781 70.2%, #74ad5a 100%); }
  .window .intro { align-self: start; padding-bottom: 20px; }
  .window .sp-lede { display: none; }
  .window h1 { font-size: 1.9rem; }
  .sprig { width: 130px; margin: 0; grid-column: 2; grid-row: 1; }
  .bubble, .tree { display: none; }
  .meadow { height: 30%; }
  .window::before { background-size: 100% 70%; }
  .form-side { padding-top: 28px; }
}
</style>
