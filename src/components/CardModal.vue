<script setup>
import { ref, watch } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useGardenStore } from '@/stores/garden'

// ONE modal for both flows:
//   mode 'create' -> flashcard / quiz creation (Feature 3), then plantSeed()
//   mode 'review' -> flashcard deck / quiz session (Feature 4), then rateReview()
// Placeholder: build the real forms and the card-flip UI inside the two blocks below.
const ui = useUiStore()
const garden = useGardenStore()
const title = ref('')

watch(() => ui.modal.open, (o) => { if (o) title.value = '' })

async function save() {
  await garden.plantSeed({ title: title.value || 'Untitled', subject: ui.modal.draft?.subject, cards: [] })
  ui.closeModal()
}
async function rate(rating) {
  await garden.rateReview(ui.modal.seedId, rating)
  ui.closeModal() // TODO: trigger the growth-state animation after closing
}
</script>

<template>
  <div v-if="ui.modal.open" class="modal-backdrop-sp" data-testid="card-modal" @click.self="ui.closeModal()">
    <div class="modal-box">
      <template v-if="ui.modal.mode === 'create'">
        <h5>New seed</h5>
        <input v-model="title" class="form-control mb-2" placeholder="Topic title" data-testid="seed-title" />
        <p class="small text-muted">TODO: manual card editor + AI generation from uploaded material</p>
        <button class="btn btn-success" @click="save" data-testid="seed-save">Plant it</button>
      </template>

      <template v-else>
        <h5>Review</h5>
        <p class="small text-muted">TODO: card flip UI, flexible deck mode / timed quiz mode</p>
        <div class="d-flex gap-2">
          <button class="btn btn-outline-danger" @click="rate('forgot')" data-testid="rate-forgot">Forgot</button>
          <button class="btn btn-outline-warning" @click="rate('hard')" data-testid="rate-hard">Hard</button>
          <button class="btn btn-outline-success" @click="rate('easy')" data-testid="rate-easy">Easy</button>
        </div>
      </template>

      <button class="btn btn-link mt-3 p-0" @click="ui.closeModal()">Close</button>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop-sp { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal-box { background: #fff; padding: 24px; border-radius: 12px; width: min(480px, 92vw); }
</style>
