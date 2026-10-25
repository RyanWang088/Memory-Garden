<script setup>
import coinSvg from '@/assets/ui/coin.svg'
import { useToastStore } from '@/stores/toast'

const toasts = useToastStore()
</script>
<!-- to use the popup toast
import { useToastStore } from '@/stores/toast'

const toast = useToastStore()
toast.show({
  type: 'success',
  title: 'Garden saved',
  message: 'Your seed has been planted.',
  duration: 5000,
}) -->
<template>
  <Teleport to="body">
    <TransitionGroup
      name="toast"
      tag="div"
      class="position-fixed start-50 translate-middle-x d-flex flex-column gap-2 p-3 toast-stack"
      :style="{ zIndex: 1100, width: '100%', maxWidth: '392px', pointerEvents: 'none' }"
      aria-live="polite"
      aria-atomic="false"
    >
      <section
        v-for="toast in toasts.toasts"
        :key="toast.id"
        class="toast show d-flex align-items-center gap-3 w-100 m-0 p-2 border-0 sp-toast"
        :style="{ pointerEvents: 'auto', minHeight: '70px', color: 'var(--bark)' }"
        :role="toast.type === 'warning' ? 'alert' : 'status'"
        :data-testid="`toast-${toast.type}`"
      >
        <span
          class="d-flex flex-shrink-0 align-items-center justify-content-center rounded-circle"
          :style="{
            width: '44px',
            height: '44px',
            fontSize: '24px',
            fontFamily: 'var(--f-display)',
            backgroundColor: toast.type === 'reward' ? 'var(--butter)' : toast.type === 'success' ? 'var(--mint)' : 'var(--peach)',
            color: 'var(--bark)',
          }"
          aria-hidden="true"
        >
          <img v-if="toast.type === 'reward'" :src="coinSvg" alt="" width="32" height="32" />
          <span v-else>{{ toast.type === 'success' ? '✓' : '!' }}</span>
        </span>
        <span class="d-flex flex-column flex-grow-1 overflow-hidden">
          <strong class="text-button">{{ toast.title }}</strong>
          <span class="text-body-small text-break">{{ toast.message }}</span>
        </span>
        <button
          type="button"
          class="btn-close flex-shrink-0"
          aria-label="Dismiss notification"
          @click="toasts.dismiss(toast.id)"
        />
      </section>
    </TransitionGroup>
  </Teleport>
</template>

<style scoped>
.toast-stack { top: 70px; }
.sp-toast { background: var(--sheet); border-radius: 18px; box-shadow: var(--shadow-2); }
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(12px);
}
</style>
