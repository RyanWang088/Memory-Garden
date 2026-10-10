<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

// TODO: replace with your real questions. Each answer advances the seed one growth stage.
const questions = [
  { id: 'goal', text: 'What are you studying for?' },
  { id: 'hours', text: 'How many hours a week can you study?' },
  { id: 'avatar', text: 'Pick your gardener' },
]
const step = ref(0)
const answers = ref({})
const current = computed(() => questions[step.value])
const isLast = computed(() => step.value === questions.length - 1)
const stage = computed(() => Math.min(step.value + (answers.value[current.value.id] ? 1 : 0), 3))

async function next() {
  if (!isLast.value) { step.value++; return }
  await auth.completeOnboarding(answers.value, answers.value.avatar ?? null)
  router.push({ name: 'garden' })
}
</script>

<template>
  <main class="container py-5" style="max-width: 520px">
    <div class="progress mb-3"><div class="progress-bar" :style="{ width: ((step + 1) / questions.length) * 100 + '%' }" /></div>
    <h3 data-testid="onboarding-question">{{ current.text }}</h3>
    <input v-model="answers[current.id]" class="form-control my-3" data-testid="onboarding-input" />
    <button class="btn btn-success" @click="next" data-testid="onboarding-next">{{ isLast ? 'Finish' : 'Next' }}</button>


  </main>
</template>

<style scoped>
.corner-seed { position: fixed; right: 16px; bottom: 16px; width: 96px; height: 96px; }
</style>
