<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PlantSeedForm from '@/components/PlantSeedForm.vue'
import { useGardenStore } from '@/stores/garden'
import { useToastStore } from '@/stores/toast'

// Edit a planted seed (opened from the Edit button on a Study tab card): the planting form, filled in.
const route = useRoute()
const router = useRouter()
const garden = useGardenStore()
const toast = useToastStore()
const loading = ref(true)
const saving = ref(false)
const error = ref('')

const seed = computed(() => garden.gardenSeeds.find(s => s.id === route.params.id))

onMounted(async () => {
  try {
    if (!garden.loaded) await garden.fetchSeeds()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
})

async function save(details) {
  saving.value = true
  error.value = ''
  try {
    await garden.editSeed(route.params.id, details)
    toast.show({ type: 'success', title: 'Seed updated', message: `${details.title} was saved.` })
    await router.push({ name: 'garden', query: { scrollTo: route.params.id } })
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    saving.value = false
  }
}

function cancel() {
  router.push({ name: 'garden' })
}
</script>

<template>
  <main class="overlay p-0 p-md-4">
    <section class="seed-panel pt-0">
      <p v-if="loading" role="status">Loading your seed…</p>
      <template v-else-if="!seed">
        <p class="text-berry-deep" role="alert">{{ error || 'This seed could not be found in your garden.' }}</p>
        <button type="button" class="btn btn-outline-secondary" @click="cancel">Back to garden</button>
      </template>
      <PlantSeedForm v-else :key="seed.id" :seed="seed" :busy="saving" :error="error" @save="save" @cancel="cancel" />
    </section>
  </main>
</template>

<style scoped>
.seed-panel {
  width: min(720px, 100%);
  max-height: calc(100vh - 48px);
  overflow-y: auto;
  padding: 24px;
  background: var(--sheet);
  border-radius: 10px;
}

@media (max-width: 767.98px) {
  .seed-panel {
    width: 100%;
    height: 100vh;
    height: 100dvh;
    max-height: 100vh;
    max-height: 100dvh;
    border-radius: 0;
  }
}
</style>
