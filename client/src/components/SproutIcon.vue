<script setup>
import { computed } from 'vue'
import { STICKERS, GLYPHS } from '@/lib/icons'

// <SproutIcon name="coin" />  -> colour sticker (48 grid)
// <SproutIcon glyph="play" /> -> line glyph in the current text colour (24 grid)
const props = defineProps({
  name: { type: String, default: '' },
  glyph: { type: String, default: '' },
  size: { type: [Number, String], default: null },
})
const svg = computed(() => {
  if (props.glyph) {
    const s = props.size ?? 20
    return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${GLYPHS[props.glyph] ?? ''}</svg>`
  }
  const s = props.size ?? 40
  return `<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none">${STICKERS[props.name] ?? ''}</svg>`
})
</script>

<template>
  <span class="sprout-icon" aria-hidden="true" v-html="svg"></span>
</template>

<style scoped>
.sprout-icon { display: inline-grid; place-items: center; flex: none; line-height: 0; }
.sprout-icon :deep(svg) { display: block; overflow: visible; }
</style>
