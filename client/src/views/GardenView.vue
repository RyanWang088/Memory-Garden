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

const garden = useGardenStore()
const ui = useUiStore()
const weather = useWeatherStore()
const route = useRoute()
const router = useRouter()

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
      <div class="scroller position-absolute top-0 start-0 w-100 h-100 overflow-auto">
        <div class="intro"></div>
        <div class="bed-wrap position-sticky bottom-0"><GardenBed /></div>
      </div>
      <div id="sky-front"></div>
      <div v-if="exam" class="exam-over-wrap position-absolute bottom-0 start-0 w-100 d-flex justify-content-center">
        <ExamOverPrompt :key="exam.id" :exam="exam" :free-slots="garden.freeShelfSlots" :busy="examChoice" :error="examError"
          @choose="chooseExamOutcome" />
      </div>
    </section>

    <ShedPanel />
  </div>
  <RouterView />
</template>

<style scoped>
.garden-stage { min-width: 0; min-height: 0; z-index: 1; }
#sky-front { position: absolute; inset: 0; z-index: 2; pointer-events: none; }
.exam-over-wrap { z-index: 3; padding-bottom: 24px; pointer-events: none; }
.exam-over-wrap > * { pointer-events: auto; }
.backdrop { background: center / cover no-repeat; z-index: 0; }

.scroller { z-index: 1; scrollbar-width: none; overscroll-behavior: contain; }
.scroller::-webkit-scrollbar { display: none; }

.intro { height: 200%; }
.bed-wrap { height: 60%; overflow-y: auto; scrollbar-width: none; overscroll-behavior: contain; }
.bed-wrap::-webkit-scrollbar { display: none; }
</style>