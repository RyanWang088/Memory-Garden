<script setup>
import { nextTick, ref, watch } from 'vue'
import { vBurst } from '@/lib/burst'

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, required: true },
  message: { type: String, required: true },
  confirmText: { type: String, default: 'Confirm' },
  busyText: { type: String, default: 'Working…' },
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
      class="sp-modal"
      data-testid="confirm-modal"
      tabindex="-1"
      @click.self="cancel"
      @keydown.esc.stop.prevent="cancel"
    >
      <section
        class="sp-modal-sheet confirm-sheet px-3 px-sm-4"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmation-modal-title"
        aria-describedby="confirmation-modal-message"
      >
        <span class="sp-tape overflow-visible" aria-hidden="true"></span>
        <button
          type="button"
          class="sp-icon-btn sp-modal-close"
          aria-label="Close confirmation"
          :disabled="busy"
          @click="cancel"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>

        <img class="sprout" src="../assets/ui/sprout.svg" width="88" height="88" alt="" />
        <h3 id="confirmation-modal-title" class="text-display m-0">{{ title }}</h3>
        <p id="confirmation-modal-message" class="sp-lede message">{{ message }}</p>

        <slot />

        <p v-if="error" class="status-err m-0" role="alert">{{ error }}</p>

        <footer class="actions d-flex flex-column-reverse flex-sm-row flex-wrap justify-content-center gap-3 w-100 mt-2">
          <button type="button" class="sp-btn sp-btn-ghost w-100 w-sm-auto" :disabled="busy" @click="cancel">
            Cancel
          </button>
          <button
            v-burst
            type="button"
            class="sp-btn w-100 w-sm-auto"
            data-testid="confirm-action"
            :disabled="busy"
            @click="emit('confirm')"
          >
            {{ busy ? busyText : confirmText }}
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.confirm-sheet {
  width: min(440px, 100%);
  display: flex; flex-direction: column; align-items: center; gap: var(--s-3);
  text-align: center;
}
.sprout { animation: bob 2.4s ease-in-out infinite alternate; transform-origin: 50% 100%; }
.message { margin: 0; }
.status-err { color: var(--berry-deep); font-weight: 700; font-size: var(--fs-sm); }
.sp-modal-close[disabled] { opacity: .5; pointer-events: none; }
</style>