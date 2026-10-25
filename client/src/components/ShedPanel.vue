<script setup>
import { useRouter } from 'vue-router'
import { useUiStore } from '@/stores/ui'
import { useToastStore } from '@/stores/toast'
import ShedTabSeeds from './ShedTabSeeds.vue'
import ShedTabStudy from './ShedTabStudy.vue'
import ShedTabShop from './ShedTabShop.vue'

// the shed's own tab pictures (assets/ui), as in the original garden
const icon = (name) => new URL(`../assets/ui/${name}.svg`, import.meta.url).href

const ui = useUiStore()
const toast = useToastStore()
const router = useRouter()

const tabs = [
  { id: 'seeds', label: 'Seeds', img: 'seed' },
  { id: 'study', label: 'Study', img: 'wateringCanIcon' },
  { id: 'shop', label: 'Supplies', img: 'shop' },
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
  if (window.matchMedia('(max-width: 767.98px)').matches) ui.shedOpen = false
  ui.selectGardenSeed(seed.id)
  router.push({ name: 'garden', query: { scrollTo: seed.id } })
}
</script>

<template>
  <!-- Garden shed (journal look): a paper card on the right with folder tabs on top.
       Same tabs, same ui store state; collapsing hides the card and leaves the tabs. -->
  <div class="shed-slot" :class="{ 'is-collapsed': !ui.shedOpen }">
    <aside class="shed-panel" :class="{ 'is-collapsed': !ui.shedOpen }" data-testid="shed">
      <nav class="shed-tabs" role="tablist" aria-label="Garden shed">
        <button
          v-for="t in tabs" :key="t.id" type="button" class="shed-tab"
          :class="{ 'is-active': t.action ? ui.activeTool === 'shovel' : ui.shedTab === t.id && ui.shedOpen, 'is-tool': t.action }"
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
        <button type="button" class="shed-fold" :aria-label="ui.shedOpen ? 'Fold the shed away' : 'Open the shed'" @click="ui.shedOpen = !ui.shedOpen">
          <span aria-hidden="true">{{ ui.shedOpen ? '–' : '+' }}</span>
        </button>
      </nav>

      <main class="shed-notebook-page" role="tabpanel">
        <span class="sp-tape is-leaf shed-tape" aria-hidden="true"></span>
        <ShedTabSeeds v-if="ui.shedTab === 'seeds'" />
        <ShedTabStudy v-else-if="ui.shedTab === 'study'" @select="onSeedSelect" />
        <ShedTabShop v-else />
      </main>
    </aside>
  </div>
</template>

<style scoped>
/* desktop: the slot keeps room for the card on the right so the meadow isn't hidden behind it */
.shed-slot { position: relative; flex: 0 0 420px; width: 420px; z-index: 2; transition: flex-basis .35s var(--ease), width .35s var(--ease); }
.shed-slot.is-collapsed { flex-basis: 0; width: 0; }

.shed-panel {
  position: fixed; z-index: 20;
  top: 84px; bottom: calc(var(--dock-h) + 30px); right: 16px; width: 392px;
  display: flex; flex-direction: column; min-height: 0;
  color: var(--ink); user-select: none;
  pointer-events: none;
}
.shed-panel > * { pointer-events: auto; }

/* folder tabs */
.shed-tabs { display: flex; align-items: flex-end; gap: 4px; padding: 0 14px; position: relative; z-index: 2; }
.shed-tab {
  display: grid; justify-items: center; gap: 1px; min-width: 66px; padding: 7px 10px 6px;
  border: 0; border-radius: 14px 14px 0 0; background: color-mix(in srgb, var(--sheet-3) 92%, transparent);
  color: var(--ink-soft); font-weight: 800; font-size: .62rem; letter-spacing: .12em; text-transform: uppercase;
  transform: translateY(6px); transition: transform .25s var(--spring), background .2s, color .2s;
  backdrop-filter: blur(6px);
}
.shed-tab:hover { transform: translateY(2px); color: var(--ink); }
.shed-tab.is-active { background: var(--sheet); color: var(--berry-deep); transform: translateY(0); box-shadow: 0 -4px 12px -6px rgba(74, 54, 46, .35); }
.shed-tab.is-tool.is-active { background: var(--butter-soft); color: var(--ink); }
.shed-tab:focus-visible { outline: 3px solid var(--leaf); outline-offset: 2px; }
.tab-art { transition: transform .35s var(--spring); }
.shed-tab:hover .tab-art { transform: scale(1.15) rotate(-6deg); }
.shed-tab.is-active .tab-art { animation: boing .5s var(--spring); }
.shed-fold {
  margin-left: auto; align-self: center; width: 32px; height: 32px; border-radius: 50%;
  border: 1px solid var(--line); background: color-mix(in srgb, var(--sheet) 85%, transparent); color: var(--ink-soft);
  display: grid; place-items: center; transform: translateY(2px); transition: transform .2s var(--spring);
}
.shed-fold:hover { transform: translateY(0) rotate(-8deg); color: var(--ink); }

/* the paper card */
.shed-notebook-page {
  position: relative; flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain;
  padding: 22px 20px 20px; border-radius: 22px;
  background: var(--sheet); box-shadow: var(--shadow-2);
  scrollbar-gutter: stable;
  transform-origin: top right;
  transition: opacity .25s ease, transform .4s var(--spring), visibility 0s linear 0s;
}
.shed-notebook-page::after { content: ""; position: absolute; inset: 0; border-radius: inherit; background-image: var(--grain); opacity: .12; mix-blend-mode: multiply; pointer-events: none; }
.shed-tape { top: 6px; right: 26px; transform: rotate(4deg); position: absolute; }
.shed-panel.is-collapsed .shed-notebook-page { opacity: 0; transform: translateY(-10px) scale(.96); visibility: hidden; transition: opacity .2s ease, transform .3s var(--ease), visibility 0s linear .3s; }
.shed-panel.is-collapsed .shed-tab { transform: translateY(0); box-shadow: var(--shadow-1); border-radius: 14px; }

/* phones: a sheet that rises from above the dock, tabs on its top edge */
@media (max-width: 767.98px) {
  .shed-slot { flex: 0 0 0; width: 0; }
  .shed-panel { top: auto; left: 8px; right: 8px; width: auto; bottom: calc(var(--dock-h) + 22px); height: min(56vh, 520px); }
  .shed-tabs { justify-content: center; padding: 0 8px; }
  .shed-tab { min-width: 0; flex: 1; padding: 6px 4px 5px; font-size: .56rem; }
  .shed-notebook-page { padding: 18px 14px 14px; }
  .shed-panel.is-collapsed { height: auto; }
  .shed-panel.is-collapsed .shed-notebook-page { display: none; }
}

@keyframes boing {
  0%   { transform: scale(.8) rotate(-10deg); }
  60%  { transform: scale(1.25) rotate(6deg); }
  100% { transform: scale(1) rotate(0); }
}
</style>
