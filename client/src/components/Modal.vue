<script setup>
import { nextTick, ref, watch } from 'vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, required: true },
  message: { type: String, required: true },
  confirmText: { type: String, default: 'Confirm' },
  busy: { type: Boolean, default: false },
  error: { type: String, default: '' },
})
const emit = defineEmits(['confirm', 'cancel'])

const backdrop = ref(null)

watch(() => props.open, async (open) => {
  if (open) {
    await nextTick()
    backdrop.value?.focus()
  }
})

function cancel() {
  if (!props.busy) emit('cancel')
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      ref="backdrop"
      class="modal d-block bg-dark bg-opacity-50 text-center"
      data-testid="confirm-modal"
      tabindex="-1"
      @click.self="cancel"
      @keydown.esc.stop.prevent="cancel"
    >
      <section
        class="modal-dialog modal-dialog-centered"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmation-modal-title"
        aria-describedby="confirmation-modal-message"
      >
        <div class="modal-content border-0 rounded-4 shadow-lg p-4 gap-3">
          <button
            type="button"
            class="btn-close me-0"
            aria-label="Close confirmation"
            :disabled="busy"
            @click="cancel"
          />
          <img class="img fluid d-block mx-auto" src="../assets/ui/sprout.svg" width="100px" height="100px" alt="">
          <header class="modal-header border-0 p-0 ">
            <h3 class="modal-title text-display">{{ title }}</h3>

          </header>
          <div class="modal-body p-0">
            <p id="confirmation-modal-message" class="text-body-small mb-0">{{ message }}</p>
            <p v-if="error" class="alert alert-danger py-2 mt-3 mb-0" role="alert">{{ error }}</p>
          </div>
          <footer class="modal-footer border-0 p-0 justify-content-center gap-2">
            <button type="button" class="seed-buy text-button" :disabled="busy" @click="cancel">
              Cancel
            </button>
            <button
              type="button"
              class="border-0 btn-primary text-button w-auto"
              data-testid="confirm-action"
              :disabled="busy"
              @click="emit('confirm')"
            >
              {{ busy ? 'Deleting…' : confirmText }}
            </button>
          </footer>
        </div>
      </section>
    </div>
  </Teleport>
</template>
