<script setup>
import Billboard from './Billboard.vue'
import { FOUNTAIN } from '@/world/config'
</script>

<template>
  <Billboard :x="FOUNTAIN.x" :y="FOUNTAIN.y" :w="130" :h="110" :shadow="120" data-testid="fountain">
    <div class="fountain">
      <span class="basin" />
      <span class="water" />
      <span class="pillar" />
      <span class="bowl" />
      <i class="drop d1" /><i class="drop d2" /><i class="drop d3" />
    </div>
  </Billboard>
</template>

<style scoped>
.fountain { position: relative; width: 100%; height: 100%; }
.basin { position: absolute; left: 0; right: 0; bottom: 0; height: 34%; border-radius: 50%; background: #d9cfc0; box-shadow: inset 0 -6px 0 rgba(0,0,0,.08); }
.water { position: absolute; left: 8%; right: 8%; bottom: 8%; height: 22%; border-radius: 50%; background: #9adbe8; }
.pillar { position: absolute; left: 44%; width: 12%; bottom: 14%; height: 48%; background: #d9cfc0; }
.bowl { position: absolute; left: 28%; right: 28%; bottom: 52%; height: 14%; border-radius: 50%; background: #e5dccd; }
.drop { position: absolute; left: 48%; bottom: 62%; width: 7px; height: 7px; border-radius: 50%; background: #c8f0f6; animation: spray 1.4s ease-out infinite; }
.d2 { animation-delay: .45s; --dx: -22px; }
.d3 { animation-delay: .9s; --dx: 22px; }
.d1 { --dx: 0px; }
@keyframes spray {
  0% { transform: translate(0, 0); opacity: 1; }
  60% { transform: translate(var(--dx), -22px); opacity: 1; }
  100% { transform: translate(calc(var(--dx) * 1.6), 14px); opacity: 0; }
}
</style>
