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
      class="toast-stack position-fixed start-50 translate-middle-x d-flex flex-column w-100 pe-none"
      aria-live="polite"
      aria-atomic="false"
    >
      <section
        v-for="toast in toasts.toasts"
        :key="toast.id"
        class="sp-card sp-toast d-flex align-items-center pe-auto"
        :class="`is-${toast.type}`"
        :role="toast.type === 'warning' ? 'alert' : 'status'"
        :data-testid="`toast-${toast.type}`"
      >
        <span class="badge-ic d-flex flex-shrink-0 align-items-center justify-content-center rounded-circle" aria-hidden="true">
          <img v-if="toast.type === 'reward'" :src="coinSvg" alt="" width="30" height="30" />
          <svg v-else-if="toast.type === 'success'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          <span v-else>!</span>
        </span>
        <span class="body d-flex flex-column flex-grow-1">
          <strong class="title">{{ toast.title }}</strong>
          <span class="msg sp-muted text-break">{{ toast.message }}</span>
        </span>
        <button type="button" class="sp-icon-btn dismiss flex-shrink-0 align-self-start" aria-label="Dismiss notification" @click="toasts.dismiss(toast.id)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </section>
    </TransitionGroup>
  </Teleport>
</template>

<style scoped>
.toast-stack {
  z-index: 1100; top: 84px;
  max-width: 408px; padding: 0 var(--s-4); gap: var(--s-3);
}
/* sp-card supplies the paper, shadow and grain; this only tweaks its shape */
.sp-toast {
  --tint: var(--berry-soft); --tint-ink: var(--berry-deep);
  gap: var(--s-3); min-height: 70px; padding: var(--s-3) var(--s-3) var(--s-3) var(--s-4);
  border: 1.5px solid var(--line); border-radius: 18px;
}
.sp-toast.is-success { --tint: var(--leaf-soft); --tint-ink: var(--leaf-deep); }
.sp-toast.is-reward { --tint: var(--butter-soft); --tint-ink: var(--butter-deep); }
.badge-ic {
  width: 44px; height: 44px; background: var(--tint); color: var(--tint-ink);
  font-family: var(--f-display); font-weight: 700; font-size: 1.4rem;
  box-shadow: inset 0 0 0 2px var(--paper);
}
.badge-ic svg { width: 22px; height: 22px; }
.body { min-width: 0; line-height: 1.25; }
.title { font-family: var(--f-hand); font-weight: 700; font-size: 1.35rem; line-height: 1; }
.msg { font-size: var(--fs-sm); margin-top: 2px; }
.dismiss { width: 32px; height: 32px; }
.dismiss svg { width: 14px; height: 14px; }

.toast-enter-active { transition: opacity .25s var(--ease), transform .45s var(--spring); }
.toast-leave-active { transition: opacity .2s ease, transform .2s ease; }
.toast-move { transition: transform .3s var(--ease); }
.toast-enter-from { opacity: 0; transform: translateY(-16px) scale(.96) rotate(-1deg); }
.toast-leave-to { opacity: 0; transform: translateX(24px) rotate(2deg); }

@media (max-width: 575.98px) {
  .toast-stack { padding: 0 var(--s-3); }
  .title { font-size: 1.2rem; }
}
@media (max-width: 767.98px) {
  .toast-stack { top: 74px; }
}
</style>