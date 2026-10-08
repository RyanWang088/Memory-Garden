<script setup>
// Placeholder chibi svg not yet swapped in
defineProps({
  walking: { type: Boolean, default: false },
  facing: { type: Number, default: 1 }, // 1 faces right, -1 faces left
})
</script>

<template>
  <div class="avatar" :class="{ walking }" data-testid="avatar">
    <div class="flip" :style="{ transform: `scaleX(${facing})` }">
      <div class="bob">
        <span class="body" />
        <span class="head">
          <i class="eye e1" /><i class="eye e2" /><i class="cheek" />
          <span class="hair" />
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.avatar, .flip, .bob { position: relative; width: 100%; height: 100%; }
.flip { transition: transform 0.12s var(--ease-spring); }
.bob { transform-origin: 50% 100%; animation: idle 2.6s ease-in-out infinite; }
.walking .bob { animation: walk 0.36s ease-in-out infinite; }
.body { position: absolute; left: 14%; right: 14%; bottom: 0; height: 46%; border-radius: 40% 40% 28% 28%; background: var(--petal); border: 2px solid var(--petal-deep); }
.head { position: absolute; left: 0; right: 0; top: 0; height: 58%; border-radius: 50%; background: #ffe1c9; border: 2px solid #c98f66; }
.hair { position: absolute; left: -2px; right: -2px; top: -3px; height: 48%; border-radius: 50% 50% 30% 30%; background: #5b3d2e; }
.eye { position: absolute; top: 52%; width: 5px; height: 7px; border-radius: 50%; background: #2b1d1a; }
.e1 { left: 50%; } .e2 { left: 74%; }
.cheek { position: absolute; left: 58%; top: 68%; width: 10px; height: 6px; border-radius: 50%; background: rgba(246,165,168,.7); }
@keyframes idle { 0%, 100% { transform: scale(1, 1); } 50% { transform: scale(1.02, 0.98); } }
@keyframes walk {
  0%, 100% { transform: translateY(0) scale(1.04, 0.95) rotate(-3deg); }
  50% { transform: translateY(-8px) scale(0.96, 1.05) rotate(3deg); }
}
</style>
