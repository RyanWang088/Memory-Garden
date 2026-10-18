<script setup>
import { computed } from 'vue'
import { useMusicStore, MOODS } from '@/stores/music'
import { formatSeconds } from '@/stores/pomodoro'

// Garden Radio card on the Focus page: what's playing, play/pause/skip, and the mood picker.
const music = useMusicStore()

const moodInfo = computed(() => MOODS.find(m => m.key === music.activeWeather))
const matchLabel = computed(() => (music.mood === 'auto'
  ? `matched to ${music.activeWeather} ${moodInfo.value?.icon ?? ''}`
  : `${moodInfo.value?.label.toLowerCase()} mood ${moodInfo.value?.icon ?? ''}`))
const time = computed(() => `${formatSeconds(Math.floor(music.position))} / ${formatSeconds(Math.floor(music.duration || 0))}`)
const progress = computed(() => (music.duration ? (music.position / music.duration) * 100 : 0))
</script>

<template>
  <section aria-labelledby="radio-title" data-testid="garden-radio">
    <div class="d-flex justify-content-between align-items-baseline gap-2 mb-2">
      <span id="radio-title" class="text-label-caption radio-label">Garden Radio</span>
      <span class="text-body-small" data-testid="radio-match">{{ matchLabel }}</span>
    </div>

    <h3 class="mb-0 text-truncate" data-testid="radio-title">{{ music.track?.title ?? 'Calm lo-fi for studying' }}</h3>
    <div class="text-body-small mb-2">
      lo-fi · <span v-if="music.track">{{ time }}</span><span v-else>press play to start</span>
    </div>
    <div class="bar mb-3" aria-hidden="true"><span :style="{ width: `${progress}%` }"></span></div>

    <div class="d-flex align-items-center gap-2 mb-3">
      <button type="button" class="ctrl" data-music-control aria-label="Previous track" :disabled="!music.track" @click="music.previous()">‹</button>
      <button
        type="button" class="ctrl main" data-music-control data-testid="radio-play"
        :aria-label="music.playing ? 'Pause music' : 'Play music'" @click="music.toggle()"
      >{{ music.playing ? '❚❚' : '▶' }}</button>
      <button type="button" class="ctrl" data-music-control aria-label="Next track" data-testid="radio-next" @click="music.enabled ? music.next() : music.play()">›</button>
      <input
        v-model.number="music.volume" type="range" min="0" max="1" step="0.05" class="volume flex-fill ms-2"
        data-music-control aria-label="Music volume"
      />
    </div>

    <!-- mood picker: follow the live weather, or choose one -->
    <div class="d-flex flex-wrap gap-1" role="radiogroup" aria-label="Music mood">
      <button
        v-for="m in MOODS" :key="m.key" type="button" role="radio" class="mood" data-music-control
        :class="{ active: music.mood === m.key }" :aria-checked="music.mood === m.key" :title="m.label"
        :data-testid="`radio-mood-${m.key}`" @click="music.setMood(m.key)"
      >
        <span aria-hidden="true">{{ m.icon }}</span>
        <span v-if="m.key === 'auto'" class="ms-1">Auto</span>
        <span v-else class="visually-hidden">{{ m.label }}</span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.radio-label { color: var(--berry-ink); }

.bar { height: 6px; border-radius: 999px; background: var(--linen); overflow: hidden; }
.bar span { display: block; height: 100%; background: var(--berry); transition: width .25s linear; }

.ctrl {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  flex: none;
  padding: 0;
  border: 2px solid var(--bark);
  border-radius: 50%;
  background: var(--paper);
  color: var(--bark);
  font-family: 'Fredoka', sans-serif;
  font-size: 18px;
  line-height: 1;
}
.ctrl.main { background: var(--peri-soft); border-color: var(--periwinkle); font-size: 13px; }
.ctrl:disabled { opacity: .4; }
.ctrl:not(:disabled):hover { background: var(--cream); }

.volume { accent-color: var(--berry); min-width: 60px; }

.mood {
  padding: 4px 8px;
  border: 1px solid var(--linen);
  border-radius: 999px;
  background: var(--cream);
  font-size: 13px;
  line-height: 18px;
}
.mood.active { border-color: var(--periwinkle); background: var(--peri-soft); }
</style>
