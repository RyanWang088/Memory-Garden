<script setup>
import { locations } from '@/world/locations'
import { useGameStore } from '@/stores/game'
import Icon from './Icon.vue'

const store = useGameStore()

function go(loc) {
  if (loc.panel) {
    store.open(loc.id, { travel: true })
  } else {
    store.close()
    store.requestTravel(loc.id)
  }
}
</script>

<template>
  <nav class="nav" aria-label="Garden locations" data-testid="navbar">
    <ul class="list">
      <li v-for="loc in locations" :key="loc.id">
        <button
          type="button"
          class="item"
          :class="{ active: store.activeLocation === loc.id }"
          :data-testid="`nav-${loc.id}`"
          :aria-label="loc.label"
          :aria-current="store.activeLocation === loc.id ? 'page' : undefined"
          @click="go(loc)"
        >
          <span class="ic" :style="{ background: loc.color }"><Icon :name="loc.icon" /></span>
          <span class="label">{{ loc.short }}</span>
        </button>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.nav {
  position: fixed;
  z-index: 30;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 8px 8px calc(8px + var(--safe-bottom));
  background: var(--glass);
  border-top: 2px solid #fff;
  border-radius: 22px 22px 0 0;
  box-shadow: var(--shadow);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}
.list {
  display: flex;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
  overflow-x: auto;
  scroll-snap-type: x proximity;
  scrollbar-width: none;
}
.list::-webkit-scrollbar { display: none; }
.list li { flex: 1 0 62px; scroll-snap-align: center; }
.item {
  position: relative;
  width: 100%;
  min-height: 56px;
  border: 0;
  border-radius: 18px;
  background: none;
  padding: 4px 2px 3px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  font: 800 11px var(--font-body);
  color: var(--ink);
  cursor: pointer;
}
.ic {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 13px;
  font-size: 20px;
  color: #fff;
  box-shadow: inset 0 -3px 0 rgba(0, 0, 0, 0.13);
  transition: transform 0.18s var(--ease-spring);
}
.item:hover .ic { transform: translateY(-3px) rotate(-4deg); }
.item:active .ic { transform: scale(0.92); }
.item.active { background: #fff; box-shadow: 0 3px 0 var(--line); }

/* tablet and desktop: a floating dock */
@media (min-width: 720px) {
  .nav {
    left: 50%;
    right: auto;
    bottom: calc(16px + var(--safe-bottom));
    transform: translateX(-50%);
    width: max-content;
    max-width: calc(100% - 32px);
    padding: 7px;
    border: 2px solid #fff;
    border-radius: 26px;
  }
  .list { gap: 4px; }
  .list li { flex: 0 0 auto; }
  .item { width: 84px; min-height: 72px; font-size: 12.5px; gap: 5px; padding: 8px 4px 7px; }
  .ic { width: 40px; height: 40px; font-size: 22px; }
}
</style>
