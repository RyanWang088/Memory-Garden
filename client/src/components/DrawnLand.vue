<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { mountLand } from '@/lib/scenery'

// The hand-drawn meadow ground for static pages (five ridges, trees, flower dots, tulips), drawn to the real size.
// options: seed, horizon, flowers, tulips, clearCenter (see lib/scenery.js)
const props = defineProps({ options: { type: Object, default: () => ({}) } })
const el = ref(null)
let land
onMounted(() => { land = mountLand(el.value, props.options) })
onBeforeUnmount(() => land?.destroy())
</script>

<template>
  <div ref="el" class="drawn-land"></div>
</template>

<style>
.drawn-land { position: absolute; inset: 0; }
</style>