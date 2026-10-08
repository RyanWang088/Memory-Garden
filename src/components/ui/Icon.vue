<script setup>
import { computed } from 'vue'
const props = defineProps({ name: { type: String, required: true } })

const ICONS = {
  map: '<path d="M9 4L3 6.5v13.5L9 17.5l6 2.5 6-2.5V4l-6 2.5z"/><path d="M9 4v13.5M15 6.5V20"/>',
  house: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>',
  seed: '<path d="M12 21c-3.6 0-6-2.6-6-6 0-4 3-8 6-11 3 3 6 7 6 11 0 3.4-2.4 6-6 6z"/><path d="M12 21v-6"/>',
  leaf: '<path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15"/><path d="M5 19c3-4 6-7 10-9"/>',
  green: '<path d="M3 20V11l9-7 9 7v9z"/><path d="M12 4v16M3 13.5h18"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  wind: '<path d="M3 9h11a3 3 0 1 0-3-3M3 15h15a3 3 0 1 1-3 3M3 12h7"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
}
const markup = computed(() => ICONS[props.name] || '')
</script>

<template>
  <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <g v-html="markup" />
  </svg>
</template>

<style scoped>
.icon { width: 1em; height: 1em; display: block; }
</style>
