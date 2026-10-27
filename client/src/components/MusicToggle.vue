<script setup>
import { useMusicStore } from '@/stores/music'
import GardenRadio from '@/components/GardenRadio.vue'

// Music on/off button. Used in the navbar, the mini timer player, and (floating) on pages without a navbar.
// Hovering it (or tabbing to it) pops up a small Garden Radio: the song, play/pause/skip and volume.
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
    <!-- the padding around it is see-through, so the mouse can move from the icon to it without it vanishing -->
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

/* the mini Garden Radio: hidden until you hover or tab to the music icon; pops out below it, lined up on the right */
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
/* keyboard focus counts too, but a mouse click doesn't keep it open */
.music-wrap:hover .radio-pop, .music-wrap:has(:focus-visible) .radio-pop { opacity: 1; visibility: visible; }
/* phones can't hover, so they use the Garden Radio card on the Focus page instead */
@media (hover: none) { .radio-pop { display: none; } }
.radio-card { width: 280px; } /* the paper look is theme.css .sp-card */

/* floating version: bottom-left corner on pages that have no navbar; the mini radio pops out to the right */
.music-wrap.floating { position: fixed; left: 16px; bottom: 16px; z-index: 1040; }
.floating .music-toggle {
  width: 44px;
  height: 44px;
  font-size: 20px;
  box-shadow: 0 6px 16px -6px var(--shadow-card);
}
.floating .radio-pop { top: auto; right: auto; bottom: 0; left: 100%; padding: 0 0 0 8px; }
</style>
