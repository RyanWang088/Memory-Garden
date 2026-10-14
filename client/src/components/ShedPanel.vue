<script setup>
import { useUiStore } from '@/stores/ui'
import ShedTabSeeds from './ShedTabSeeds.vue'
import ShedTabStudy from './ShedTabStudy.vue'
import ShedTabShop from './ShedTabShop.vue'

const ui = useUiStore()

const tabs = [
  { id: 'seeds', label: 'Seeds' },
  { id: 'study', label: 'Study' },
  { id: 'shop', label: 'Equipment' },
]
</script>

<template>
  <div class="shed-slot" :class="{ 'is-collapsed': !ui.shedOpen }">
    <aside class="shed-panel" :class="{ 'is-collapsed': !ui.shedOpen }" data-testid="shed">
      <nav class="shed-overhang-tabs" role="tablist">
        <button
          v-for="t in tabs" :key="t.id" role="tab" class="overhang-tab"
          :class="{ 'is-active': ui.shedTab === t.id }"
          :aria-selected="ui.shedTab === t.id"
          :data-testid="`shed-tab-${t.id}`"
          @click="ui.setShedTab(t.id); ui.shedOpen = true"   <!-- tabs also reopen the shed -->
        >
          <span class="tab-label">{{ t.label }}</span>
        </button>
      </nav>    <!-- Shed Header -->
    <header class="d-flex flex-row justify-content-between">
      <h3>The garden shed</h3>
      <button 
        class="shed-close-btn" 
        aria-label="Toggle shed"
        @click="ui.shedOpen = !ui.shedOpen"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="4" />
          <path d="M15 3v18" />
          <path d="m10 9-3 3 3 3" />
        </svg>
      </button>
    </header>

    <!-- Inner Cream Notebook Card -->
    <main class="shed-notebook-page" role="tabpanel">
      <ShedTabSeeds v-if="ui.shedTab === 'seeds'" />
      <ShedTabStudy v-else-if="ui.shedTab === 'study'" />
      <ShedTabShop v-else />
    </main>
  </aside>
  </div>  
</template>

<style scoped>
.shed-slot {
  --nav-h: 70px;      
  position: relative;
  flex: 0 0 410px;
  width: 410px;
  transition: flex-basis .35s cubic-bezier(.2,.8,.2,1), width .35s cubic-bezier(.2,.8,.2,1);
  z-index: 2;
}
.shed-slot.is-collapsed { flex-basis: 0; width: 0; }

.shed-panel {
  position: absolute;
  top: calc(var(--nav-h) + 12px);
  bottom: 0px;
  left: 0;
  box-sizing: border-box;
  width: 410px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
  color: var(--bark);
  background-color: tan;
  border: 2px solid var(--bark);
  box-shadow: 0px 8px 24px -6px var(--shadow), 0px 2px 4px rgba(107, 74, 58, 0.08);
  overflow: visible;
  user-select: none;

} 

.shed-panel > header {
  flex: 0 0 auto;
}


/* --- OVERHANGING SIDE TABS --- */
.shed-overhang-tabs {
  position: absolute;
  top: 80px;                    /* Aligns near the top of the notebook */
  left: 0;
  transform: translateX(-100%);  /* Projects fully outside the shed's left boundary */
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 5;
}

.overhang-tab {
  border: 2px solid var(--bark);
  background: var(--bark);
  padding: 10px 14px 10px 18px;
  border-radius: 16px 0 0 16px; /* Rounded only on the outside protruding edge */
  font-weight: 500;
  font-size: 15px;
  line-height: 20px;
  color: var(--cream);
  cursor: pointer;
  box-shadow: -4px 4px 8px rgba(107, 74, 58, 0.12);
  transition: transform 0.15s ease, background-color 0.15s ease, color 0.15s ease;
  white-space: nowrap;
}

.overhang-tab:hover {
  transform: translateX(-7px) scale(1.1); /* Cute Animal Crossing "peek" hover */
}

.overhang-tab.is-active {
  background: var(--butter);
  color: var(--bark);
  border-color: var(--bark-muted);
  font-weight: 600;
  box-shadow: -6px 6px 14px rgba(107, 74, 58, 0.16);
  z-index: 6;
}


.shed-close-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px;
  color: var(--bark);
}

.shed-close-btn:hover {
  background: rgba(90, 62, 54, 0.08);
}

/* --- NOTEBOOK PAGE --- */
.shed-notebook-page {
  box-sizing: border-box;
  flex: 1;
  min-height: 0;
  background: var(--cream);
  border: 1px solid var(--linen);
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
    transform: translateY(calc(100% - 56px));
  }

  /* On mobile, move tabs from the side to overhang on TOP of the drawer */
  .shed-overhang-tabs {
    top: 0;
    left: 20px;
    transform: translateY(-100%);
    flex-direction: row;
    gap: 6px;
  }

  .overhang-tab {
    border-bottom: none;
    border-radius: 14px 14px 0 0;
    padding: 8px 14px;
  }

  .overhang-tab.is-active {
    transform: translateY(-4px);
    border-bottom: 2px solid var(--cream);
  }
}
</style>