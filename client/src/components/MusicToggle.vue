<script setup>
import { useMusicStore } from '@/stores/music'
import GardenRadio from '@/components/GardenRadio.vue'

// Music on/off button (navbar, or floating on pages without a navbar).
// Hovering it (or tabbing to it) opens a mini Garden Radio.
defineProps({ floating: { type: Boolean, default: false } })
const music = useMusicStore()
</script>

<template>
  <span class="music-wrap" :class="{ floating }">
    <button
      type="button" class="music-toggle" :class="{ on: music.playing }" data-music-control
      :aria-pressed="music.playing" :aria-label="music.playing ? 'Turn music off' : 'Turn music on'"
      :title="music.playing ? `Playing: ${music.track?.title}` : 'Turn on lo-fi music'"
      data-testid="music-toggle" @click="music.toggle()"
    >
      <span aria-hidden="true">{{ music.playing ? '🎵' : '🔇' }}</span>
    </button>
    <!-- see-through padding lets the mouse move from the icon onto the pop-up -->
    <div class="radio-pop" data-testid="music-pop">
      <GardenRadio compact class="sp-card radio-card" />
    </div>
  </span>
</template>

<style scoped>
.music-toggle {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  flex: none;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: var(--cream);
  font-size: 15px;
  line-height: 1;
  transition: background .15s, transform .15s;
}
.music-toggle:hover { transform: scale(1.08); }
.music-toggle.on { background: var(--mint); }
.music-toggle:focus-visible { outline: 3px solid var(--periwinkle); outline-offset: 2px; }

/* mini Garden Radio pop-up, below the icon */
.music-wrap { position: relative; display: inline-flex; flex: none; }
.radio-pop {
  position: absolute;
  top: 100%;
  right: 0;
  z-index: 10;
  padding-top: 8px;
  opacity: 0;
  visibility: hidden;
  transition: opacity .15s, visibility .15s;
}
/* opens on hover or keyboard focus (a mouse click doesn't keep it open) */
.music-wrap:hover .radio-pop, .music-wrap:has(:focus-visible) .radio-pop { opacity: 1; visibility: visible; }
/* phones can't hover: they use the Garden Radio card on the Focus page */
@media (hover: none) { .radio-pop { display: none; } }
.radio-card { width: 280px; } /* paper look from theme.css .sp-card */

/* floating version: bottom-left corner; the pop-up opens to the right */
.music-wrap.floating { position: fixed; left: 16px; bottom: 16px; z-index: 1040; }
.floating .music-toggle {
  width: 44px;
  height: 44px;
  font-size: 20px;
  box-shadow: 0 6px 16px -6px var(--shadow-card);
}
.floating .radio-pop { top: auto; right: auto; bottom: 0; left: 100%; padding: 0 0 0 8px; }
</style>
