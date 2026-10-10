<script setup>
import WorldMap from '@/components/world/WorldMap.vue'
import NavBar from '@/components/ui/NavBar.vue'
import Joystick from '@/components/ui/Joystick.vue'
import FeatureHost from '@/components/ui/FeatureHost.vue'
import AuthGate from '@/features/auth/AuthGate.vue'
import OnboardingQuestions from '@/features/onboarding/OnboardingQuestions.vue'
import { useIsTouch } from '@/composables/useInput'
import { useGameStore } from '@/stores/game'
import { useAuthStore } from '@/stores/auth'

const store = useGameStore()
const auth = useAuthStore()
const isTouch = useIsTouch()
auth.init() // restores a saved session; screens below wait for `auth.ready`
// Onboarding tour (features/onboarding) mounts here later.
</script>

<template>
  <AuthGate v-if="auth.ready && !auth.user" />
  <OnboardingQuestions v-else-if="auth.ready && !auth.profile?.onboarded" />
  <main v-else-if="auth.ready" class="app">
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
