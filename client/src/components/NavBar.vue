<script setup>
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import MusicToggle from '@/components/MusicToggle.vue'
import potArt from '@/assets/ui/pot.svg'

// App top bar (journal look): brand, the three places, then streak / coins / music / profile.
// The bottom dock (AppDock) repeats the places as big icons, and is the main nav on phones.
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const NAV_ITEMS = [
  { to: 'journal', label: 'Journal', art: 'journal' },
  { to: 'garden', label: 'Garden', art: 'garden' },
  { to: 'pomodoro', label: 'Focus', art: 'focus' },
]
const current = computed(() => NAV_ITEMS.findIndex((i) => route.matched.some((r) => r.name === i.to)))

// L / R keys cycle through the places (same shortcut as before)
function step(dir) {
  const n = NAV_ITEMS.length
  const next = current.value === -1 ? 0 : (current.value + dir + n) % n
  router.push({ name: NAV_ITEMS[next].to })
}
function onKeydown(event) {
  if (event.target instanceof HTMLElement && (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName) || event.target.isContentEditable)) return
  if (event.metaKey || event.ctrlKey || event.altKey) return
  const key = event.key.toLowerCase()
  if (key === 'l') step(-1)
  if (key === 'r') step(1)
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <header class="topbar" data-testid="navbar">
    <div class="topbar-inner">
      <RouterLink :to="{ name: 'garden' }" class="brand" aria-label="Sproutly, go to your garden">
        <img :src="potArt" alt="" width="38" height="38" />
        <span><span class="brand-name">Sproutly</span><span class="brand-sub">study garden &amp; journal</span></span>
      </RouterLink>

      <ul class="navlinks">
        <li v-for="(item, i) in NAV_ITEMS" :key="item.to">
          <RouterLink
            :to="{ name: item.to }" :aria-current="i === current ? 'page' : undefined"
            :data-testid="`nav-${item.to}`" :title="`${item.label} (L / R to switch)`"
          >{{ item.label }}</RouterLink>
        </li>
      </ul>

      <div class="bar-right">
        <span class="counter" data-testid="nav-streak" :title="`${auth.profile?.streak ?? 0} day streak`">
          🔥 {{ auth.profile?.streak ?? 0 }}
        </span>
        <span class="counter" data-testid="nav-coins" title="Coins">
          <img src="../assets/ui/coin.svg" alt="" width="22" height="22" /> {{ auth.profile?.coins ?? 0 }}
        </span>
        <MusicToggle />
        <RouterLink
          :to="{ name: 'profile' }" class="avatar" aria-label="Profile"
          :aria-current="route.name === 'profile' ? 'page' : undefined" title="Profile &amp; settings"
        >🏡</RouterLink>
      </div>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  position: sticky; top: env(safe-area-inset-top, 0px); z-index: 1030;
  padding: 12px max(16px, env(safe-area-inset-right, 0px)) 0 max(16px, env(safe-area-inset-left, 0px));
  pointer-events: none; /* only the bar itself takes clicks, so the garden behind stays usable */
}
.topbar-inner {
  pointer-events: auto;
  max-width: 1280px; margin: 0 auto;
  display: flex; align-items: center; gap: 18px;
  padding: 8px 10px 8px 14px; border-radius: 999px;
  background: color-mix(in srgb, var(--sheet) 82%, transparent);
  backdrop-filter: blur(14px) saturate(1.2); -webkit-backdrop-filter: blur(14px) saturate(1.2);
  box-shadow: 0 1px 0 rgba(255, 255, 255, .7) inset, var(--shadow-1);
}
.brand { display: inline-flex; align-items: center; gap: 10px; text-decoration: none; color: var(--ink); flex: none; }
.brand img { width: 38px; height: 38px; transition: transform .5s var(--spring); }
.brand:hover img { transform: rotate(-10deg) scale(1.08); }
.brand-name { font-family: var(--f-display); font-style: italic; font-weight: 600; font-size: 1.45rem; line-height: 1; display: block; }
.brand-sub { display: block; font-size: .6rem; font-weight: 800; letter-spacing: .2em; text-transform: uppercase; color: var(--ink-soft); margin-top: 3px; }

.navlinks { display: flex; gap: 4px; margin: 0 auto; padding: 0; list-style: none; }
.navlinks a {
  position: relative; display: block; padding: .45em .95em; border-radius: 999px;
  font-weight: 800; font-size: .78rem; letter-spacing: .1em; text-transform: uppercase;
  color: var(--ink-soft); text-decoration: none; transition: color .2s, background .2s;
}
.navlinks a:hover { color: var(--ink); background: color-mix(in srgb, var(--sheet-2) 80%, transparent); }
.navlinks a[aria-current="page"] { color: var(--berry-deep); }
.navlinks a[aria-current="page"]::after {
  content: ""; position: absolute; left: 50%; bottom: 2px; width: 22px; height: 6px; transform: translateX(-50%);
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 22 6'%3E%3Cpath d='M1 4c4-3 6 1 10-1s6-2 10 0' fill='none' stroke='%23E0546A' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E") no-repeat center/contain;
}

.bar-right { display: flex; align-items: center; gap: 8px; flex: none; margin-left: auto; }
.navlinks + .bar-right { margin-left: 0; }
.counter {
  display: inline-flex; align-items: center; gap: 6px; height: 34px; min-width: 0; padding: 0 12px 0 6px;
  border-radius: 999px; background: var(--sheet-2); border: 1px solid var(--line);
  font-weight: 800; font-size: .85rem; font-variant-numeric: tabular-nums;
}
.avatar {
  width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center;
  background: var(--leaf-soft); border: 2px solid #fff; box-shadow: var(--shadow-1);
  transition: transform .3s var(--spring), box-shadow .2s;
}
.avatar:hover { transform: rotate(-8deg) scale(1.06); }
.avatar[aria-current="page"] { box-shadow: 0 0 0 3px var(--berry); }
.topbar :deep(.music-toggle) { width: 34px; height: 34px; background: var(--sheet-2); border: 1px solid var(--line); box-shadow: none; }
.topbar :deep(.music-toggle.on) { background: var(--leaf-soft); }

@media (max-width: 860px) {
  .navlinks { display: none; }
  .brand-sub { display: none; }
  .topbar-inner { gap: 10px; }
}
@media (max-width: 420px) {
  .counter { padding: 0 8px 0 4px; font-size: .78rem; gap: 3px; }
  .counter :deep(svg) { width: 18px; height: 18px; }
  .brand-name { font-size: 1.2rem; }
  .brand img { width: 32px; height: 32px; }
  .bar-right { gap: 5px; }
}
</style>
