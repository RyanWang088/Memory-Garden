<script setup>
import { watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { useUiStore } from '@/stores/ui'
import NavBar from '@/components/NavBar.vue'
import ToastHost from '@/components/ToastHost.vue'

const route = useRoute()
const ui = useUiStore()

// Reflect the equipped tool on <body> so CSS can swap the cursor everywhere.
watchEffect(() => {
  document.body.classList.remove('tool-pointer', 'tool-wateringCan', 'tool-shovel')
  document.body.classList.add(`tool-${ui.activeTool}`)
})
</script>

<template>
  <NavBar v-if="route.meta.showNav" />
  <RouterView />
  <ToastHost />
</template>
