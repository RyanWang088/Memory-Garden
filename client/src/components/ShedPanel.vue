<script setup>
import { useUiStore } from '@/stores/ui'
import { useToastStore } from '@/stores/toast'
import ShedTabSeeds from './ShedTabSeeds.vue'
import ShedTabStudy from './ShedTabStudy.vue'
import ShedTabShop from './ShedTabShop.vue'

const ui = useUiStore()
const toast = useToastStore()

const tabs = [
  { id: 'seeds', label: 'Seeds', img: 'seed' },
  { id: 'study', label: 'Study', img: 'wateringCanIcon' },
  { id: 'shop', label: 'Supplies', img: 'shop' },
  { id: 'weed', label: 'Weed', img: 'shovel', action: true },
]

const icon = (name) => new URL(`../assets/ui/${name}.svg`, import.meta.url).href

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
}
</script>

<template>
  <div class="shed-slot" :class="{ 'is-collapsed': !ui.shedOpen }">
    <aside class="shed-panel" :class="{ 'is-collapsed': !ui.shedOpen }" data-testid="shed">
      <nav class="shed-overhang-tabs" role="tablist">
        <button
          v-for="t in tabs" :key="t.id" class="overhang-tab justify-content-center"
          :class="{ 'is-active': t.action ? ui.activeTool === 'shovel' : ui.shedTab === t.id }"
          :role="t.action ? 'button' : 'tab'"
          :aria-selected="t.action ? undefined : ui.shedTab === t.id"
          :aria-label="t.label"
          :data-testid="`shed-tab-${t.id}`"
          @click="selectTab(t.id)"
        >
          <span class="navlabel text-label-caption text-capitalize badge rounded-pill">{{ t.label }}</span>
          <img :src="icon(t.img)" alt="" />
        </button>
      </nav>

    <!-- Inner Cream Notebook Card -->
    <main class="shed-notebook-page" role="tabpanel">
      <ShedTabSeeds v-if="ui.shedTab === 'seeds'" />
      <ShedTabStudy v-else-if="ui.shedTab === 'study'" @select="onSeedSelect" />
      <ShedTabShop v-else />
    </main>
  </aside>
  </div>  
</template>

<style scoped>
.shed-slot {
  position: relative;
  flex: 0 0 410px;
  width: 410px;
  z-index: 2;
}
.shed-slot.is-collapsed { flex-basis: 0; width: 0; }

@media (min-width: 768px) {
  .shed-slot { order: -1; }
}

.shed-panel {
  position: absolute;
  top: 0;
  bottom: 0px;
  left: 0;
  box-sizing: border-box;
  width: 410px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  color: var(--bark);
  box-shadow: 0px 8px 24px -6px var(--shadow), 0px 2px 4px var(--shadow);
  overflow: visible;
  user-select: none;
  transition: transform .35s cubic-bezier(.2,.8,.2,1);

} 
.shed-panel.is-collapsed { transform: translateX(-100%); }

.shed-panel > header {
  flex: 0 0 auto;
}


/* --- OVERHANGING SIDE TABS --- */
.shed-overhang-tabs {
  position: absolute;
  top: 100px;
  right: 1px;
  transform: translateX(100%);
  display: flex;
  flex-direction: column;
  gap: 30px;
  z-index: 5;
}

.overhang-tab {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 70px;
  height: 70px;
  border: none;
  background: var(--linen);
  padding: 0;
  border-radius: 0 100px 100px 0;
  cursor: pointer;
}

.overhang-tab img {
  display: block;
  width: 40px;
  height: 40px;
  object-fit: contain;
  transition: transform .35s var(--spring);
}
.overhang-tab.is-active {background-color: var(--cream);}
.overhang-tab:hover img { transform: scale(1.35) rotate(-6deg); }
.overhang-tab.is-active img { transform: scale(1.3); animation: boing .5s var(--spring); }
.overhang-tab:active img { transform: scale(.9); }

.overhang-tab:hover .navlabel,
.overhang-tab:focus-visible .navlabel,
.overhang-tab.is-active .navlabel {
  opacity: 1;
  transform: translate(-50%, -4px) scale(1);
}


/* --- NOTEBOOK PAGE --- */
.shed-notebook-page {
  box-sizing: border-box;
  flex: 1;
  min-height: 0;
  background: var(--cream);
  border-radius: var(--radius-page, 12px);
  padding: 20px;
  overflow-y: auto; /* Inner page still scrolls cleanly */
}

/* --- MOBILE RESPONSIVENESS --- */
@media (max-width: 767.98px) {
  .shed-panel {
    position: fixed;
    inset: auto 0 0 0;
    width: 100%;
    height: 65vh;
    border-radius: 24px 24px 0 0;
    z-index: 100;
    transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  .shed-slot { flex: 0 0 0; width: 0; transition: none; }
  .shed-panel.is-collapsed {
    transform: translateY(100%);
  }

  /* On mobile, move tabs from the side to overhang on TOP of the drawer */
  .shed-overhang-tabs {
    top: 0;
    left: 50%;
    right: auto;
    transform: translate(-50%, -99%);
    flex-direction: row;
    gap: 8px;
  }
  .overhang-tab {
    border-radius: 100px 100px 0 0;
  }
}

@keyframes boing {
  0%   { transform: scale(.8) rotate(-10deg); }
  60%  { transform: scale(1.45) rotate(6deg); }
  100% { transform: scale(1.3) rotate(0); }
}
</style>