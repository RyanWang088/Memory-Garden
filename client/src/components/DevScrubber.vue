<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useWeatherStore } from '@/stores/weather'

const store = useWeatherStore()
const show = ref(false)

const SWEEP_START = 3 * 60          // 3:00am
const SWEEP_END = 19 * 60 + 34      // 7:34pm
const SWEEP_MS = 40000              // total sweep length in ms; edit freely
const REST_MIN = 16 * 60       // 6:20pm blush
const CONDITIONS = { 1: 'sunny', 2: 'cloudy', 3: 'rainy', 4: 'stormy' }
let raf = 0

// [share of SWEEP_MS, minute of day reached at the end of that share]
// Night is skipped quickly. Dawn, blush and dusk each get about a quarter of the time.
function stops() {
  const sr = store.sunrise, ss = store.sunset
  const pts = [
    [0, SWEEP_START],
    [0.08, sr - 30],                 // night to first light
    [0.33, sr + 90],                 // dawn / golden morning
    [0.45, ss - 60],                 // midday, passed through quickly
    [0.72, ss],                      // blush
    [1, SWEEP_END],                  // dusk
  ]
  // keep minutes increasing even if the API returns odd sunrise/sunset values
  for (let i = 1; i < pts.length; i++) pts[i][1] = Math.max(pts[i][1], pts[i - 1][1])
  return pts
}

function minuteAt(p) {
  const pts = stops()
  for (let i = 1; i < pts.length; i++) {
    if (p <= pts[i][0]) {
      const [p0, m0] = pts[i - 1], [p1, m1] = pts[i]
      return m0 + (m1 - m0) * ((p - p0) / (p1 - p0))
    }
  }
  return SWEEP_END
}

function stopSweep() { cancelAnimationFrame(raf); raf = 0 }

function startSweep() {
  stopSweep()
  store.frozen = true
  const t0 = performance.now()
  const step = (now) => {
    const t = Math.min((now - t0) / SWEEP_MS, 1)
    store.nowMin = Math.round(minuteAt(t))   // linear on purpose: no global easing, so the middle doesn't speed up
    raf = t < 1 ? requestAnimationFrame(step) : 0
  }
  raf = requestAnimationFrame(step)
}

function onKey(e) {
  const tag = e.target?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return
  if (e.metaKey || e.ctrlKey || e.altKey) return

  const k = e.key.toLowerCase()
  if (k === '*') show.value = !show.value
  else if (CONDITIONS[k]) { store.frozen = true; store.condition = CONDITIONS[k] }
  else if (k === '/') raf ? stopSweep() : startSweep()
  else if (k === '-') { stopSweep(); store.frozen = true; store.nowMin = REST_MIN }
  else if (k === '+') { stopSweep(); store.frozen = false; store.load() }
}

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => { window.removeEventListener('keydown', onKey); stopSweep() })
</script>
<template>
  <div v-if="show" style="position:fixed;bottom:10px;right:500px;background:var(--berry-deep);color:#fff;padding:12px;z-index:99999;">
    <div>TIME: {{ Math.floor(store.nowMin / 60) }}:{{ String(store.nowMin % 60).padStart(2,'0') }} | press * to close</div>
    <input type="range" min="0" max="1439" v-model.number="store.nowMin" style="width:180px;margin:6px 0;" />
    <div style="display:flex;gap:4px;">
      <button @click="store.condition = 'sunny'">Sunny</button>
      <button @click="store.condition = 'cloudy'">Cloudy</button>
      <button @click="store.condition = 'rainy'">Rainy</button>
      <button @click="store.condition = 'stormy'">Stormy</button>
    </div>
  </div>
</template>