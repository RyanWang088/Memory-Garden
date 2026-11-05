<script setup>
import { ref } from 'vue'

import flashcardArt from '@/assets/ui/flashcard.svg'
import quizArt from '@/assets/ui/mcq.svg'
import structuredArt from '@/assets/ui/ssq.svg'

const emit = defineEmits(['review'])

// tilt: how far each paper tag leans (deg); dy: how far it sinks (px) so the three form a hand of cards
// tape: sp-tape colour variant ('' = the default tape); hint: one line shown on the sign for the picked tag
const reviewModes = [
  { label: 'Flashcard', route: 'flashcard', art: flashcardArt, tilt: -7, dy: 4, tape: 'is-butter', hint: 'Flip through up to 20 cards' },
  { label: 'Multiple Choice Quiz', route: 'multiple-choice-quiz', art: quizArt, tilt: 0, dy: 0, tape: '', hint: 'Up to 10 quick questions' },
  { label: 'Short Structured Mode', route: 'short-structured', art: structuredArt, tilt: 7, dy: 4, tape: 'is-leaf', hint: "Prove you've mastered it" },
]

const selected = ref(1)
const armed = ref(null) // touch only: the tag that was tapped once and now opens on the next tap
const tags = ref(null)
let wheelAt = 0

// a mouse or keyboard opens straight away; a finger or pen taps once to pick (the sign shows the name), again to open
function onReviewClick(mode, index, event) {
  const touch = event.pointerType === 'touch' || event.pointerType === 'pen'
  if (touch && armed.value !== index) {
    selected.value = index
    armed.value = index
    return
  }
  emit('review', mode.route)
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
    <!-- a garden marker: a wooden sign on a stake, solid so it reads the same in sun, rain or night -->
    <div class="sign position-absolute start-0 d-flex flex-column align-items-center rounded-4">
      <div ref="tags" class="tags d-flex justify-content-center align-items-end">
        <button
          v-for="(mode, i) in reviewModes"
          :key="mode.route"
          type="button"
          class="review-action position-relative d-flex align-items-center justify-content-center rounded-3 p-0"
          :class="{ 'is-on': selected === i }"
          :style="{ '--i': i, '--r': `${mode.tilt}deg`, '--dy': `${mode.dy}px` }"
          :data-testid="`review-${mode.route}`"
          :aria-label="mode.label"
          :aria-pressed="selected === i"
          @pointerenter="$event.pointerType === 'mouse' && (selected = i)"
          @focus="selected = i"
          @click.stop="onReviewClick(mode, i, $event)"
        >
          <span :class="['sp-tape', mode.tape]" aria-hidden="true"></span>
          <span class="art-tile d-flex align-items-center justify-content-center rounded-2" aria-hidden="true">
            <img :src="mode.art" alt="" width="34" height="34" class="ico" />
          </span>
        </button>
      </div>

      <!-- one shared label, so long names never push past the sign and clip the plants beside it -->
      <p class="slip m-0 w-100 text-center rounded-2 d-flex flex-column justify-content-center" aria-live="polite">
        <span :key="selected" class="name">{{ reviewModes[selected].label }}</span>
        <span class="hint">{{ reviewModes[selected].hint }}</span>
      </p>
    </div>
  </div>
</template>

<style scoped>
/* zero-size anchor sitting above the plant; the sign grows upward from it */
.plant-review-actions {
  --plank: var(--bark);
  position: absolute;
  left: 0;
  bottom: var(--plant-overlay-bottom, 170px);
  width: 0;
  height: 0;
  pointer-events: auto;
}

/* fixed, narrow width: never wider than the plant beds beside it */
.sign {
  --stake: 24px;
  bottom: calc(var(--stake) + 8px);
  translate: -50% 0;
  width: 192px;
  padding: 10px 12px 10px;
  gap: 8px;
  background:
    repeating-linear-gradient(92deg, rgba(255, 255, 255, .06) 0 2px, transparent 2px 7px),
    repeating-linear-gradient(88deg, rgba(0, 0, 0, .1) 0 1px, transparent 1px 11px),
    var(--plank);
  /* paper-coloured halo = sticker outline: separates the sign from any sky, clouds or foliage */
  box-shadow: 0 0 0 3px var(--paper), 0 8px 14px 3px rgba(30, 20, 10, .4);
  animation: sign-in .6s var(--spring) backwards;
}

/* the stake: halo piece first, wood piece on top so it joins the plank */
.sign::before,
.sign::after {
  content: "";
  position: absolute;
  left: 50%;
  clip-path: polygon(0 0, 100% 0, 100% 55%, 50% 100%, 0 55%);
}
.sign::before { top: 100%; width: 22px; height: var(--stake); margin-left: -11px; background: var(--paper); }
.sign::after { top: calc(100% - 4px); width: 16px; height: calc(var(--stake) - 2px); margin-left: -8px; background: var(--plank); }

.tags { width: 100%; padding-top: 10px; }

/* a hand of cards: overlapping so three tags fit in ~160px */
.review-action {
  flex: 0 0 auto;
  width: 60px;
  height: 70px;
  background: var(--paper);
  border: 2px solid var(--ink);
  box-shadow: 0 3px 0 rgba(0, 0, 0, .35);
  cursor: pointer;
  transform: translateY(var(--dy)) rotate(var(--r));
  animation: deal .5s var(--spring) backwards;
  animation-delay: calc(var(--i) * 80ms + 150ms);
  transition: transform .35s var(--spring), background .2s, box-shadow .2s;
}
.review-action + .review-action { margin-left: -10px; }

.review-action .sp-tape {
  position: absolute;
  top: -11px;
  left: 50%;
  margin-left: -22px;
  transform: rotate(calc(var(--r) * -1.5));
  pointer-events: none;
}

.art-tile {
  width: 44px;
  height: 44px;
  background: var(--cream);
}

.review-action:hover { transform: translateY(calc(var(--dy) - 3px)) rotate(var(--r)); }
.review-action:active { transform: translateY(2px) rotate(var(--r)); box-shadow: 0 1px 0 rgba(0, 0, 0, .35); }
.review-action.is-on,
.review-action.is-on:hover {
  z-index: 2;
  background: var(--butter-soft);
  transform: translateY(-8px) rotate(0deg) scale(1.1);
  box-shadow: 0 0 0 2px var(--butter), 0 7px 0 rgba(0, 0, 0, .35);
}
.review-action:focus-visible { outline: 3px solid var(--butter); outline-offset: 3px; }

.ico { transition: transform .35s var(--spring); }
.review-action.is-on .ico { transform: scale(1.08); animation: boing .5s var(--spring); }
.review-action:active .ico { transform: scale(.9); }

/* the label: a handwritten paper slip pinned across the bottom of the sign */
.slip {
  min-height: 52px;
  padding: 5px 8px 6px;
  background: var(--sheet);
  color: var(--ink);
  box-shadow: inset 0 0 0 1.5px var(--ink);
  line-height: 1.15;
}
.slip .name {
  font-family: var(--f-hand);
  font-size: 1.1rem;
  font-weight: 700;
  animation: slip-swap .25s var(--ease);
}
.slip .hint { font-size: .7rem; font-weight: 700; color: var(--ink-soft); }

@keyframes sign-in { from { opacity: 0; transform: translateY(14px) scale(.9); } }
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
}
</style>