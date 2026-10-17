<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGardenStore } from '@/stores/garden'

// Opens when a plant is clicked in the garden: the user picks a goal for the review session.
const route = useRoute()
const router = useRouter()
const garden = useGardenStore()
const loading = ref(true)
const error = ref('')

const seed = computed(() => garden.seeds.find(item => item.id === route.params.id))

onMounted(async () => {
  try {
    if (!garden.loaded) await garden.fetchSeeds()
    if (!seed.value) error.value = 'This seed could not be found in your garden.'
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
})

function startStructuredQuiz() {
  router.push({ name: 'structured-quiz', params: { id: route.params.id } })
}

function startFlexibleDeck() {
  router.push({ name: 'flexible-deck', params: { id: route.params.id } })
}

function backToGarden() {
  router.push({ name: 'garden' })
}
</script>

<template>
  <main class="overlay" @click.self="backToGarden" @keydown.esc="backToGarden">
    <section class="goal-dialog bg-light rounded-4 shadow-lg p-4 d-flex flex-column gap-3" role="dialog"
      aria-modal="true" aria-labelledby="goal-title">
      <button type="button" class="btn-close align-self-end" aria-label="Back to garden" @click="backToGarden" />
      <p v-if="loading" role="status">Loading seed…</p>
      <template v-else-if="seed">
        <header class="text-center">
          <img src="../assets/ui/sprout.svg" width="72" height="72" alt="">
          <h2 id="goal-title" class="mt-2 mb-1">Choose a goal for this session</h2>
          <p class="text-body-small m-0">{{ seed.title }} · {{ seed.cards.length }} cards · Mastery {{ seed.mastery }}%</p>
        </header>

        <button type="button" class="goal-option" data-testid="goal-structured-quiz" @click="startStructuredQuiz">
          <span class="goal-icon" aria-hidden="true">🎯</span>
          <span class="d-flex flex-column text-start">
            <span class="text-button">Structured Quiz Mode</span>
            <span class="text-body-small">Up to 10 quick multiple-choice questions.</span>
          </span>
        </button>

        <button type="button" class="goal-option" data-testid="goal-flexible-deck" @click="startFlexibleDeck">
          <span class="goal-icon" aria-hidden="true">🌱</span>
          <span class="d-flex flex-column text-start">
            <span class="text-button">Flexible Deck Mode</span>
            <span class="text-body-small">Flip through up to 20 flashcards.</span>
          </span>
        </button>
      </template>
      <template v-else>
        <p class="text-danger" role="alert">{{ error }}</p>
        <button type="button" class="btn-secondary text-button align-self-center" @click="backToGarden">Back to garden</button>
      </template>
    </section>
  </main>
</template>

<style scoped>
.goal-dialog {
  width: 100%;
  max-width: 440px;
}

.goal-option {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
  padding: 16px 20px;
  border: 2px solid var(--linen);
  border-radius: 16px;
  background: var(--paper);
  color: var(--bark);
  box-shadow: 0 4px 0 var(--linen);
  transition: transform 0.18s var(--spring), box-shadow 0.18s ease, border-color 0.18s ease;
}

.goal-option:hover:not(:disabled) {
  border-color: var(--peach);
  box-shadow: 0 6px 0 var(--peach);
  transform: translateY(-2px);
}

.goal-option:focus-visible {
  outline: 3px solid var(--periwinkle);
  outline-offset: 3px;
}

.goal-option:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.goal-icon {
  display: grid;
  place-items: center;
  flex: 0 0 48px;
  height: 48px;
  border-radius: 12px;
  background: var(--cream);
  font-size: 24px;
}
</style>
