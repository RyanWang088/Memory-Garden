<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGardenStore } from '@/stores/garden'

const route = useRoute()
const router = useRouter()
const garden = useGardenStore()
const loading = ref(true)
const saving = ref(false)
const error = ref('')

const seed = computed(() => garden.seeds.find(item => item.id === route.params.id))

onMounted(async () => {
  try {
    if (!garden.loaded) await garden.fetchSeeds()
    if (!seed.value) error.value = 'This seed could not be found in your garden.'
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
})

async function rate(rating) {
  saving.value = true
  error.value = ''
  try {
    await garden.rateReview(route.params.id, rating)
    await router.push({ name: 'garden' })
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    saving.value = false
  }
}

function backToGarden() {
  router.push({ name: 'garden' })
}
</script>

<template>
  <main class="overlay">
    <section class="bg-light rounded-3 p-4">
      <p v-if="loading" role="status">Loading seed…</p>
      <template v-else-if="seed">
        <h1 >Review {{ seed.title }}</h1>
        <p>{{ seed.subject }} · Mastery {{ seed.mastery }}%</p>
        <p>How well did you remember this study set?</p>
        <div>
          <button class="btn btn-outline-danger" :disabled="saving" data-testid="rate-forgot"
            @click="rate('forgot')">Forgot</button>
          <button class="btn btn-outline-warning" :disabled="saving" data-testid="rate-hard"
            @click="rate('hard')">Hard</button>
          <button class="btn btn-outline-success" :disabled="saving" data-testid="rate-easy"
            @click="rate('easy')">Easy</button>
        </div>
        <p v-if="error" class="text-danger mt-3" role="alert">{{ error }}</p>
        <button type="button" class="btn btn-link mt-3 p-0" :disabled="saving" @click="backToGarden">Back to
          garden</button>
      </template>
      <template v-else>
        <p class="text-danger" role="alert">{{ error }}</p>
        <button type="button" class="btn btn-outline-secondary" @click="backToGarden">Back to garden</button>
      </template>
    </section>
  </main>
</template>
