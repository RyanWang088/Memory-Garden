<script setup>
// Mount point for feature overlays. It renders whichever panel the store says is
// open, inside a plain container. The panels themselves are not styled here.
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { locations } from '@/world/locations'
import { useGameStore } from '@/stores/game'
import Icon from './Icon.vue'

const store = useGameStore()
const panels = Object.fromEntries(locations.filter((l) => l.panel).map((l) => [l.id, defineAsyncComponent(l.panel)]))
const current = computed(() => (store.activeLocation ? panels[store.activeLocation] : null))

const hostEl = ref(null)
let returnFocus = null
watch(
  () => store.activeLocation,
  async (id) => {
    if (id) {
      returnFocus = document.activeElement
      await nextTick()
      hostEl.value?.focus()
    } else if (returnFocus && document.contains(returnFocus)) {
      returnFocus.focus?.()
      returnFocus = null
    }
  },
)

const onKey = (e) => {
  if (e.key === 'Escape' && store.activeLocation) store.close()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Transition name="host">
    <div v-if="store.active" class="backdrop" data-testid="feature-host" @pointerdown.self="store.close()">
      <section ref="hostEl" class="sheet" role="dialog" aria-modal="true" :aria-label="store.active.label" tabindex="-1">
        <header class="bar">
          <span class="ic" :style="{ background: store.active.color }"><Icon :name="store.active.icon" /></span>
          <div class="titles">
            <h2 data-testid="panel-title">{{ store.active.label }}</h2>
            <p>{{ store.active.blurb }}</p>
          </div>
          <button type="button" class="close" data-testid="panel-close" aria-label="Close" @click="store.close()">
            <Icon name="close" />
          </button>
        </header>
        <div class="body">
          <component :is="current" @close="store.close()" />
        </div>
      </section>
    </div>
  </Transition>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(75, 58, 51, 0.35);
}
.sheet {
  display: flex;
  flex-direction: column;
  width: min(760px, 100%);
  height: min(680px, 100%);
  overflow: hidden;
  border: 3px solid #fff;
  border-radius: 28px;
  background: var(--cream);
  box-shadow: 0 10px 0 rgba(201, 154, 104, 0.2), 0 24px 50px rgba(92, 64, 44, 0.28);
  outline: none;
}
.bar { display: flex; align-items: center; gap: 12px; padding: 16px 16px 12px 18px; border-bottom: 2px solid var(--line); }
.ic { display: grid; place-items: center; flex: none; width: 44px; height: 44px; border-radius: 15px; font-size: 22px; color: #fff; }
.titles { flex: 1; min-width: 0; }
h2 { margin: 0; font: 800 22px/1.1 var(--font-display); }
.titles p { margin: 3px 0 0; font: 700 13.5px/1.3 var(--font-body); color: var(--ink-soft); }
.close { flex: none; display: grid; place-items: center; width: 44px; height: 44px; border: 0; border-radius: 50%; background: var(--paper); font-size: 20px; color: var(--ink-soft); cursor: pointer; }
.close:hover { background: #fff; }
.body { flex: 1; min-height: 0; overflow: auto; padding: 16px 18px; }

.host-enter-active, .host-leave-active { transition: opacity 0.2s ease; }
.host-enter-active .sheet { animation: rise 0.4s var(--ease-spring); }
.host-enter-from, .host-leave-to { opacity: 0; }
@keyframes rise { from { transform: translateY(24px) scale(0.94); } to { transform: none; } }

/* phone */
@media (max-width: 719px) {
  .backdrop { padding: 0; place-items: end stretch; }
  .sheet { width: 100%; height: calc(100% - var(--safe-top) - 12px); border-radius: 26px 26px 0 0; border-bottom: 0; }
  .body { padding-bottom: calc(16px + var(--safe-bottom)); }
}
</style>
