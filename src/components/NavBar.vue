<script setup>
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const items = [
  { to: 'journal', label: 'Journal', art: 'nav-journal' },
  { to: 'garden', label: 'Garden', art: 'sprout' },
  { to: 'pomodoro', label: 'Focus', art: 'nav-focus' },
]

const icon = (name) => new URL(`../assets/ui/${name}.svg`, import.meta.url).href
const current = computed(() => items.findIndex((i) => i.to === route.name))

// cycles within the peas only
function step(dir) {
  const n = items.length
  const next = current.value === -1 ? 0 : (current.value + dir + n) % n
  router.push({ name: items[next].to })
}

function onKeydown(event) {
  if (event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) {
    return
  }

  const key = event.key.toLowerCase()
  if (key === 'l') step(-1)
  if (key === 'r') step(1)
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <nav class="navbar d-flex align-items-start px-3 pt-4" data-testid="navbar">
    <!-- left: logo (hidden on mobile)might swap to profile -->
    <div class="side d-flex justify-content-start">
      <span class="logo d-none d-md-block">logo?</span>
    </div>

    <!-- center: peas + L/R chips -->
    <div class="cluster position-relative">
      <ul class="peas list-unstyled d-flex align-items-center m-0 p-0">
        <RouterLink
          v-for="item in items" :key="item.to" :to="{ name: item.to }"
          custom v-slot="{ href, navigate, isActive }"
        >
          <li class="pea" :class="{ active: isActive }">
            <a
              :href="href" :aria-label="item.label"
              :aria-current="isActive ? 'page' : undefined"
              :data-testid="`nav-${item.to}`" @click="navigate"
              class="d-flex align-items-center justify-content-center"
            >
              <img :src="icon(item.art)" alt="" />
            </a>
            <span class="tag badge rounded-pill">{{ item.label }}</span>
          </li>
        </RouterLink>
      </ul>

      <button class="shift shift-l d-none d-md-block" @keydown.l="step(-1)" aria-label="Previous">L</button>
      <button class="shift shift-r d-none d-md-block" @keydown.r="step(1)" aria-label="Next">R</button>
    </div>

    <!-- right: counters + profile -->
    <div class="side d-flex justify-content-end align-items-center gap-2">
      <span class="counter" data-testid="nav-streak">🔥 {{ auth.profile?.streak ?? 0 }}</span>
      <span class="counter" data-testid="nav-coins">🧈 {{ auth.profile?.coins ?? 0 }}</span>
      <RouterLink :to="{ name: 'profile' }" class="avatar" aria-label="Profile">🙂</RouterLink>
    </div>
  </nav>
</template>

<style scoped>
.navbar { background: transparent; border: 0; }

/* equal-width sides = peas dead center */
.side { flex: 1 1 0; min-width: 0; }

/* shared counter */
.counter {
  display: flex; align-items: center; gap: 4px;
  padding: 4px 12px 4px 6px;
  min-width: 74px; height: 32px;
  background: var(--cream); border-radius: 999px;
  font-variant-numeric: tabular-nums; font-weight: 600;
}
.avatar {
  width: 32px; height: 32px; border-radius: 50%;
  display: grid; place-items: center;
  background: var(--berry); text-decoration: none;
  transition: transform .3s var(--spring);
}
.avatar:hover { transform: scale(1.12) rotate(-6deg); }

/* peas */
.peas { --size: 48px; }
.pea { position: relative; }
.pea + .pea { margin-left: -12px; }          /* overlap */
.pea a {
  width: var(--size); height: var(--size);   /* never changes */
  border-radius: 50%; background: var(--linen);
}
.pea:hover, .pea.active { z-index: 2; }
.pea img {
  width: 26px; height: 26px;
  transition: transform .35s var(--spring);
}
.pea:hover img { transform: scale(1.35) rotate(-6deg); }
.pea.active img { transform: scale(1.3); animation: boing .5s var(--spring); }
.pea a:active img { transform: scale(.9); }

/* label badge: hover shows, active stays */
.tag {
  position: absolute; left: 50%; top: -14px;
  background: var(--butter); color: #4a3b1f; font-weight: 600;
  opacity: 0; pointer-events: none;
  transform: translate(-50%, 6px) scale(.6);
  transition: opacity .2s, transform .35s var(--spring);
}
.pea:hover .tag, .pea.active .tag {
  opacity: 1; transform: translate(-50%, -4px) scale(1);
}

/* L / R */
button.shift {
  position: absolute; bottom: -8px; z-index: 3;
  width: 30px; height: 22px; padding: 0;
  background: var(--bark-muted); color: var(--cream);
  border: 3px solid var(--linen);
  font-weight: 700; font-size: .75rem; line-height: 1;
  transition: transform .25s var(--spring);
}
.shift-l { left: -10px;  border-radius: 10px 0 0 0; transform-origin: bottom right; }
.shift-r { right: -10px; border-radius: 0 10px 0 0; transform-origin: bottom left; }

@keyframes boing {
  0%   { transform: scale(.8) rotate(-10deg); }
  60%  { transform: scale(1.45) rotate(6deg); }
  100% { transform: scale(1.3) rotate(0); }
}
</style>