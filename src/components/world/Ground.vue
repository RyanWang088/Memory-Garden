<script setup>
// Everything painted flat on the ground: island, paths, plaza, garden patch and pond.
import { WORLD, PLAZA, PATH_WIDTH } from '@/world/config'
import { structures } from '@/world/locations'
import { paths } from '@/world/layout'

const pathStyle = (p) => {
  const len = Math.hypot(p.bx - p.ax, p.by - p.ay)
  const ang = (Math.atan2(p.by - p.ay, p.bx - p.ax) * 180) / Math.PI
  return {
    left: `${p.ax}px`,
    top: `${p.ay - PATH_WIDTH / 2}px`,
    width: `${len}px`,
    height: `${PATH_WIDTH}px`,
    transform: `rotate(${ang}deg)`,
  }
}
const patchStyle = (l) => ({
  left: `${l.pos.x - l.patch.w / 2}px`,
  top: `${l.pos.y - l.patch.d / 2}px`,
  width: `${l.patch.w}px`,
  height: `${l.patch.d}px`,
})
const patches = structures.filter((l) => l.patch)
const sideColors = ['#e8cf99', '#dcc088', '#cfb078', '#c2a169', '#b49259', '#a68449']
</script>

<template>
  <div class="island" :style="{ width: `${WORLD.width}px`, height: `${WORLD.height}px` }" aria-hidden="true">
    <div v-for="(c, i) in sideColors" :key="i" class="side" :style="{ background: c, transform: `translateZ(${-(i + 1) * 3}px)` }" />
    <div class="ground" data-testid="ground">
      <div
        class="plaza"
        :style="{ left: `${PLAZA.x - PLAZA.r}px`, top: `${PLAZA.y - PLAZA.r}px`, width: `${PLAZA.r * 2}px`, height: `${PLAZA.r * 2}px` }"
      />
      <div v-for="p in paths" :key="p.id" class="path" :style="pathStyle(p)" />
      <div v-for="l in patches" :key="l.id" class="patch" :class="l.kind" :style="patchStyle(l)">
        <template v-if="l.kind === 'garden'"><span v-for="n in 9" :key="n" class="cell" /></template>
        <template v-else><span class="ripple" /><span class="pad p1" /><span class="pad p2" /><span class="pad p3" /></template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.island, .side, .ground { position: absolute; left: 0; top: 0; }
.island { transform-style: preserve-3d; }
.side, .ground { width: 100%; height: 100%; border-radius: 90px; }
.ground {
  background-color: var(--grass-a);
  background-image: conic-gradient(var(--grass-b) 25%, var(--grass-a) 0 50%, var(--grass-b) 0 75%, var(--grass-a) 0);
  background-size: 120px 120px;
  box-shadow: inset 0 0 0 18px var(--sand), inset 0 0 0 26px rgba(255, 255, 255, 0.35);
}
.plaza { position: absolute; border-radius: 50%; background: #efe6d6; box-shadow: inset 0 0 0 14px #e2d6c2; }
.path { position: absolute; transform-origin: 0 50%; border-radius: 999px; background: #f6e6c2; box-shadow: inset 0 0 0 5px rgba(217, 185, 122, 0.35); }
.patch { position: absolute; }
.garden { display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(3, 1fr); gap: 12px; padding: 14px; border-radius: 18px; background: #d7a777; box-shadow: 0 0 0 6px #b98552; }
.cell { border-radius: 10px; background: #8a5d3d; box-shadow: inset 0 6px 0 rgba(0, 0, 0, 0.12); }
.pond { border-radius: 50%; background: #8fd3e6; box-shadow: 0 0 0 12px #d9d2c6, 0 0 0 16px #cfc8bd; overflow: hidden; }
.ripple { position: absolute; left: 30%; top: 30%; width: 40%; height: 40%; border-radius: 50%; border: 3px solid rgba(255, 255, 255, 0.7); animation: ripple 3.2s ease-out infinite; }
.pad { position: absolute; width: 38px; height: 22px; border-radius: 50%; background: #7cbf66; }
.p1 { left: 16%; top: 28%; } .p2 { left: 68%; top: 56%; } .p3 { left: 40%; top: 70%; }
@keyframes ripple { 0% { transform: scale(0.3); opacity: 0.9; } 100% { transform: scale(1.9); opacity: 0; } }
</style>
