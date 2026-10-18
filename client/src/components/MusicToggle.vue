<script setup>
import { useMusicStore } from '@/stores/music'

// Music on/off button. Used in the navbar, the mini timer player, and (floating) on pages without a navbar.
defineProps({ floating: { type: Boolean, default: false } })
const music = useMusicStore()
</script>

<template>
  <button
    type="button" class="music-toggle" :class="{ on: music.playing, floating }" data-music-control
    :aria-pressed="music.playing" :aria-label="music.playing ? 'Turn music off' : 'Turn music on'"
    :title="music.playing ? `Playing: ${music.track?.title}` : 'Turn on lo-fi music'"
    data-testid="music-toggle" @click="music.toggle()"
  >
    <span aria-hidden="true">{{ music.playing ? '🎵' : '🔇' }}</span>
  </button>
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

/* floating version: bottom-left corner on pages that have no navbar */
.music-toggle.floating {
  position: fixed;
  left: 16px;
  bottom: 16px;
  z-index: 1040;
  width: 44px;
  height: 44px;
  font-size: 20px;
  box-shadow: 0 6px 16px -6px var(--shadow-card);
}
</style>
