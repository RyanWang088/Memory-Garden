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
      class="toast-stack"
      aria-live="polite"
      aria-atomic="false"
    >
      <section
        v-for="toast in toasts.toasts"
        :key="toast.id"
        class="sp-toast"
        :class="`is-${toast.type}`"
        :role="toast.type === 'warning' ? 'alert' : 'status'"
        :data-testid="`toast-${toast.type}`"
      >
        <span class="badge-ic" aria-hidden="true">
          <img v-if="toast.type === 'reward'" :src="coinSvg" alt="" width="30" height="30" />
          <svg v-else-if="toast.type === 'success'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          <span v-else>!</span>
        </span>
        <span class="body">
          <strong class="title">{{ toast.title }}</strong>
          <span class="msg text-break">{{ toast.message }}</span>
        </span>
        <button type="button" class="sp-icon-btn dismiss" aria-label="Dismiss notification" @click="toasts.dismiss(toast.id)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </section>
    </TransitionGroup>
  </Teleport>
</template>

<style scoped>
.toast-stack {
  position: fixed; z-index: 1100; left: 50%; transform: translateX(-50%);
  top: calc(70px + env(safe-area-inset-top, 0px));
  width: 100%; max-width: 408px; padding: 0 var(--s-4);
  display: flex; flex-direction: column; gap: var(--s-3);
  pointer-events: none;
}
.sp-toast {
  --tint: var(--berry-soft); --tint-ink: var(--berry-deep);
  position: relative; isolation: isolate; pointer-events: auto;
  display: flex; align-items: center; gap: var(--s-3);
  min-height: 70px; padding: var(--s-3) var(--s-3) var(--s-3) var(--s-4);
  background: var(--sheet); color: var(--ink);
  border: 1.5px solid var(--line); border-radius: 18px; box-shadow: var(--shadow-2);
}
.sp-toast::after {
  content: ""; position: absolute; inset: 0; z-index: -1; border-radius: inherit; pointer-events: none;
  background-image: var(--grain); opacity: .14; mix-blend-mode: multiply;
}
.sp-toast.is-success { --tint: var(--leaf-soft); --tint-ink: var(--leaf-deep); }
.sp-toast.is-reward { --tint: var(--butter-soft); --tint-ink: var(--butter-deep); }
.badge-ic {
  flex: none; display: grid; place-items: center; width: 44px; height: 44px; border-radius: 50%;
  background: var(--tint); color: var(--tint-ink);
  font-family: var(--f-display); font-weight: 700; font-size: 1.4rem;
  box-shadow: inset 0 0 0 2px var(--paper);
}
.badge-ic svg { width: 22px; height: 22px; }
.body { display: flex; flex-direction: column; flex: 1; min-width: 0; line-height: 1.25; }
.title { font-family: var(--f-hand); font-weight: 700; font-size: 1.35rem; line-height: 1; }
.msg { font-size: var(--fs-sm); color: var(--ink-soft); margin-top: 2px; }
.dismiss { flex: none; width: 32px; height: 32px; align-self: flex-start; }
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
</style>