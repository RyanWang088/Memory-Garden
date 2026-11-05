<script setup>
import { onMounted, onBeforeUnmount, computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGardenStore, examLabel } from '@/stores/garden'
import { useUiStore } from '@/stores/ui'
import { useWeatherStore } from '@/stores/weather'
import GardenBed from '@/components/GardenBed.vue'
import SceneCritters from '@/components/SceneCritters.vue'
import ShedPanel from '@/components/ShedPanel.vue'
import Skybox from '@/components/Skybox.vue'
import Modal from '@/components/Modal.vue'
import { useAuthStore } from '@/stores/auth'
import { greeting } from '@/lib/greeting'

const garden = useGardenStore()
const ui = useUiStore()
const weather = useWeatherStore()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

// Starts the live sky (weather fetch + the one clock). Done in setup, before the sky mounts, so it always
// opens on the night frame and wakes up from there.
weather.start()

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
    thirsty, next: next ? `${examLabel(next.subject, next.exam_name)} ${days === 0 ? 'today' : `in ${days} day${days === 1 ? '' : 's'}`}` : null, planted: seeds.length,
  }
})
function openStudy() { ui.setShedTab('study'); ui.shedOpen = true }

function openStudyForQuery() {
  if (typeof route.query.q !== 'string') return
  ui.setShedTab('study')
  ui.shedOpen = true
}

watch(() => route.query.q, openStudyForQuery)

// "Exam is over": one exam at a time, oldest first, only on the garden itself (not over a seed page)
const examChoice = ref('')  // the choice being saved
const examError = ref('')
const dismissedExamId = ref(null)
const exam = computed(() => (route.name === 'garden' ? garden.examsOver[0] : null))
const showExam = computed(() => exam.value && exam.value.id !== dismissedExamId.value)
const examMessage = computed(() => {
  const count = exam.value?.seedIds.length ?? 0
  return `Where should its ${count} ${count === 1 ? 'bloom' : 'blooms'} live? In the house they become keepsakes and stop asking for reviews.`
})
const canMoveExam = computed(() => Boolean(exam.value && (exam.value.shelf_slot !== null || garden.freeShelfSlots > 0)))

function dismissExam() {
  if (exam.value && !examChoice.value) dismissedExamId.value = exam.value.id
}

async function chooseExamOutcome(choice) {
  if (examChoice.value || !exam.value) return
  const { id, subject_id } = exam.value
  examChoice.value = choice
  examError.value = ''
  try {
    await garden.chooseExamOutcome(id, choice)
    // the shelf shows one flower per subject, so the new flower is found by subject
    if (choice === 'house') await router.push({ name: 'profile', query: { new: subject_id } })
  } catch (e) {
    examError.value = e instanceof Error ? e.message : String(e)
  } finally {
    examChoice.value = ''
  }
}

function clearSeedSelectionOutsideCard(event) {
  if (event.target instanceof Element && event.target.closest('.seed-card, .plant, .plant-info')) return
  ui.clearGardenSeedSelection()
}

onMounted(async () => {
  document.addEventListener('click', clearSeedSelectionOutsideCard)
  await garden.fetchSeeds()
  ui.pickDefaultTab(garden.hasPlants)
  openStudyForQuery()
})

onBeforeUnmount(() => {
  document.removeEventListener('click', clearSeedSelectionOutsideCard)
  weather.stop()
})
</script>
<template>
  <div class="d-flex flex-column flex-md-row overflow-hidden position-fixed top-0 start-0 w-100 h-100">
    <!-- sky now spans the whole screen, so nothing is exposed behind the shed -->
    <Skybox/>
    <section class="garden-stage position-relative flex-grow-1" data-testid="garden-stage">
      <SceneCritters class="garden-critters" :mood="weather.look.mood" :weather="weather.look.weather" :fireflies="20" :flies-from="20" />
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
  <Modal
    :open="!!showExam"
    :title="`${examLabel(exam?.subject, exam?.name)} is over`"
    :message="examMessage"
    :busy="!!examChoice"
    :error="examError"
    testid="exam-over"
    @cancel="dismissExam"
  >
    <p v-if="!canMoveExam" class="text-body-small m-0" data-testid="exam-over-full">
      Your shelves are full. Unlock more space on your <RouterLink :to="{ name: 'profile' }">profile</RouterLink>.
    </p>
    <template #actions="{ busy }">
      <button type="button" class="sp-btn sp-btn-ghost" :disabled="busy" data-testid="exam-keep" @click="chooseExamOutcome('garden')">
        {{ examChoice === 'garden' ? 'Saving…' : 'Keep in garden' }}
      </button>
      <button type="button" class="sp-btn sp-btn-leaf" :disabled="busy || !canMoveExam" data-testid="exam-move" @click="chooseExamOutcome('house')">
        <svg width="22" height="26" viewBox="0 0 52 56" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M19.0344 24.1625C19.9147 25.0429 22.1449 26.2755 24.0226 24.1625C25.9004 22.0496 28.7171 18.9785 29.8908 17.707C30.5302 16.49 30.0931 15.9303 29.4159 15.0631C29.2223 14.8151 29.009 14.542 28.7956 14.2212C27.1931 11.8117 25.6216 6.78552 32.546 0.514783C36.2502 -1.33764 40.1522 2.2395 42.501 4.45007L51.023 11.4719C51.9414 12.3407 52.7814 13.2015 50.4274 16.1631C48.3421 18.7867 45.165 21.1308 41.6177 21.3597C40.6266 21.4236 39.8052 21.3893 39.0812 21.3591C37.2138 21.281 35.9939 21.2301 34.1798 22.9617C32.1659 24.8841 30.4813 27.043 29.8908 27.8821C29.0332 28.7213 27.8326 30.9031 29.8908 32.917C30.2872 33.305 30.7761 33.7107 31.296 34.142C34.1493 36.5098 37.9374 39.6531 32.5191 44.908C26.1137 51.1202 14.6716 59.0514 5.07292 53.2507C-3.35627 48.1567 -0.785634 31.2474 9.12437 21.3597C12.3654 18.4375 17.0815 22.0107 19.0344 24.1625ZM33.0089 11.8823C32.8096 9.56977 33.4638 5.63852 37.6744 8.41352C41.8851 11.1885 43.4959 12.7594 43.7749 13.1979C44.692 14.0751 45.2821 15.9731 40.3059 16.5473C35.3296 17.1215 33.3678 13.6765 33.0089 11.8823Z" fill-rule="evenodd" clip-rule="evenodd" fill="var(--leaf-soft)"/>
        </svg>
        {{ examChoice === 'house' ? 'Moving…' : 'Move to house' }}
      </button>
    </template>
  </Modal>
  <RouterView />
</template>

<style scoped>
.garden-stage { min-width: 0; min-height: 0; z-index: 1; }
.garden-critters { z-index: 3; }
#sky-front { position: absolute; inset: 0; z-index: 2; pointer-events: none; }

/* greeting + chips over the sky */
.garden-hud { position: absolute; z-index: 3; top: 84px; left: max(18px, calc((100vw - 1280px) / 2)); right: 18px; pointer-events: none; display: grid; gap: 10px; justify-items: start; }
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

.scroller { z-index: 1; scrollbar-width: none; overscroll-behavior: contain; }
.scroller::-webkit-scrollbar { display: none; }

.intro { height: 200%; }
/* the sky above the horizon lives inside this box; with MEADOW_HEIGHT (gardenCamera.js) the horizon stays on the sky's 50% line */
.bed-wrap { height: 75%; overflow-y: auto; scrollbar-width: none; overscroll-behavior: contain; }
.bed-wrap::-webkit-scrollbar { display: none; }
</style>