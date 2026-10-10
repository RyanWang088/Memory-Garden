<script setup>
// Home Cottage: profile, streak and settings.
// Mounted by FeatureHost when this location opens. Emit 'close' to dismiss the overlay.
// Streak / coins / avatar follow the `simplified` branch's NavBar.
import { computed, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'

const emit = defineEmits(['close'])
const auth = useAuthStore()
const busy = ref(false)

const profile = computed(() => auth.profile ?? {})
const answers = computed(() => [
  { label: 'Studying for', value: profile.value.onboarding_answers?.goal },
  { label: 'Hours a week', value: profile.value.onboarding_answers?.hours },
  { label: 'Gardener', value: profile.value.avatar },
])

async function logOut() {
  busy.value = true
  try {
    // Close first so the cottage doesn't reopen on the next login. App.vue then shows the login page.
    emit('close')
    await auth.signOut()
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="cottage" data-testid="cottage-panel">
    <header class="who">
      <span class="avatar" aria-hidden="true">🙂</span>
      <div class="names">
        <h3>{{ profile.display_name }}</h3>
        <p>{{ auth.user?.email }}</p>
      </div>
    </header>

    <div class="stats">
      <span class="counter" data-testid="cottage-streak">🔥 Streak {{ profile.streak ?? 0 }}</span>
      <span class="counter" data-testid="cottage-coins">🧈 Coins {{ profile.coins ?? 0 }}</span>
    </div>

    <dl class="answers">
      <div v-for="a in answers" :key="a.label" class="row">
        <dt>{{ a.label }}</dt>
        <dd>{{ a.value || '—' }}</dd>
      </div>
    </dl>

    <button type="button" class="logout" :disabled="busy" data-testid="logout" @click="logOut">Log out</button>
  </section>
</template>

<style scoped>
.cottage { display: flex; flex-direction: column; gap: 18px; }
.who { display: flex; align-items: center; gap: 14px; }
.avatar {
  display: grid;
  place-items: center;
  flex: none;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--petal);
  font-size: 30px;
}
.names { min-width: 0; }
h3 { margin: 0; font: 800 20px/1.2 var(--font-display); }
.names p { margin: 2px 0 0; font: 700 14px var(--font-body); color: var(--ink-soft); overflow-wrap: anywhere; }
.stats { display: flex; flex-wrap: wrap; gap: 10px; }
.counter {
  padding: 8px 14px;
  border: 2px solid var(--line);
  border-radius: 999px;
  background: #fff;
  font: 800 15px var(--font-body);
  font-variant-numeric: tabular-nums;
}
.answers { margin: 0; padding: 14px 16px; border-radius: 18px; background: var(--paper); }
.row { display: flex; gap: 12px; padding: 6px 0; }
.row + .row { border-top: 2px solid var(--line); }
dt { flex: 0 0 120px; font: 700 14px var(--font-body); color: var(--ink-soft); }
dd { margin: 0; min-width: 0; font: 800 15px var(--font-body); overflow-wrap: anywhere; }
.logout {
  align-self: flex-start;
  padding: 11px 26px;
  border: 2px solid var(--petal-deep);
  border-radius: 999px;
  background: #fff;
  font: 800 15px var(--font-body);
  color: var(--petal-deep);
  cursor: pointer;
}
.logout:hover { background: var(--petal-deep); color: #fff; }
.logout:disabled { opacity: 0.6; cursor: default; }
</style>
