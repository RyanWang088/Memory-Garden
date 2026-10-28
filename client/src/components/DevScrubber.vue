<script setup>
import { ref } from 'vue'
import { useWeatherStore } from '@/stores/weather'

const store = useWeatherStore()
const show = ref(false)

window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'p') show.value = !show.value
})
</script>

<template>
  <div v-if="show" style="position:fixed;bottom:10px;right:500px;background:var(--berry-deep);color:#fff;padding:12px;z-index:99999;">
    <div>TIME: {{ Math.floor(store.nowMin / 60) }}:{{ String(store.nowMin % 60).padStart(2,'0') }} | press O+P to close</div>
    <input type="range" min="0" max="1439" v-model.number="store.nowMin" style="width:180px;margin:6px 0;" />
    <div style="display:flex;gap:4px;">
      <button @click="store.condition = 'sunny'">Sunny</button>
      <button @click="store.condition = 'cloudy'">Cloudy</button>
      <button @click="store.condition = 'rainy'">Rainy</button>
      <button @click="store.condition = 'stormy'">Stormy</button>
    </div>
  </div>
</template>