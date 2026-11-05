<script setup>
import { ref } from 'vue'

import flashcardArt from '@/assets/ui/flashcard.svg'
import quizArt from '@/assets/ui/mcq.svg'
import structuredArt from '@/assets/ui/ssq.svg'

const emit = defineEmits(['review'])

const reviewModes = [
  { label: 'Flashcard', route: 'flashcard', art: flashcardArt, tilt: -7, dy: 4, tape: 'is-butter', hint: 'Flip through up to 20 cards' },
  { label: 'Multiple Choice Quiz', route: 'multiple-choice-quiz', art: quizArt, tilt: 0, dy: 0, tape: '', hint: 'Up to 10 quick questions' },
  { label: 'Short Structured Mode', route: 'short-structured', art: structuredArt, tilt: 7, dy: 4, tape: 'is-leaf', hint: "Prove you've mastered it" },
]

const selected = ref(1)
const armed = ref(null) // touch only: the tag that was tapped once and now opens on the next tap
const tags = ref(null)
let wheelAt = 0

function onReviewClick(mode, index, event) {
  const touch = event.pointerType === 'touch' || event.pointerType === 'pen'
  if (touch && armed.value !== index) {
    selected.value = index
    armed.value = index
    return
  }
  emit('review', mode.route)
}

// the slip under the cards opens whichever mode is currently picked (also the confirm tap on touch)
function openSelected() {
  emit('review', reviewModes[selected.value].route)
}

function spin(direction) {
  selected.value = (selected.value + direction + reviewModes.length) % reviewModes.length
  armed.value = null
  if (tags.value?.contains(document.activeElement)) tags.value.children[selected.value].focus()
}

function onWheel(event) {
  const now = Date.now()
  if (now - wheelAt < 140) return
  wheelAt = now
  spin(Math.sign(event.deltaY || event.deltaX))
}

function onKey(event) {
  const direction = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key]
  if (!direction) return
  event.preventDefault()
  spin(direction)
}
</script>

<template>
  <div
    class="plant-review-actions"
    role="group"
    aria-label="Review modes"
    @wheel.prevent.stop="onWheel"
    @keydown.stop="onKey"
  >
    <!-- a frosted-glass panel, same material as the top bar and the dock -->
    <div class="sign position-absolute start-0 d-flex flex-column align-items-center rounded-4">
      <div ref="tags" class="tags d-flex justify-content-center align-items-end">
        <button
          v-for="(mode, i) in reviewModes"
          :key="mode.route"
          type="button"
          class="review-action position-relative d-flex align-items-center justify-content-center rounded-3 p-0 overflow-hidden"
          :class="{ 'is-on': selected === i }"
          :style="{ '--i': i, '--r': `${mode.tilt}deg`, '--dy': `${mode.dy}px` }"
          :data-testid="`review-${mode.route}`"
          :aria-label="mode.label"
          :aria-pressed="selected === i"
          @pointerenter="$event.pointerType === 'mouse' && (selected = i)"
          @focus="selected = i"
          @click.stop="onReviewClick(mode, i, $event)"
        >
          <span :class="['sp-tape', 'tape-bg', mode.tape]" aria-hidden="true"></span>
          <span class="art-tile position-relative d-flex align-items-center justify-content-center rounded-2" aria-hidden="true">
            <img :src="mode.art" alt="" width="34" height="34" class="ico" />
          </span>
        </button>
      </div>

      <!-- the label doubles as a button: it opens the mode that is currently picked -->
      <button
        type="button"
        class="slip w-100 text-center rounded-3 d-flex flex-column justify-content-center"
        :aria-label="`Start ${reviewModes[selected].label}`"
        data-testid="review-open-selected"
        @click.stop="openSelected"
      >
        <span :key="selected" class="name">{{ reviewModes[selected].label }}</span>
        <span class="hint">{{ reviewModes[selected].hint }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.plant-review-actions {
  position: absolute;
  left: 0;
  bottom: var(--plant-overlay-bottom, 170px);
  width: 0;
  height: 0;
  pointer-events: auto;
}

.sign {
  bottom: 14px;
  translate: -50% 0;
  width: 192px;
  padding: 12px 12px 12px;
  gap: 8px;
  background: color-mix(in srgb, var(--sheet) 82%, transparent);
  backdrop-filter: blur(14px) saturate(1.2);
  -webkit-backdrop-filter: blur(14px) saturate(1.2);
  box-shadow: 0 1px 0 rgba(255, 255, 255, .7) inset, var(--shadow-1);
  animation: copy-in .6s var(--spring) backwards;
}

.tags { width: 100%; padding-top: 8px; }

.review-action {
  flex: 0 0 auto;
  width: 60px;
  height: 70px;
  background: color-mix(in srgb, var(--paper) 95%, transparent);
  border: 1px solid color-mix(in srgb, var(--bark) 30%, transparent);
  box-shadow: 0 3px 8px -3px color-mix(in srgb, var(--bark) 45%, transparent);
  cursor: pointer;
  transform: translateY(var(--dy)) rotate(var(--r));
  animation: deal .5s var(--spring) backwards;
  animation-delay: calc(var(--i) * 80ms + 150ms);
  transition: transform .35s var(--spring), background .2s, box-shadow .2s, border-color .2s;
}
.review-action + .review-action { margin-left: -10px; }

.tape-bg {
  position: absolute;
  inset: 0;
  width: auto;
  height: auto;
  margin: 0;
  border-radius: 0;
  box-shadow: none;
  clip-path: none;
  transform: none;
  rotate: 0deg;
  scale: 1;
  opacity: 1;
  z-index: 0;
  pointer-events: none;
  transition: opacity .25s;
}
.tape-bg::before { display: none; }
.tape-bg::after {
  content: "";
  position: absolute;
  inset: 0;
}

.art-tile {
  z-index: 1;
  width: 44px;
  height: 44px;
  background: color-mix(in srgb, var(--cream) 95%, transparent);
  transition: background .25s;
}
.review-action.is-on .art-tile { background: color-mix(in srgb, var(--cream) 78%, transparent); }

.review-action:hover { transform: translateY(calc(var(--dy) - 3px)) rotate(var(--r)); }
.review-action:active { transform: translateY(1px) rotate(var(--r)); box-shadow: 0 1px 3px -1px color-mix(in srgb, var(--bark) 45%, transparent); }
.review-action.is-on,
.review-action.is-on:hover {
  z-index: 2;
  background: var(--butter-soft);
  border-color: color-mix(in srgb, var(--bark) 22%, transparent);
  transform: translateY(-6px) rotate(0deg) scale(1.1);
  box-shadow: 0 8px 12px -4px color-mix(in srgb, var(--bark) 45%, transparent);
}
.review-action:focus-visible { outline: 2px solid var(--berry); outline-offset: 3px; }

.ico { transition: transform .35s var(--spring); }
.review-action.is-on .ico { transform: scale(1.08); animation: boing .5s var(--spring); }
.review-action:active .ico { transform: scale(.9); }

/* a real <button>, reset to look like the slip it always was */
.slip {
  min-height: 52px;
  padding: 5px 8px 6px;
  font: inherit;
  background: color-mix(in srgb, var(--sheet-2) 70%, transparent);
  border: 1px solid color-mix(in srgb, var(--line) 70%, transparent);
  color: var(--ink);
  line-height: 1.15;
  transition: background .2s, transform .2s var(--spring);
}
.slip:hover { background: color-mix(in srgb, var(--sheet-2) 92%, transparent); }
.slip:active { transform: translateY(1px); }
.slip:focus-visible { outline: 2px solid var(--berry); outline-offset: 2px; }
.slip .name {
  font-family: var(--f-hand);
  font-size: 1.1rem;
  font-weight: 700;
  animation: slip-swap .25s var(--ease);
}
.slip .hint { font-size: .7rem; font-weight: 700; color: var(--ink-soft); }

@keyframes deal { from { opacity: 0; transform: translateY(18px) rotate(0deg) scale(.7); } }
@keyframes slip-swap { from { opacity: 0; transform: translateY(4px); } }
@keyframes boing {
  0% { transform: scale(.8) rotate(-10deg); }
  60% { transform: scale(1.25) rotate(6deg); }
  100% { transform: scale(1.08) rotate(0); }
}

/* kept: no Bootstrap equivalent for reduced-motion */
@media (prefers-reduced-motion: reduce) {
  .sign, .review-action, .ico, .slip .name { animation: none; }
  .tape-bg, .art-tile, .slip { transition: none; }
}
</style>