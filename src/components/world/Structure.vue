<script setup>
// Greybox renderer for the standing part of each location. swaps these
// shapes for the final SVG art; position, size and test ids stay as they are.
import Billboard from './Billboard.vue'
defineProps({ loc: { type: Object, required: true } })
</script>

<template>
  <!-- house, shed, greenhouse -->
  <Billboard
    v-if="loc.kind === 'building'"
    :x="loc.pos.x" :y="loc.pos.y" :w="loc.size.w" :h="loc.size.h" :shadow="loc.size.w * 1.05"
    :data-testid="`structure-${loc.id}`"
  >
    <div class="house" :class="{ glass: loc.glass }" :style="{ '--wall': loc.wall, '--roof': loc.roof }">
      <span class="roof" />
      <span class="wall">
        <i class="door" /><i class="win" />
        <b class="name">{{ loc.short }}</b>
      </span>
    </div>
  </Billboard>

  <!-- windmill -->
  <Billboard
    v-else-if="loc.kind === 'tower'"
    :x="loc.pos.x" :y="loc.pos.y" :w="loc.size.w" :h="loc.size.h" :shadow="130"
    :data-testid="`structure-${loc.id}`"
  >
    <div class="tower">
      <span class="t-body" /><span class="t-roof" />
      <span class="blades"><i /><i /></span>
      <b class="name">{{ loc.short }}</b>
    </div>
  </Billboard>

  <!-- calendar signposts -->
  <Billboard
    v-else-if="loc.kind === 'signpost'"
    :x="loc.pos.x" :y="loc.pos.y" :w="loc.size.w" :h="loc.size.h" :shadow="70"
    :data-testid="`structure-${loc.id}`"
  >
    <div class="posts">
      <span class="post" />
      <span class="plank a">Today</span>
      <span class="plank b">Soon</span>
      <span class="lantern" />
    </div>
  </Billboard>

  <!-- beds and pond: the flat patch lives in Ground, this is the name sign -->
  <Billboard
    v-else
    :x="loc.pos.x - loc.patch.w / 2 - 24" :y="loc.pos.y + loc.patch.d / 2"
    :w="loc.size.w" :h="loc.size.h" :shadow="40"
    :data-testid="`structure-${loc.id}`"
  >
    <div class="sign"><span class="pole" /><b class="board">{{ loc.short }}</b></div>
  </Billboard>
</template>

<style scoped>
.name { font-family: var(--font-display); font-weight: 800; color: var(--ink); }

.house { position: relative; width: 100%; height: 100%; }
.roof {
  position: absolute; left: -5%; width: 110%; top: 0; height: 44%;
  background: var(--roof); clip-path: polygon(50% 0, 100% 100%, 0 100%);
}
.wall {
  position: absolute; left: 0; right: 0; bottom: 0; height: 60%;
  background: var(--wall); border: 3px solid rgba(75, 58, 51, 0.18); border-radius: 6px;
  display: flex; align-items: flex-end; justify-content: center; padding-bottom: 5px;
}
.glass .wall { background: rgba(223, 245, 240, 0.7); border-color: rgba(255, 255, 255, 0.9); }
.door { position: absolute; left: 50%; bottom: 0; width: 20%; height: 52%; margin-left: -10%; border-radius: 6px 6px 0 0; background: var(--wood-deep); }
.win { position: absolute; left: 12%; top: 18%; width: 18%; height: 26%; border-radius: 4px; background: #c3e5f2; border: 3px solid #fff; }
.wall .name { position: absolute; right: 8%; top: 20%; font-size: 13px; background: rgba(255, 255, 255, 0.7); padding: 1px 7px; border-radius: 999px; }

.tower { position: relative; width: 100%; height: 100%; }
.t-body { position: absolute; left: 24%; right: 24%; bottom: 0; height: 66%; background: #fbefe2; clip-path: polygon(16% 0, 84% 0, 100% 100%, 0 100%); }
.t-roof { position: absolute; left: 20%; right: 20%; top: 6%; height: 26%; background: #e7867a; clip-path: polygon(50% 0, 100% 100%, 0 100%); }
.blades { position: absolute; left: 50%; top: 40%; width: 0; height: 0; animation: spin 9s linear infinite; }
.blades i { position: absolute; left: -62px; top: -4px; width: 124px; height: 8px; border-radius: 4px; background: var(--wood-deep); }
.blades i + i { transform: rotate(90deg); }
.tower .name { position: absolute; left: 50%; bottom: 8%; transform: translateX(-50%); font-size: 13px; background: rgba(255,255,255,.8); padding: 1px 8px; border-radius: 999px; }
@keyframes spin { to { transform: rotate(360deg); } }

.posts { position: relative; width: 100%; height: 100%; }
.post { position: absolute; left: 47%; width: 6%; bottom: 0; height: 80%; background: var(--wood-deep); }
.plank { position: absolute; padding: 4px 10px; border-radius: 6px; background: #f6e3c3; border: 2px solid var(--wood); font: 800 13px var(--font-display); color: var(--ink); }
.a { left: 4%; top: 12%; transform: rotate(-4deg); }
.b { right: 4%; top: 36%; transform: rotate(3deg); }
.lantern { position: absolute; left: 60%; top: 2%; width: 14px; height: 18px; border-radius: 4px; background: #ffe7a8; box-shadow: 0 0 14px #ffcf6b; }

.sign { position: relative; width: 100%; height: 100%; }
.pole { position: absolute; left: 47%; width: 6%; bottom: 0; height: 70%; background: var(--wood-deep); }
.board { position: absolute; left: 0; right: 0; top: 6%; padding: 4px 6px; text-align: center; border-radius: 8px; background: #f6e3c3; border: 2px solid var(--wood); font-size: 14px; color: var(--ink); }
</style>
