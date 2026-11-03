<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PlantSeedForm from '@/components/PlantSeedForm.vue'
import { useGardenStore } from '@/stores/garden'
import { useUiStore } from '@/stores/ui'
import { SEED_COLORS } from '@/lib/tagColors'

const route = useRoute()
const router = useRouter()
const garden = useGardenStore()
const ui = useUiStore()
const selectedColor = computed(() =>
  typeof route.query.color === 'string' && SEED_COLORS.includes(route.query.color)
    ? route.query.color
    : ui.selectedSeedColor,
)
const selectedFlower = computed(() =>
  typeof route.query.flower === 'string' ? route.query.flower : ui.selectedSeedFlower,
)
const saving = ref(false)
const loading = ref(true)
const error = ref('')

const col = computed(() => Number(route.params.col))
const row = computed(() => Number(route.params.row))
const validLocation = computed(() =>
  Number.isInteger(col.value) && col.value >= 0 && col.value < 15
  && Number.isInteger(row.value) && row.value >= 0 && row.value < 20,
)

onMounted(async () => {
  if (!validLocation.value) {
    error.value = 'Choose a valid garden spot before planting a seed.'
    loading.value = false
    return
  }

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
    const seed = await garden.plantSeed({
      ...details,
      col: col.value,
      row: row.value,
      color: selectedColor.value,
      flower: selectedFlower.value,
    })
    await router.push({ name: 'garden', query: { planted: seed.id, scrollTo: seed.id } })
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
  <main class="overlay">
    <section class="seed-panel pt-0">
      <p v-if="loading" role="status">Loading your garden…</p>
      <template v-else-if="error && !validLocation">
        <p class="text-berry-deep" role="alert">{{ error }}</p>
        <button type="button" class="btn btn-outline-secondary" @click="cancel">Back to garden</button>
      </template>
      <p v-else-if="error && !garden.loaded" class="text-berry-deep" role="alert">{{ error }}</p>
      <PlantSeedForm v-else :busy="saving" :error="error" :flower="selectedFlower" :color="selectedColor" @save="save" @cancel="cancel" />
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
  border: 2px solid var(--ink);
  border-radius: 10px;
}
</style>
