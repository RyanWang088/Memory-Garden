<script setup>
import WorldMap from '@/components/world/WorldMap.vue'
import NavBar from '@/components/ui/NavBar.vue'
import Joystick from '@/components/ui/Joystick.vue'
import FeatureHost from '@/components/ui/FeatureHost.vue'
import { useIsTouch } from '@/composables/useInput'
import { useGameStore } from '@/stores/game'

const store = useGameStore()
const isTouch = useIsTouch()
// Onboarding tour (features/onboarding) and the auth gate (features/auth) mount here later.
</script>

<template>
  <main class="app">
    <WorldMap />
    <p v-show="store.mode === 'walking'" class="hint" data-testid="controls-hint">
      <template v-if="isTouch">Joystick to walk · swipe to look around</template>
      <template v-else>WASD or arrows to walk · drag to look around</template>
    </p>
    <Joystick />
    <NavBar />
    <FeatureHost />
  </main>
</template>

<style scoped>
.app { position: fixed; inset: 0; overflow: hidden; }
.hint {
  position: fixed;
  z-index: 10;
  top: calc(12px + var(--safe-top));
  left: 12px;
  max-width: calc(100% - 24px);
  margin: 0;
  padding: 7px 14px;
  border: 2px solid #fff;
  border-radius: 999px;
  background: var(--glass);
  box-shadow: var(--shadow);
  font: 800 13px var(--font-body);
  color: var(--ink-soft);
  pointer-events: none;
}
</style>
