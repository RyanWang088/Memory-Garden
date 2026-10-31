<script setup>
import { useRouter } from 'vue-router'
import { useUiStore } from '@/stores/ui'
import { useToastStore } from '@/stores/toast'
import ShedTabSeeds from './ShedTabSeeds.vue'
import ShedTabStudy from './ShedTabStudy.vue'

// the shed's own tab pictures (assets/ui), as in the original garden
const icon = (name) => new URL(`../assets/ui/${name}.svg`, import.meta.url).href

const ui = useUiStore()
const toast = useToastStore()
const router = useRouter()

const tabs = [
  { id: 'seeds', label: 'Seeds', img: 'seed' },
  { id: 'study', label: 'Study', img: 'wateringCanIcon' },
  { id: 'weed', label: 'Weed', img: 'shovel', action: true },
]

function selectTab(tabId) {
  if (tabId==='weed') {
    ui.setTool('shovel')
    ui.shedOpen=false
    toast.show({
      type: 'success',
      title: 'Shovel Equipped',
      message: 'Hover over or tap a plant to delete the flashcards.',
    })
    return
  }

  const isCurrentTab = tabId === ui.shedTab
  ui.setShedTab(tabId)
  if (isCurrentTab) {
    ui.shedOpen = !ui.shedOpen
    return
  }
  ui.shedOpen = true
}

function onSeedSelect(seed) {
  ui.shedOpen = false
  ui.selectGardenSeed(seed.id)
  router.push({ name: 'garden', query: { scrollTo: seed.id } })
}

function onSeedEdit(seed) {
  ui.shedOpen = false
  router.push({ name: 'seed-edit', params: { id: seed.id } })
}
</script>

<template>
  <!-- Garden shed (journal look): a paper card resting over the garden, with folder tabs on its left side.
       Closed, the tabs stay attached to the right edge of the screen. On phones the open tabs sit on top. -->
  <aside class="shed-panel" :class="{ 'is-collapsed': !ui.shedOpen }" data-testid="shed">
    <nav class="shed-tabs" role="tablist" aria-label="Garden shed">
      <button
        v-for="t in tabs" :key="t.id" type="button" class="shed-tab"
        :class="{ 'is-active': ui.shedOpen && (t.action ? ui.activeTool === 'shovel' : ui.shedTab === t.id), 'is-tool': t.action }"
        :role="t.action ? 'button' : 'tab'"
        :aria-selected="t.action ? undefined : ui.shedTab === t.id"
        :aria-pressed="t.action ? ui.activeTool === 'shovel' : undefined"
        :aria-label="t.label"
        :data-testid="`shed-tab-${t.id}`"
        @click="selectTab(t.id)"
      >
        <img :src="icon(t.img)" alt="" width="30" height="30" class="tab-art" />
        <span class="tab-label">{{ t.label }}</span>
      </button>
    </nav>

    <main class="shed-notebook-page" role="tabpanel">
      <span class="sp-tape is-leaf shed-tape" aria-hidden="true"></span>
      <ShedTabSeeds v-if="ui.shedTab === 'seeds'" />
      <ShedTabStudy v-else @select="onSeedSelect" @edit="onSeedEdit" />
    </main>
  </aside>
</template>

<style scoped>
.shed-panel {
  --shed-w: 392px;
  position: fixed; z-index: 20;
  top: 84px; bottom: 15px; right: 16px;
  display: flex; align-items: flex-start; min-height: 0;
  color: var(--ink); user-select: none;
  pointer-events: none;
  transition: transform .4s var(--spring);
}
.shed-panel > * { pointer-events: auto; }

/* folder tabs: down the left side of the card; --t is how far a tab sits tucked behind it */
.shed-tabs { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; padding-top: 14px; position: relative; z-index: 2; }
.shed-tab {
  --t: 6px;
  display: grid; justify-items: center; gap: 1px; min-width: 66px; padding: 7px 10px 6px;
  border: 0; border-radius: 14px 0 0 14px; background: color-mix(in srgb, var(--sheet-3) 92%, transparent);
  color: var(--ink-soft); font-weight: 800; font-size: .62rem; letter-spacing: .12em; text-transform: uppercase;
  transform: translate(var(--t), 0); transition: transform .25s var(--spring), background .2s, color .2s;
  backdrop-filter: blur(6px);
}
.shed-tab:hover { --t: 2px; color: var(--ink); }
.shed-tab.is-active { --t: 0px; background: var(--sheet); color: var(--berry-deep); box-shadow: -4px -4px 12px -6px rgba(74, 54, 46, .35); }
.shed-tab.is-tool.is-active { background: var(--butter-soft); color: var(--ink); }
.shed-tab:focus-visible { outline: 3px solid var(--leaf); outline-offset: 2px; }
.tab-art { transition: transform .35s var(--spring); }
.shed-tab:hover .tab-art { transform: scale(1.15) rotate(-6deg); }
.shed-tab.is-active .tab-art { animation: boing .5s var(--spring); }

/* the paper card */
.shed-notebook-page {
  position: relative; flex: none; align-self: stretch; width: var(--shed-w); min-height: 0; overflow-y: auto; overscroll-behavior: contain;
  padding: 22px 20px 20px; border-radius: 22px;
  background: var(--sheet); box-shadow: var(--shadow-2);
  scrollbar-gutter: stable;
  transition: visibility 0s linear 0s;
}
.shed-notebook-page::after { content: ""; position: absolute; inset: 0; border-radius: inherit; background-image: var(--grain); opacity: .12; mix-blend-mode: multiply; pointer-events: none; }
.shed-tape { top: 6px; right: 26px; transform: rotate(4deg); position: absolute; }

/* closed: the panel slides off to the right until only the tabs remain, flat side against the screen edge */
.shed-panel.is-collapsed { transform: translateX(calc(var(--shed-w) + 16px)); transition: transform .3s var(--ease); }
.shed-panel.is-collapsed .shed-notebook-page { visibility: hidden; transition: visibility 0s linear .3s; }
.shed-panel.is-collapsed .shed-tab { --t: 0px; border-radius: 14px 0 0 14px; box-shadow: var(--shadow-1); }

/* phones: a sheet running down behind the dock, open tabs on its top edge */
@media (max-width: 767.98px) {
  .shed-panel { top: auto; left: 8px; right: 8px; bottom: 8px; height: calc(min(56vh, 520px) + var(--dock-h) + 14px); flex-direction: column; align-items: stretch; }
  .shed-panel:not(.is-collapsed) .shed-tabs { flex-direction: row; align-items: flex-end; justify-content: center; padding: 0 8px; }
  .shed-panel:not(.is-collapsed) .shed-tab { border-radius: 14px 14px 0 0; transform: translate(0, var(--t)); }
  .shed-notebook-page { flex: 1; width: auto; padding: 18px 14px calc(var(--dock-h) + 14px); }
  .shed-panel.is-collapsed { left: auto; right: 0; top: 84px; bottom: auto; height: auto; transform: none; }
  .shed-panel.is-collapsed .shed-notebook-page { display: none; }
}

@keyframes boing {
  0%   { transform: scale(.8) rotate(-10deg); }
  60%  { transform: scale(1.25) rotate(6deg); }
  100% { transform: scale(1) rotate(0); }
}
</style>