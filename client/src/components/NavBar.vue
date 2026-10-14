<script setup>
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const items = [
  { to: 'planner', label: 'Planner', art: 'planner' },
  { to: 'garden', label: 'Garden', art: 'sprout' },
  { to: 'pomodoro', label: 'Focus', art: 'focus' },
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
  <nav class="navbar sticky-top d-flex align-items-start px-3 pt-3 pb-0" data-testid="navbar">
    <!-- left: logo (hidden on mobile)might swap to profile -->
    <div class="side d-flex justify-content-start align-items-center">
      <h2 class=" d-none d-md-block">sproutly</h2>
      <RouterLink :to="{ name: 'profile' }" class="avatar d-md-none" aria-label="Profile">🏡</RouterLink>
    </div>

    <!-- center: peas + L/R chips -->
    <div class=" position-relative">
      <ul class="peas list-unstyled d-flex align-items-center mt-3 p-0">
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
            <span class="navlabel text-label-caption text-capitalize badge rounded-pill">{{ item.label }}</span>
          </li>
        </RouterLink>
      </ul>

      <button class="shift shift-l d-none d-md-block" @keydown.l="step(-1)" aria-label="Previous">L</button>
      <button class="shift shift-r d-none d-md-block" @keydown.r="step(1)" aria-label="Next">R</button>
    </div>

    <!-- right: counters + profile -->
    <div class="side d-flex justify-content-end align-items-center gap-2">
      <div class="stats d-flex flex-column flex-md-row gap-1 gap-md-2">
        <span class="counter" data-testid="nav-streak">🔥 {{ auth.profile?.streak ?? 0 }}</span>
        <span class="counter" data-testid="nav-coins"><img src="../assets/ui/coin.svg" alt=""> {{ auth.profile?.coins ?? 0 }}</span>
      </div>
      <RouterLink :to="{ name: 'profile' }" class="avatar d-none d-md-grid" aria-label="Profile">🏡</RouterLink>
    </div>
  </nav>
</template>

<style scoped>
.navbar { background: transparent; border: 0; }

/* equal-width sides = peas dead center */
.side { flex: 1 1 0; min-width: 0; }

/* peas */
.peas { --size: 60px; }
.pea { position: relative; }
.pea + .pea { margin-left: -6px; }          /* overlap */
.pea a {
  width: var(--size); height: var(--size);   /* never changes */
  border-radius: 50%; background: var(--linen);
}
.pea img {
  width: 35px; height: 35px;
  z-index: 10;
  transition: transform .35s var(--spring);
}
.pea:hover img { transform: scale(1.35) rotate(-6deg); }
.pea.active img { transform: scale(1.3); animation: boing .5s var(--spring); }
.pea a:active img { transform: scale(.9); }

/* label badge: hover shows, active stays */
.pea:hover .navlabel, .pea.active .navlabel {
  opacity: 1; transform: translate(-50%, -4px) scale(1);
}
.navlabel {
  position: absolute;
  left: 50%;
  top: -14px;
  font-weight: 600;
  opacity: 0;
  pointer-events: none;
  transform: translate(-50%, 6px) scale(.6);
  transition: opacity .2s, transform .35s var(--spring);
}
/* L / R */
.shift {
  position: absolute; z-index: 3; bottom:15px;
  width: 25px; height: 25px; padding: 0;
  background: var(--bark-muted); color: var(--cream);
  border: 3px solid var(--linen);
  font-weight: 700; font-size: .75rem; line-height: 1;
}
.shift-l { left: -15px;  border-radius: var(--radius-pill) 0 0 0;}
.shift-r { right: -15px; border-radius: 0 var(--radius-pill) 0 0;}

@keyframes boing {
  0%   { transform: scale(.8) rotate(-10deg); }
  60%  { transform: scale(1.45) rotate(6deg); }
  100% { transform: scale(1.3) rotate(0); }
}
</style>