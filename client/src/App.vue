<script setup>
import { computed, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { useUiStore } from '@/stores/ui'
import NavBar from '@/components/NavBar.vue'
import AppDock from '@/components/AppDock.vue'
import DevScrubber from '@/components/DevScrubber.vue'
import ToastHost from '@/components/ToastHost.vue'
import FocusPlayer from '@/components/FocusPlayer.vue'
import MusicToggle from '@/components/MusicToggle.vue'
import { usePomodoroStore } from '@/stores/pomodoro'
import { useMusicStore } from '@/stores/music'

const route = useRoute()
const ui = useUiStore()
const pomo = usePomodoroStore()
const music = useMusicStore()

// a refresh shouldn't lose a running focus session, or switch off music that was on
pomo.restore()
music.restore()

// pages without the navbar (e.g. reviews) still need a way to turn music off, so a floating
// music button shows there while music is on (bottom-left, away from the mini timer player)
const floatingMusic = computed(() => music.enabled && !route.meta.showNav)

// Reflect the equipped tool on <body> so CSS can swap the cursor everywhere.
watchEffect(() => {
  document.body.classList.remove('tool-pointer', 'tool-wateringCan', 'tool-shovel', 'tool-shears')
  document.body.classList.add(`tool-${ui.activeTool}`)
})
</script>

<template>
  <NavBar v-if="route.meta.showNav" />
  <RouterView />
  <AppDock v-if="route.meta.showNav" />
  <FocusPlayer />
  <MusicToggle v-if="floatingMusic" floating />
  <ToastHost />
  <DevScrubber/>
</template>
