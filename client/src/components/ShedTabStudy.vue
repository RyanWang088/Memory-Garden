<script setup>
import { ref, computed } from 'vue'
import { useGardenStore } from '@/stores/garden' // garden.seeds = seeds the user currently has
import SeedCard from './SeedCard.vue'

const emit = defineEmits(['close', 'select'])
const garden = useGardenStore()

const query = ref('')

// Oldest-reviewed first; never reviewed seeds (date 0) come first
const recommended = computed(() =>
  [...garden.seeds]
    .sort((a, b) => new Date(a.last_reviewed || 0) - new Date(b.last_reviewed || 0))
    .slice(0, 6)
)

const matches = computed(() => {
  const q = query.value.trim().toLowerCase()
  return garden.seeds.filter((seed) => {
    const tags = Array.isArray(seed.tags) ? seed.tags.join(' ') : seed.tags || ''
    return `${seed.title} ${tags}`.toLowerCase().includes(q)
  })
})

const isSearching = computed(() => query.value.trim() !== '')
const results = computed(() => (isSearching.value ? matches.value : recommended.value))
</script>

<template>
  <section class="d-flex flex-column gap-3">
    <header class="d-flex align-items-start justify-content-between gap-2">
      <div>
        <h3 class="mb-1">{{ isSearching ? 'Search results' : 'Recommended' }}</h3>
        <p class="text-body-small mb-0">
          {{ isSearching ? `${results.length} seeds found` : 'These seeds need water the most.' }}
        </p>
      </div>
      <span class="badge text-label-caption flex-shrink-0">{{ results.length }}</span>
    </header>

    <hr class="my-0" />

    <label class="visually-hidden" for="study-seed-search">Search seeds</label>
    <div class="input-group">
      <input id="study-seed-search" v-model="query" class="form-control text-body-strong" type="search"
        placeholder="Search seeds" />
      <span class="input-group-text" aria-hidden="true">🔍</span>
    </div>

    <div v-if="results.length" class="d-flex flex-column align-items-start gap-3">
      <SeedCard v-for="seed in results" :key="seed.id" :seed="seed" @select="emit('select', $event)" />
    </div>
    <p v-else class="text-danger border-0 text-body-small mb-0">
      {{ isSearching ? `No seeds match "${query}".` : 'No seeds yet. Plant one in your garden to start studying.' }}
    </p>
  </section>
</template>