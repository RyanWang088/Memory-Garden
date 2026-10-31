<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useGardenStore } from '@/stores/garden' // garden.gardenSeeds = seeds still in the garden
import SeedCard from './SeedCard.vue'

const emit = defineEmits(['close', 'select', 'edit'])
const garden = useGardenStore()
const route = useRoute()

const query = ref(typeof route.query.q === 'string' ? route.query.q : '')
const libraryView = ref('recommended')
watch(() => route.query.q, (value) => {
  query.value = typeof value === 'string' ? value : ''
})
// The API marks recommended seeds with alert and provides their priority score.
const recommended = computed(() =>
  garden.gardenSeeds
    .filter(seed => seed.alert)
    .sort((a, b) => b.priority - a.priority)
)

const isSearching = computed(() => query.value.trim() !== '')
const baseSeeds = computed(() => libraryView.value === 'recommended' ? recommended.value : garden.gardenSeeds)
const results = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return baseSeeds.value
  return garden.gardenSeeds.filter((seed) => {
    const tags = Array.isArray(seed.tags) ? seed.tags.map(t => t.name).join(' ') : ''
    return `${seed.title} ${seed.subject} ${tags}`.toLowerCase().includes(q)
  })
})

const VIEWS = ['all', 'recommended']
const viewIndex = computed(() => VIEWS.indexOf(libraryView.value))
function setLibraryView(view) {
  libraryView.value = view
}
</script>

<template>
  <section class="shed-study" data-testid="shed-study">
    <header class="d-grid gap-2 pb-3 border-bottom">
      <span class="sp-eyebrow">Library</span>
      <h3 class="m-0 fs-3">Water your <em>seeds</em></h3>
      <p class="small text-body-secondary m-0">
        {{ libraryView === 'recommended' ? 'These seeds are the thirstiest.' : 'Every seed you’ve planted so far.' }} Tap one to review it!
      </p>
    </header>

      <div class="sp-seg study-seg" role="group" aria-label="Choose seeds to browse">
        <span class="sp-seg-thumb" :style="{ width: 'calc((100% - 8px) / 2)', transform: `translateX(${viewIndex * 100}%)` }"></span>
        <button type="button" :aria-pressed="libraryView === 'all'" @click="setLibraryView('all')">All</button>
        <button type="button" :aria-pressed="libraryView === 'recommended'" @click="setLibraryView('recommended')">
          Recommended<span v-if="recommended.length" class="count">{{ recommended.length }}</span>
        </button>
      </div>
<!-- delete extra bloat class ltr -->
      <label class="sp-search mb-2" for="study-seed-search">
        <span class="sr-only">Search planted seeds</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
        <input id="study-seed-search" v-model="query" class="sp-input" type="search" placeholder="Search planted seeds" autocomplete="off" />
        <button v-if="isSearching" type="button" class="clear" aria-label="Clear search" @click="query = ''">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </label>

    <p v-if="isSearching && results.length" class="sp-hand results-note" aria-live="polite">
      {{ results.length }} seed{{ results.length === 1 ? '' : 's' }} match “{{ query.trim() }}”
    </p>

    <TransitionGroup v-if="results.length" tag="div" name="seed" class="seed-list">
      <div v-for="(seed, n) in results" :key="seed.id" class="seed-item">
        <SeedCard class="sp-reveal" :style="{ '--i': Math.min(n, 6) }" :seed="seed" @select="emit('select', $event)" @edit="emit('edit', $event)" />
      </div>
    </TransitionGroup>
    <p v-else class="text-danger border-0 text-body-small ms-1">
      {{ isSearching
        ? `No seeds match "${query}".`
        : libraryView === 'recommended'
          ? 'No seeds need review right now.'
          : 'No seeds yet. Plant one in your garden to start studying.' }}
    </p>
  </section>
</template>

<style scoped>
.study-seg { display: grid; width: 100%; }
.study-seg .count { margin-left: .45em; padding: 0 .55em; border-radius: var(--r-pill); background: var(--berry); color: var(--paper); font-size: .7rem; font-variant-numeric: tabular-nums; }
.sp-search .clear { position: absolute; right: 10px; top: 50%; width: 28px; height: 28px; margin-top: -14px; display: grid; place-items: center; border: 0; border-radius: 50%; background: var(--sheet-2); color: var(--ink-soft); animation: pop-in .3s var(--spring); transition: background .2s, color .2s, transform .25s var(--spring); }
.sp-search .clear:hover { background: var(--berry-soft); color: var(--berry-deep); transform: rotate(90deg); }
.results-note { margin: 0 0 var(--s-3); font-size: 1.15rem; color: var(--ink-soft); }

.seed-list { position: relative; display: flex; flex-direction: column; gap: 14px; padding-bottom: var(--s-4); }
.seed-move { transition: transform .45s var(--ease); }
.seed-leave-active { position: absolute; left: 0; right: 0; transition: opacity .2s, transform .3s var(--ease); }
.seed-leave-to { opacity: 0; transform: translateX(-22px); }
</style>