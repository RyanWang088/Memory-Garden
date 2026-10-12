<script setup>
import { useUiStore } from '@/stores/ui'
import ShedTabSeeds from './ShedTabSeeds.vue'
import ShedTabStudy from './ShedTabStudy.vue'
import ShedTabShop from './ShedTabShop.vue'

// Notebook-style tabs, wooden texture. Texture slots to add later: "shed-wood-panel", "shed-tab-wood".
const ui = useUiStore()
const tabs = [
  { id: 'seeds', label: 'Seeds' },
  { id: 'study', label: 'Study' },
  { id: 'shop', label: 'Shop' },
]
</script>

<template>
  <aside class="shed" :class="{ collapsed: !ui.shedOpen }" data-testid="shed">
    <button class="shed-toggle d-md-none btn btn-sm btn-dark" @click="ui.shedOpen = !ui.shedOpen">
      {{ ui.shedOpen ? 'Hide shed' : 'Open shed' }}
    </button>

    <div class="shed-tabs" role="tablist">
      <button
        v-for="t in tabs" :key="t.id" role="tab"
        class="shed-tab" :class="{ active: ui.shedTab === t.id }"
        :aria-selected="ui.shedTab === t.id" :data-testid="`shed-tab-${t.id}`"
        @click="ui.setShedTab(t.id)"
      >{{ t.label }}</button>
    </div>

    <div class="shed-page" role="tabpanel">
      <ShedTabSeeds v-if="ui.shedTab === 'seeds'" />
      <ShedTabStudy v-else-if="ui.shedTab === 'study'" />
      <ShedTabShop v-else />
    </div>
  </aside>
</template>

<style scoped>
.shed { background: var(--mint); color: var(--paper); display: flex; flex-direction: column; padding: 8px; min-height: 0; }
.shed-tabs { display: flex; gap: 4px; }
.shed-tab { border: 0; padding: 6px 14px; background: var(--bark-muted); color: var(--cream); border-radius: 6px 6px 0 0; }
.shed-tab.active { background: var(--bark); color:var(--butter); }
.shed-page { background: var(--cream); color: var(--bark); flex: 1; padding: 12px; overflow-y: auto; border-radius: 0 6px 6px 6px; }

/* Mobile: the shed becomes a bottom drawer */
@media (max-width: 767.98px) {
  .shed { position: fixed; inset: auto 0 0 0; height: 45vh; z-index: 10; }
  .shed.collapsed { height: 44px; }
  .shed.collapsed .shed-tabs, .shed.collapsed .shed-page { display: none; }
}
</style>
