<script setup>
import { useMusicStore } from '@/stores/music'
import GardenRadio from '@/components/GardenRadio.vue'
import musicArt from '@/assets/ui/music.svg'

// Music on/off button (navbar, or floating on pages without a navbar).
// Hovering it (or tabbing to it) opens a mini Garden Radio.
// When music is off, a diagonal line is drawn over the icon.
defineProps({ floating: { type: Boolean, default: false } })
const music = useMusicStore()
</script>

<template>
  <span class="music-wrap position-relative d-inline-flex flex-shrink-0" :class="{ floating }">
    <button
      type="button"
      class="music-toggle position-relative d-flex align-items-center justify-content-center flex-shrink-0 p-0 border-0 bg-transparent"
      data-music-control
      :aria-pressed="music.playing"
      :aria-label="music.playing ? 'Turn music off' : 'Turn music on'"
      :title="music.playing ? `Playing: ${music.track?.title}` : 'Turn on lo-fi music'"
      data-testid="music-toggle"
      @click="music.toggle()"
    >
      <img :src="musicArt" alt="" :class="{ 'opacity-75 ': !music.playing }" />
      <svg
        v-if="!music.playing"
        class="music-slash text-berry-deep position-absolute top-0 start-0 w-100 h-100"
        viewBox="0 0 32 32"
        aria-hidden="true"
        data-testid="music-off-slash"
      >
        <line x1="8" y1="8" x2="25" y2="25" stroke="#fff" stroke-width="3" stroke-linecap="round" />
        <line x1="8" y1="8" x2="25" y2="25" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </svg>
    </button>

    <!-- see-through padding lets the mouse move from the icon onto the pop-up -->
    <div class="radio-pop position-absolute pt-2" data-testid="music-pop">
      <GardenRadio compact class="sp-card radio-card" />
    </div>
  </span>
</template>

<style scoped>
.music-toggle {
  width: 32px;
  height: 32px;
  line-height: 1;
  transition: transform .15s;
}
.music-toggle:hover { transform: scale(1.08); }
.music-toggle:focus-visible { outline: 3px solid var(--leaf); outline-offset: 2px; }
.music-toggle img { width: 20px; height: 32px; object-fit: contain; transition: opacity .2s; }
.music-slash { pointer-events: none; }

.radio-pop {
  top: 100%;
  right: 0;
  z-index: 10;
  opacity: 0;
  visibility: hidden;
  transition: opacity .15s, visibility .15s;
}
.music-wrap:hover .radio-pop,
.music-wrap:has(:focus-visible) .radio-pop { opacity: 1; visibility: visible; }
.radio-card { width: 280px; max-width: calc(100vw - 32px); } /* paper look from theme.css .sp-card */

.music-wrap.floating { position: fixed !important; left: 16px; bottom: 16px; z-index: 1040; }
.floating .radio-pop { top: auto; right: auto; bottom: 0; left: 100%; padding: 0 0 0 8px !important; }

@media (hover: none) { .radio-pop { display: none; } }
</style>