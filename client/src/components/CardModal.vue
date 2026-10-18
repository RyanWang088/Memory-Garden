<script setup>
import { ref, watch } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useGardenStore } from '@/stores/garden'
import PlantSeedForm from './PlantSeedForm.vue'

// ONE modal for both flows:
//   mode 'create' -> PlantSeedForm (Feature 3), then plantSeed()
//   mode 'review' -> flashcard deck / quiz session (Feature 4), then rateReview()
// Placeholder: build the card-flip UI inside the review block below.
const ui = useUiStore()
const garden = useGardenStore()
const saving = ref(false)
const error = ref('')

watch(() => ui.modal.open, (o) => { if (o) error.value = '' })

// draft = { col, row } from the drop on GardenBed; details = the form's fields
async function save(details) {
  saving.value = true
  error.value = ''
  try {
    const { col, row } = ui.modal.draft
    await garden.plantSeed({ ...details, col, row, color: ui.selectedSeedColor })
    ui.closeModal() // the new tulip now shows in the garden
  } catch (e) {
    error.value = e.message
  } finally {
    saving.value = false
  }
}
async function rate(rating) {
  error.value = ''
  try {
    await garden.rateReview(ui.modal.seedId, rating)
    ui.closeModal() // TODO: trigger the growth-state animation after closing
  } catch (e) {
    error.value = e.message
  }
}
</script>

<template>
  <div v-if="ui.modal.open" class="modal-backdrop-sp" data-testid="card-modal" @click.self="!saving && ui.closeModal()">
    <div class="modal-box" :class="{ wide: ui.modal.mode === 'create' }">
      <PlantSeedForm v-if="ui.modal.mode === 'create'" :busy="saving" :error="error" @save="save" @cancel="ui.closeModal()" />

      <template v-else>
        <h5>Review</h5>
        <p class="small text-muted">TODO: card flip UI, flexible deck mode / timed quiz mode</p>
        <div class="d-flex gap-2">
          <button class="btn btn-outline-danger" @click="rate('forgot')" data-testid="rate-forgot">Forgot</button>
          <button class="btn btn-outline-warning" @click="rate('hard')" data-testid="rate-hard">Hard</button>
          <button class="btn btn-outline-success" @click="rate('easy')" data-testid="rate-easy">Easy</button>
        </div>
        <p v-if="error" class="text-danger small mt-2 mb-0">{{ error }}</p>
        <button class="btn btn-link mt-3 p-0" @click="ui.closeModal()">Close</button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop-sp { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal-box { background: #fff; padding: 24px; border-radius: 12px; width: min(480px, 92vw); max-height: 90vh; overflow-y: auto; }
.modal-box.wide { width: min(720px, 94vw); background: var(--cream); border: 2px solid var(--bark); border-radius: 20px; }
</style>
