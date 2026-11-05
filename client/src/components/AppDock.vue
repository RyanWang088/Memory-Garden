<script setup>
import { useRoute } from 'vue-router'
// the app's own icons (assets/ui), as in the original nav
const icon = (name) => new URL(`../assets/ui/${name}.svg`, import.meta.url).href

// Bottom dock (journal look): the main navigation on phones only (hidden from md up).
const route = useRoute()
const items = [
  { to: 'planner', label: 'Planner', art: 'planner' },
  { to: 'garden', label: 'Garden', art: 'sprout' },
  { to: 'pomodoro', label: 'Focus', art: 'focus' },
  { to: 'profile', label: 'Profile & settings', art: 'house', avatar: true },
]
const isHere = (name) => route.matched.some((r) => r.name === name)
</script>

<template>
  <nav class="dock position-fixed start-50 translate-middle-x d-flex d-md-none gap-1 rounded-pill" aria-label="Sproutly places" data-testid="dock">
    <RouterLink
      v-for="item in items" :key="item.to" :to="{ name: item.to }"
      class="position-relative d-flex justify-content-center align-items-center rounded-circle text-decoration-none"
      :class="{ 'has-avatar': item.avatar }"
      :aria-current="isHere(item.to) ? 'page' : undefined" :aria-label="item.label" :data-testid="`dock-${item.to}`"
    >
      <span v-if="item.avatar" class="dock-art dock-avatar" aria-hidden="true"><img :src="icon(item.art)" alt="" width="22" height="22" /></span>
      <img v-else :src="icon(item.art)" alt="" width="30" height="30" class="dock-art" />
      <span class="tip" aria-hidden="true">{{ item.label }}</span>
    </RouterLink>
  </nav>
</template>

<style scoped>
.dock {
  z-index: 1030; bottom: calc(14px + env(safe-area-inset-bottom, 0px));
  padding: 6px 8px;
  background: color-mix(in srgb, var(--sheet) 82%, transparent);
  backdrop-filter: blur(14px) saturate(1.2); -webkit-backdrop-filter: blur(14px) saturate(1.2);
  box-shadow: var(--shadow-1);
}
.dock a { width: 46px; height: 46px; color: var(--ink-soft); transition: transform .3s var(--spring), background .2s; }
/* same green badge as the top bar's profile button (NavBar .avatar) */
.dock-avatar {
  display: grid; place-items: center; width: 38px; height: 38px; border-radius: 50%;
  background: var(--leaf-soft); border: 2px solid #fff; box-shadow: var(--shadow-1);
}
.dock-art { transition: transform .35s var(--spring); }
.dock a:hover { background: var(--sheet-2); }
.dock a:hover .dock-art { transform: scale(1.18) rotate(-8deg); }
.dock a[aria-current="page"] { background: var(--berry-soft); }
.dock a[aria-current="page"]::after { content: ""; position: absolute; bottom: 3px; width: 5px; height: 5px; border-radius: 50%; background: var(--berry); }
.dock a.has-avatar[aria-current="page"] { background: none; }
.dock a.has-avatar[aria-current="page"]::after { content: none; }
.dock a[aria-current="page"] .dock-avatar { box-shadow: 0 0 0 3px var(--berry); }
.dock a .tip {
  position: absolute; bottom: calc(100% + 8px); left: 50%; transform: translate(-50%, 6px) scale(.8);
  padding: .2em .65em; border-radius: 8px; background: var(--ink); color: var(--sheet);
  font-size: .72rem; font-weight: 800; white-space: nowrap; opacity: 0; pointer-events: none;
  transition: opacity .2s, transform .3s var(--spring);
}
.dock a:hover .tip, .dock a:focus-visible .tip { opacity: 1; transform: translate(-50%, 0) scale(1); }
</style>