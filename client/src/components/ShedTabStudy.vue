<script setup>
import { ref, computed } from 'vue'
import { useGardenStore } from '@/stores/garden' // garden.seeds = seeds the user currently has
import SeedCard from './SeedCard.vue'

const emit = defineEmits(['close', 'select'])
const garden = useGardenStore()

const query = ref('')
const libraryView = ref('recommended')
// Highest priority first (deadline + progress, scored by the server), so these match the "!" seeds in the garden.
// Ties: oldest-reviewed first; never reviewed seeds (date 0) come first
const recommended = computed(() =>
  [...garden.seeds]
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0)
      || new Date(a.last_reviewed || 0) - new Date(b.last_reviewed || 0))
    .slice(0, 6)
)

const isSearching = computed(() => query.value.trim() !== '')
const baseSeeds = computed(() => libraryView.value === 'recommended' ? recommended.value : garden.seeds)
const results = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return baseSeeds.value
  return baseSeeds.value.filter((seed) => {
    const tags = Array.isArray(seed.tags) ? seed.tags.map(t => t.name).join(' ') : ''
    return `${seed.title} ${seed.subject} ${tags}`.toLowerCase().includes(q)
  })
})

function setLibraryView(view) {
  libraryView.value = view
}

</script>

<template>
  <section
    class="study-library d-flex flex-column gap-3"
  >
    <header class="study-library-header mb-1">
      <h3 class="m-0">Library</h3>
      <p class="text-body-small m-0">
        {{ libraryView === 'recommended'
          ? 'These seeds need water the most.'
          : "All the seeds you've planted so far." }} Study them now by clicking on the topic of your choice.
      </p>
    </header>

    <div class="segmented-control w-100 d-flex justify-content-center" role="group" aria-label="Choose seeds to browse">
      <button
        type="button"
        class="segmented-tab w-50"
        :class="{ 'is-active': libraryView === 'all' }"
        :aria-pressed="libraryView === 'all'"
        @click="setLibraryView('all')"
      >All</button>
      <button
        type="button"
        class="segmented-tab w-50"
        :class="{ 'is-active': libraryView === 'recommended' }"
        :aria-pressed="libraryView === 'recommended'"
        @click="setLibraryView('recommended')"
      >Recommended</button>
    </div>

    <label class="visually-hidden" for="study-seed-search">Search seeds</label>
    <div class="input-group shadow-sm">
      <input id="study-seed-search" v-model="query" class="form-control border-0 text-body-strong" type="search"
        placeholder="Search planted seeds" />
      <span class="input-group-text border-0" aria-hidden="true">🔍</span>
    </div>

    <div v-if="results.length" class="d-flex flex-column align-items-start gap-3">
      <SeedCard v-for="seed in results" :key="seed.id" :seed="seed" @select="emit('select', $event)" />
    </div>
    <p v-else class="text-danger border-0 text-body-small mb-0">
      {{ isSearching
        ? `No seeds match "${query}" in ${libraryView === 'recommended' ? 'recommended seeds' : 'all seeds'}.`
        : libraryView === 'recommended'
          ? 'No seeds need review right now.'
          : 'No seeds yet. Plant one in your garden to start studying.' }}
    </p>
  </section>
</template>