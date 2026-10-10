<script setup>
// Setup questionnaire shown once after sign up. Ported from the `simplified` branch's
// OnboardingView. Finishing flips `profile.onboarded`, and App.vue then shows the map.
import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()

// TODO: replace with your real questions.
const questions = [
  { id: 'goal', text: 'What are you studying for?' },
  { id: 'hours', text: 'How many hours a week can you study?' },
  { id: 'avatar', text: 'Pick your gardener' },
]
const step = ref(0)
const answers = ref({})
const busy = ref(false)
const current = computed(() => questions[step.value])
const isLast = computed(() => step.value === questions.length - 1)

async function next() {
  if (!isLast.value) { step.value++; return }
  busy.value = true
  try {
    await auth.completeOnboarding(answers.value, answers.value.avatar ?? null)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="screen" data-testid="onboarding-questions">
    <form class="card" @submit.prevent="next">
      <div class="progress"><div class="bar" :style="{ width: ((step + 1) / questions.length) * 100 + '%' }" /></div>
      <h3 data-testid="onboarding-question">{{ current.text }}</h3>
      <input :key="current.id" v-model="answers[current.id]" class="field" data-testid="onboarding-input" />
      <button type="submit" class="primary" :disabled="busy" data-testid="onboarding-next">{{ isLast ? 'Finish' : 'Next' }}</button>
    </form>
  </section>
</template>

<style scoped>
.screen {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 16px;
  overflow: auto;
  background: #fff;
}
.card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: min(520px, 100%);
  padding: 24px;
  border: 3px solid #fff;
  border-radius: 28px;
  background: var(--cream);
  box-shadow: var(--shadow);
}
.progress { height: 10px; border-radius: 999px; background: var(--paper); overflow: hidden; }
.bar { height: 100%; border-radius: inherit; background: var(--leaf); transition: width 0.3s ease; }
h3 { margin: 0; font: 800 22px/1.2 var(--font-display); }
.field {
  width: 100%;
  padding: 12px 14px;
  border: 2px solid var(--line);
  border-radius: 14px;
  background: #fff;
  font: 700 16px var(--font-body);
  color: var(--ink);
}
.field:focus { border-color: var(--leaf); outline: none; }
.primary {
  align-self: flex-start;
  padding: 12px 28px;
  border: 0;
  border-radius: 999px;
  background: var(--leaf);
  font: 800 16px var(--font-body);
  color: #fff;
  cursor: pointer;
}
.primary:hover { background: var(--leaf-deep); }
.primary:disabled { opacity: 0.6; cursor: default; }
</style>
