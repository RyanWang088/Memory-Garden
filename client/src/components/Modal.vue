<script setup>
import { nextTick, ref, watch } from 'vue'
import sproutArt from '@/assets/ui/sprout.svg'

// One modal for the whole app: confirm dialogs, forms, choice prompts.
//   default slot  -> body content between the message and the buttons (inputs, summaries…)
//   #actions slot -> replaces the Cancel/Confirm footer ({ cancel, busy } are passed in)
//   #icon slot    -> replaces the sprout picture
// Enter inside an input submits the form, which emits 'confirm'.
const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, required: true },
  message: { type: String, default: '' },
  variant: { type: String, default: 'default' }, // 'default' (leaf green) | 'danger' (berry red)
  confirmText: { type: String, default: 'Confirm' },
  cancelText: { type: String, default: 'Cancel' },
  busyText: { type: String, default: 'Working…' },
  busy: { type: Boolean, default: false },
  confirmDisabled: { type: Boolean, default: false },
  error: { type: String, default: '' },
  sprout: { type: Boolean, default: false }, // show the sprout picture above the title
  testid: { type: String, default: 'confirm-modal' },
  confirmTestid: { type: String, default: 'confirm-action' },
})
const emit = defineEmits(['confirm', 'cancel'])

const uid = `modal-${Math.random().toString(36).slice(2, 8)}`
const backdrop = ref(null)
const sheet = ref(null)

// on open: focus the first field if there is one, otherwise the backdrop (so Esc works)
watch(() => props.open, async (open) => {
  if (!open) return
  await nextTick()
  const first = sheet.value?.querySelector('input, textarea, select')
  ;(first ?? backdrop.value)?.focus()
})

function cancel() {
  if (!props.busy) emit('cancel')
}
function submit() {
  if (!props.busy && !props.confirmDisabled) emit('confirm')
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      ref="backdrop"
      class="sp-modal modal-host"
      :data-testid="testid"
      tabindex="-1"
      @click.self="cancel"
      @keydown.esc.stop.prevent="cancel"
    >
      <form
        ref="sheet"
        class="sp-modal-sheet sheet"
        :role="variant === 'danger' ? 'alertdialog' : 'dialog'"
        aria-modal="true"
        :aria-labelledby="`${uid}-title`"
        :aria-describedby="message ? `${uid}-message` : undefined"
        novalidate
        @submit.prevent="submit"
      >
        <span class="sp-tape" aria-hidden="true"></span>
        <button type="button" class="btn-close sp-modal-close" aria-label="Close" :disabled="busy" @click="cancel" />

        <header class="text-center d-grid gap-2 justify-items-center">
          <slot name="icon">
            <img v-if="sprout" :src="sproutArt" alt="" class="mx-auto sprout" />
          </slot>
          <h3 :id="`${uid}-title`" class="text-display m-0">{{ title }}</h3>
          <p v-if="message" :id="`${uid}-message`" class="text-body-small m-0">{{ message }}</p>
        </header>

        <div v-if="$slots.default" class="d-grid gap-3">
          <slot />
        </div>

        <p v-if="error" class="sp-field-msg m-0" role="alert">{{ error }}</p>

        <footer class="d-flex flex-column-reverse flex-sm-row justify-content-sm-end flex-wrap gap-2">
          <slot name="actions" :cancel="cancel" :busy="busy">
            <button type="button" class="sp-btn sp-btn-ghost" :disabled="busy" @click="cancel">
              {{ cancelText }}
            </button>
            <button
              type="submit"
              class="sp-btn"
              :class="{ 'sp-btn-leaf': variant !== 'danger' }"
              :disabled="busy || confirmDisabled"
              :data-testid="confirmTestid"
            >
              {{ busy ? busyText : confirmText }}
            </button>
          </slot>
        </footer>
      </form>
    </div>
  </Teleport>
</template>

<style scoped>
/* theme.css gives .sp-modal / .sp-modal-sheet / .sp-tape / .sp-modal-close; these only fix what clashes */
.modal-host { z-index: 1080; overflow-y: auto; place-items: safe center; } /* above the nav & dock; tall sheets scroll instead of clipping */
.sheet {
  display: grid; gap: var(--s-4);
  width: min(460px, 100%); max-height: none;
  overflow: visible; /* theme sets overflow:auto, which clipped the tape */
}
.sprout { width: 88px; height: 88px; }
</style>