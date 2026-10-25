<script setup>
import { onMounted, onBeforeUnmount, computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGardenStore } from '@/stores/garden'
import { useUiStore } from '@/stores/ui'
import { useWeatherStore } from '@/stores/weather'
import GardenBed from '@/components/GardenBed.vue'
import ShedPanel from '@/components/ShedPanel.vue'
import Skybox from '@/components/Skybox.vue'
import ExamOverPrompt from '@/components/ExamOverPrompt.vue'
import { useAuthStore } from '@/stores/auth'
import { greeting } from '@/lib/greeting'

const garden = useGardenStore()
const ui = useUiStore()
const weather = useWeatherStore()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

// top-left notes over the sky (journal look): a greeting and three facts about the garden
const hud = computed(() => {
  const seeds = garden.gardenSeeds
  const thirsty = seeds.filter((s) => s.alert).length
  const today = new Date().toLocaleDateString('en-CA')
  const next = seeds.filter((s) => s.exam_date && s.exam_date.slice(0, 10) >= today)
    .sort((a, b) => a.exam_date.localeCompare(b.exam_date))[0]
  const days = next ? Math.round((Date.parse(next.exam_date.slice(0, 10)) - Date.parse(today)) / 864e5) : null
  const name = auth.profile?.display_name && auth.profile.display_name !== 'gardener' ? `, ${auth.profile.display_name}` : ''
  return {
    hello: `${greeting()}${name}.`,
    line: !seeds.length ? 'Plant your first seed.' : thirsty ? 'Some seeds are thirsty.' : 'Your garden is growing.',
    thirsty, next: next ? `${next.subject} exam ${days === 0 ? 'today' : `in ${days} day${days === 1 ? '' : 's'}`}` : null, planted: seeds.length,
  }
})
function openStudy() { ui.setShedTab('study'); ui.shedOpen = true }

// "Exam is over": one subject at a time, oldest exam first, only on the garden itself (not over a seed page)
const examChoice = ref('')  // the choice being saved
const examError = ref('')
const exam = computed(() => (route.name === 'garden' ? garden.examsOver[0] : null))

async function chooseExamOutcome(choice) {
  if (examChoice.value || !exam.value) return
  const { id } = exam.value
  examChoice.value = choice
  examError.value = ''
  try {
    await garden.chooseExamOutcome(id, choice)
    if (choice === 'house') await router.push({ name: 'profile', query: { new: id } })
  } catch (e) {
    examError.value = e instanceof Error ? e.message : String(e)
  } finally {
    examChoice.value = ''
  }
}

function clearSeedSelectionOutsideCard(event) {
  if (event.target instanceof Element && event.target.closest('.seed-card')) return
  ui.clearGardenSeedSelection()
}

onMounted(async () => {
  document.addEventListener('click', clearSeedSelectionOutsideCard)
  weather.load()
  await garden.fetchSeeds()
  ui.pickDefaultTab(garden.hasPlants)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', clearSeedSelectionOutsideCard)
})
</script>
<template>
  <div class="d-flex flex-column flex-md-row overflow-hidden position-fixed top-0 start-0 w-100 h-100">
    <!-- sky now spans the whole screen, so nothing is exposed behind the shed -->
    <Skybox/>
    <section class="garden-stage position-relative flex-grow-1" data-testid="garden-stage">
      <div class="garden-hud" aria-live="polite">
        <h1 class="sp-greet on-sky">{{ hud.hello }} <span>{{ hud.line }}</span></h1>
        <div class="hud-chips">
          <button v-if="hud.thirsty" type="button" class="hud-chip is-alert" @click="openStudy"><img src="../assets/ui/wateringCanIcon.svg" alt="" width="18" height="18" />{{ hud.thirsty }} plant{{ hud.thirsty === 1 ? '' : 's' }} need a quiz</button>
          <span v-if="hud.next" class="hud-chip"><img src="../assets/ui/planner.svg" alt="" width="18" height="18" />Next: {{ hud.next }}</span>
          <span class="hud-chip"><img src="../assets/ui/sprout.svg" alt="" width="18" height="18" />{{ hud.planted }} planted</span>
        </div>
      </div>
      <div class="scroller position-absolute top-0 start-0 w-100 h-100 overflow-auto">
        <div class="intro"></div>
        <div class="bed-wrap position-sticky bottom-0"><GardenBed /></div>
      </div>
      <div id="sky-front"></div>
    </section>

    <ShedPanel />
  </div>
  <!-- on top of everything (incl. the phone shed drawer), placed in the open sky under the navbar -->
  <Teleport to="body">
    <div v-if="exam" class="exam-over-wrap d-flex justify-content-center" :class="{ 'beside-shed': ui.shedOpen }">
      <ExamOverPrompt :key="exam.id" :exam="exam" :free-slots="garden.freeShelfSlots" :busy="examChoice" :error="examError"
        @choose="chooseExamOutcome" />
    </div>
  </Teleport>
  <RouterView />
</template>

<style scoped>
.garden-stage { min-width: 0; min-height: 0; z-index: 1; }
#sky-front { position: absolute; inset: 0; z-index: 2; pointer-events: none; }
.exam-over-wrap {
  position: fixed; top: 196px; left: 16px; z-index: 1025; width: min(460px, calc(100% - 32px));
  justify-content: flex-start !important; pointer-events: none;
  animation: drop-in .5s var(--spring) both;
}
.exam-over-wrap > * { pointer-events: auto; width: 100% !important; }
@media (max-width: 767.98px) { .exam-over-wrap { top: 74px; left: 8px; width: calc(100% - 16px); } }

/* greeting + chips over the sky */
.garden-hud { position: absolute; z-index: 3; top: 84px; left: 18px; right: 18px; pointer-events: none; display: grid; gap: 10px; justify-items: start; }
.garden-hud .sp-greet { font-size: clamp(1.5rem, 2.6vw, 2rem); margin: 0; }
.garden-hud .sp-greet span { white-space: nowrap; }
.hud-chips { display: flex; flex-wrap: wrap; gap: 8px; pointer-events: auto; }
.hud-chip { display: inline-flex; align-items: center; gap: 6px; padding: .3em .8em .3em .45em; border-radius: 999px; border: 0;
  background: color-mix(in srgb, var(--sheet) 86%, transparent); backdrop-filter: blur(8px); box-shadow: var(--shadow-1);
  font-size: .8rem; font-weight: 800; color: var(--ink); }
button.hud-chip { transition: transform .2s var(--spring); }
button.hud-chip:hover { transform: translateY(-2px); }
.hud-chip.is-alert { background: var(--berry-soft); color: var(--berry-deep); }
@media (max-width: 767.98px) { .garden-hud { top: 74px; } .garden-hud .sp-greet { font-size: 1.3rem; } .garden-hud .sp-greet span { display: none; } }
@keyframes drop-in { from { opacity: 0; transform: translateY(-16px); } }
.exam-over-wrap > * { pointer-events: auto; }
.backdrop { background: center / cover no-repeat; z-index: 0; }

.scroller { z-index: 1; scrollbar-width: none; overscroll-behavior: contain; }
.scroller::-webkit-scrollbar { display: none; }

.intro { height: 200%; }
.bed-wrap { height: 60%; overflow-y: auto; scrollbar-width: none; overscroll-behavior: contain; }
.bed-wrap::-webkit-scrollbar { display: none; }
</style>