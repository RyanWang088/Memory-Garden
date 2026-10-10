<script setup>
import { usePomodoroStore } from '@/stores/pomodoro'
const pomo = usePomodoroStore()

</script>

<template>
  <main class="container py-4 text-center" data-testid="pomodoro">
    <h2>{{ pomo.mode === 'focus' ? 'Focus' : 'Break' }}</h2>
    <div class="display-1" data-testid="pomodoro-time">{{ pomo.label }}</div>
    <button v-if="!pomo.running" class="btn btn-success me-2" @click="pomo.start()" data-testid="pomodoro-start">Start</button>
    <button v-else class="btn btn-warning me-2" @click="pomo.pause()">Pause</button>
    <button class="btn btn-outline-dark" @click="pomo.reset()">Reset</button>
  </main>
</template>
