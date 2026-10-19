<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useGardenStore } from '@/stores/garden'
import FlowerShelf from '@/components/FlowerShelf.vue'

const auth = useAuthStore()
const garden = useGardenStore()
const route = useRoute()

const loadError = ref('')
const unlocking = ref(false)
const unlockError = ref('')

// 0 -> "0h", 9000 -> "2.5h"
const hoursStudied = computed(() => `${Number(((auth.profile?.study_seconds ?? 0) / 3600).toFixed(1))}h`)
const stats = computed(() => [
  { value: auth.profile?.streak ?? 0, label: 'sunny streak', id: 'streak' },
  { value: auth.profile?.best_streak ?? 0, label: 'best streak', id: 'best-streak' },
  { value: hoursStudied.value, label: 'studied', id: 'studied' },
  { value: 0, label: 'blooms kept', id: 'blooms-kept' }, // placeholder for now
])
const newId = computed(() => (typeof route.query.new === 'string' ? route.query.new : ''))

onMounted(async () => {
  try {
    if (!garden.loaded) await garden.fetchSeeds()
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
  }
})

async function unlockShelf() {
  if (unlocking.value) return
  unlocking.value = true
  unlockError.value = ''
  try {
    await garden.unlockShelf()
  } catch (e) {
    unlockError.value = e instanceof Error ? e.message : String(e)
  } finally {
    unlocking.value = false
  }
}

async function logout() {
  await auth.signOut()
  window.location.assign('/') // reload so the next user doesn't see this user's data
}
</script>

<template>
  <main class="profile-page" data-testid="profile">
    <aside class="profile-side d-flex flex-column gap-3">
      <div>
        <p class="text-label-caption m-0 eyebrow">Profile</p>
        <h1 class="m-0">Your flower house</h1>
      </div>
      <ul class="stats list-unstyled m-0">
        <li v-for="stat in stats" :key="stat.id" class="stat" :data-testid="`stat-${stat.id}`">
          <span class="text-stat">{{ stat.value }}</span>
          <span class="text-body-small">{{ stat.label }}</span>
        </li>
      </ul>
      <button type="button" class="logout text-body-small align-self-start" data-testid="logout" @click="logout">Log out</button>
    </aside>

    <div class="profile-main d-flex flex-column gap-2">
      <p v-if="loadError" class="text-danger m-0" role="alert">{{ loadError }}</p>
      <FlowerShelf :subjects="garden.housedSubjects" :unlocked="!!auth.profile?.shelf_unlocked" :coins="auth.profile?.coins ?? 0"
        :unlocking="unlocking" :new-id="newId" @unlock="unlockShelf" />
      <p v-if="unlockError" class="text-danger m-0" role="alert">{{ unlockError }}</p>
    </div>
  </main>
</template>

<style scoped>
.profile-page {
  display: grid; grid-template-columns: minmax(260px, 340px) minmax(0, 1fr); gap: 24px; align-items: start;
  max-width: 1400px; margin: 0 auto; padding: 24px 16px 40px;
}
.eyebrow { color: var(--bark-muted); }
.stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.stat {
  display: flex; flex-direction: column; gap: 2px; padding: 14px 16px;
  background: var(--paper); border: 2px solid var(--linen); border-radius: 14px; box-shadow: 0 4px 0 var(--bark);
}
.logout { padding: 0; border: 0; background: none; text-decoration: underline; }
.logout:hover { color: var(--bark); }

@media (max-width: 767.98px) {
  .profile-page { grid-template-columns: 1fr; }
}
</style>
