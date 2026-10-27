<script setup>
import { computed } from 'vue'
import { useMusicStore, MOODS } from '@/stores/music'
import SproutIcon from '@/components/SproutIcon.vue'

// Figma weather stickers for the mood chips (the store keeps its emoji for other uses)
const MOOD_STICKERS = { auto: 'sparkle', sunny: 'sun', cloudy: 'cloud', rainy: 'rain', stormy: 'storm', snowy: 'snow' }
import { formatSeconds } from '@/stores/pomodoro'

// Garden Radio card on the Focus page: what's playing, play/pause/skip, and the mood picker.
// `compact` (the pop-up on the music icon) leaves out the header and the mood picker.
defineProps({ compact: { type: Boolean, default: false } })
const music = useMusicStore()

const moodInfo = computed(() => MOODS.find(m => m.key === music.activeWeather))
const matchLabel = computed(() => (music.mood === 'auto'
  ? `matched to ${music.activeWeather} ${moodInfo.value?.icon ?? ''}`
  : `${moodInfo.value?.label.toLowerCase()} mood ${moodInfo.value?.icon ?? ''}`))
const time = computed(() => `${formatSeconds(Math.floor(music.position))} / ${formatSeconds(Math.floor(music.duration || 0))}`)
const progress = computed(() => (music.duration ? (music.position / music.duration) * 100 : 0))
</script>

<template>
  <section aria-label="Garden Radio" data-testid="garden-radio">
    <div v-if="!compact" class="d-flex justify-content-between align-items-baseline gap-2 mb-2">
      <span id="radio-title" class="text-label-caption sp-card-label">Garden Radio</span>
      <span class="text-body-small" data-testid="radio-match">{{ matchLabel }}</span>
    </div>

    <div class="d-flex align-items-center gap-3">
      <span class="vinyl" :class="{ spinning: music.playing }" aria-hidden="true"></span>
      <h3 class="mb-0 text-truncate" data-testid="radio-title">{{ music.track?.title ?? 'Calm lo-fi for studying' }}</h3>
    </div>
    <div class="text-body-small mb-2">
      lo-fi · <span v-if="music.track">{{ time }}</span><span v-else>press play to start</span>
    </div>
    <div class="bar mb-3" aria-hidden="true"><span :style="{ width: `${progress}%` }"></span></div>

    <div class="d-flex align-items-center gap-2" :class="{ 'mb-3': !compact }">
      <button type="button" class="ctrl" data-music-control aria-label="Previous track" :disabled="!music.track" @click="music.previous()"><SproutIcon glyph="chevron-left" :size="18" /></button>
      <button
        type="button" class="ctrl main" data-music-control data-testid="radio-play"
        :aria-label="music.playing ? 'Pause music' : 'Play music'" @click="music.toggle()"
      ><SproutIcon :glyph="music.playing ? 'pause' : 'play'" :size="16" /></button>
      <button type="button" class="ctrl" data-music-control aria-label="Next track" data-testid="radio-next" @click="music.enabled ? music.next() : music.play()"><SproutIcon glyph="chevron-right" :size="18" /></button>
      <input
        v-model.number="music.volume" type="range" min="0" max="1" step="0.05" class="volume flex-fill ms-2"
        data-music-control aria-label="Music volume"
      />
    </div>

    <!-- mood picker: follow the live weather, or choose one -->
    <div v-if="!compact" class="d-flex flex-wrap gap-1" role="radiogroup" aria-label="Music mood">
      <button
        v-for="m in MOODS" :key="m.key" type="button" role="radio" class="mood" data-music-control
        :class="{ active: music.mood === m.key }" :aria-checked="music.mood === m.key" :title="m.label"
        :data-testid="`radio-mood-${m.key}`" @click="music.setMood(m.key)"
      >
        <SproutIcon :name="MOOD_STICKERS[m.key]" :size="20" />
        <span v-if="m.key === 'auto'" class="ms-1">Auto</span>
        <span v-else class="visually-hidden">{{ m.label }}</span>
      </button>
    </div>
  </section>
</template>

<style scoped>
/* the card label comes from theme.css (.sp-card-label); the spin animation is theme.css's too */
.bar { height: 6px; border-radius: var(--r-pill); background: var(--linen); overflow: hidden; }
.bar span { display: block; height: 100%; background: var(--leaf); transition: width .25s linear; }

.ctrl {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  flex: none;
  padding: 0;
  border: 1.5px solid var(--line);
  border-radius: 50%;
  background: var(--paper);
  color: var(--bark);
  font-family: var(--f-display);
  font-size: 18px;
  line-height: 1;
}
.ctrl.main { background: var(--leaf); border-color: var(--leaf); color: #fff; font-size: 13px; }
.ctrl:disabled { opacity: .4; }
.ctrl:not(:disabled):hover { background: var(--cream); }

.volume { accent-color: var(--leaf); min-width: 60px; }

.mood {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  transition: transform .2s var(--spring), border-color .15s;
  border: 1px solid var(--linen);
  border-radius: var(--r-pill);
  background: var(--cream);
  font-size: 13px;
  line-height: 18px;
}
.mood:hover { transform: translateY(-1px); }
.mood.active { border-color: var(--leaf); background: var(--leaf-soft); }
.mood:focus-visible, .ctrl:focus-visible { outline: 3px solid var(--periwinkle); outline-offset: 2px; }
/* a record: the grooves are drawn with fixed dark colours */
.vinyl { width: 50px; height: 50px; border-radius: 50%; flex: none; background: radial-gradient(circle, var(--berry) 0 17%, #2a201c 18% 30%, #3a2e29 31% 33%, #2a201c 34% 50%, #3a2e29 51% 53%, #2a201c 54%); box-shadow: var(--shadow-1); }
.vinyl.spinning { animation: spin 3s linear infinite; }
h3 { font-size: 1.05rem; line-height: 1.3; }
</style>
