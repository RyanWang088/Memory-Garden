<script setup>
import { useRoute } from 'vue-router'
// the app's own icons (assets/ui), as in the original nav
const icon = (name) => new URL(`../assets/ui/${name}.svg`, import.meta.url).href

// Bottom dock (journal look): big icon shortcuts, and the main navigation on phones.
const route = useRoute()
const items = [
  { to: 'journal', label: 'Journal', art: 'planner' },
  { to: 'garden', label: 'Garden', art: 'sprout' },
  { to: 'pomodoro', label: 'Focus', art: 'focus' },
  { to: 'profile', label: 'Profile & settings', emoji: '🏡' },
]
const isHere = (name) => route.matched.some((r) => r.name === name)
</script>

<template>
  <nav class="dock" aria-label="Sproutly places" data-testid="dock">
    <span class="dock-tag">Study a little, <b>grow</b> a lot.</span>
    <div class="dock-items">
      <RouterLink
        v-for="item in items" :key="item.to" :to="{ name: item.to }"
        :aria-current="isHere(item.to) ? 'page' : undefined" :aria-label="item.label" :data-testid="`dock-${item.to}`"
      >
        <span v-if="item.emoji" class="dock-art dock-emoji" aria-hidden="true">{{ item.emoji }}</span>
        <img v-else :src="icon(item.art)" alt="" width="30" height="30" class="dock-art" />
        <span class="tip" aria-hidden="true">{{ item.label }}</span>
      </RouterLink>
    </div>
  </nav>
</template>

<style scoped>
.dock {
  position: fixed; z-index: 1030; left: 50%; transform: translateX(-50%);
  bottom: calc(14px + env(safe-area-inset-bottom, 0px));
  display: flex; align-items: center; gap: 14px;
  width: min(1280px, calc(100% - 32px));
  padding: 8px 10px 8px 18px; border-radius: 999px;
  background: color-mix(in srgb, var(--sheet) 86%, transparent);
  backdrop-filter: blur(14px) saturate(1.2); -webkit-backdrop-filter: blur(14px) saturate(1.2);
  box-shadow: var(--shadow-1);
}
.dock-tag { font-family: var(--f-hand); font-size: 1.35rem; color: var(--ink-soft); margin-right: auto; white-space: nowrap; }
.dock-tag b { color: var(--berry); font-weight: 700; }
.dock-items { display: flex; gap: 6px; }
.dock-items a {
  position: relative; width: 46px; height: 46px; border-radius: 50%;
  display: grid; place-items: center; text-decoration: none; color: var(--ink-soft);
  transition: transform .3s var(--spring), background .2s;
}
.dock-emoji { font-size: 24px; line-height: 1; }
.dock-art { transition: transform .35s var(--spring); }
.dock-items a:hover { background: var(--sheet-2); }
.dock-items a:hover .dock-art { transform: scale(1.18) rotate(-8deg); }
.dock-items a[aria-current="page"] { background: var(--berry-soft); }
.dock-items a[aria-current="page"]::after { content: ""; position: absolute; bottom: 3px; width: 5px; height: 5px; border-radius: 50%; background: var(--berry); }
.dock-items a .tip {
  position: absolute; bottom: calc(100% + 8px); left: 50%; transform: translate(-50%, 6px) scale(.8);
  padding: .2em .65em; border-radius: 8px; background: var(--ink); color: var(--sheet);
  font-size: .72rem; font-weight: 800; white-space: nowrap; opacity: 0; pointer-events: none;
  transition: opacity .2s, transform .3s var(--spring);
}
.dock-items a:hover .tip, .dock-items a:focus-visible .tip { opacity: 1; transform: translate(-50%, 0) scale(1); }
@media (max-width: 860px) {
  .dock-tag { display: none; }
  .dock { width: auto; padding: 6px 8px; gap: 0; }
  .dock-items { gap: 2px; }
}
</style>
