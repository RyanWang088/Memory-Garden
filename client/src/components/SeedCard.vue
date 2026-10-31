<script setup>
import { computed } from 'vue'
import { isWilting, plantStage } from '@/lib/plantStage'
import { plantSpriteUrl } from '@/lib/plantSprites'

const props = defineProps({
  seed: { type: Object, required: true },
})
defineEmits(['select', 'edit'])
const DAY = 86_400_000

const LABELS = { new: 'New', due: 'Due', wilting: 'Wilting', growing: 'Growing', mastered: 'Mastered' }

const cards = computed(() => Array.isArray(props.seed.cards) ? props.seed.cards : [])
const scheduledReviews = computed(() => cards.value
  .map(card => card.next_review ? Date.parse(card.next_review) : null)
  .filter(reviewAt => reviewAt === null || Number.isFinite(reviewAt)))
const dueCards = computed(() => cards.value.filter(card =>
  !card.next_review || Date.parse(card.next_review) <= Date.now()
))
const earliestReviewAt = computed(() => {
  const scheduled = scheduledReviews.value.filter(reviewAt => reviewAt !== null)
  return scheduled.length ? Math.min(...scheduled) : null
})
const reviewText = computed(() => {
  if (!cards.value.length) return 'Ready to start'
  if (dueCards.value.length) {
    const oldestDueAt = dueCards.value.reduce((oldest, card) => {
      const reviewAt = card.next_review ? Date.parse(card.next_review) : Date.now()
      return Math.min(oldest, reviewAt)
    }, Date.now())
    const overdueDays = Math.floor((Date.now() - oldestDueAt) / DAY)
    if (overdueDays <= 0) return 'Due today'
    return `${overdueDays} day${overdueDays === 1 ? '' : 's'} overdue`
  }
  if (earliestReviewAt.value === null) return 'Ready to start'
  const daysUntilReview = Math.ceil((earliestReviewAt.value - Date.now()) / DAY)
  return `Next review in ${daysUntilReview}d`
})

const meta = computed(() => {
  return [
    props.seed.subject,
    cards.value.length && `${cards.value.length} cards`,
    reviewText.value,
  ].filter(Boolean).join(' · ')
})

const status = computed(() => {
  if ((props.seed.mastery ?? 0) >= 100) return 'mastered'
  if (!props.seed.last_reviewed) return 'new'
  if (isWilting(props.seed)) return 'wilting'
  if (dueCards.value.length) return 'due'
  return 'growing'
})
const mastery = computed(() => Math.max(0, Math.min(100, Math.round(props.seed.mastery ?? 0))))

const stage = computed(() => plantStage(props.seed))
const flowerImage = computed(() => plantSpriteUrl(stage.value, props.seed.flower, props.seed.color))
</script>

<template>
  <!-- a little ticket: the plant on a tinted stub, details on the right, a status stamp on top.
       The ticket opens the review; Edit is its own button beside it (a button can't sit inside another button). -->
  <div class="seed-card" :class="`status-${status}`">
    <button class="sc-open" type="button" @click="$emit('select', seed)">
      <span class="sc-stub"><img :src="flowerImage" alt="" /></span>

      <span class="sc-body">
        <span class="sc-title">{{ seed.title }}</span>
        <span class="sc-meta">{{ meta }}</span>
        <span class="sc-grow" :title="`${mastery}% grown`">
          <span class="sp-meter-bar" role="progressbar" :aria-valuenow="mastery" aria-valuemin="0" aria-valuemax="100" aria-label="Mastery"><i :style="{ width: `${mastery}%` }"></i></span>
          <b>{{ mastery }}%</b>
        </span>
      </span>

      <span class="sc-stamp">
        <svg v-if="status === 'due' || status === 'wilting'" class="drop" viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M12 2.5C9 7 6 10.2 6 14a6 6 0 0 0 12 0c0-3.8-3-7-6-11.5z" /></svg>
        {{ LABELS[status] }}
      </span>
    </button>

    <button class="sc-edit" type="button" :aria-label="`Edit ${seed.title}`" data-testid="seed-edit" @click="$emit('edit', seed)">Edit</button>
  </div>
</template>

<style scoped>
.seed-card {
  --tone: var(--lilac); --tone-soft: color-mix(in srgb, var(--lilac) 28%, var(--paper));
  position: relative; width: 100%; border-radius: 16px; overflow: hidden; isolation: isolate;
  background: var(--paper); color: var(--ink);
  box-shadow: var(--shadow-1);
  transition: transform .3s var(--spring), box-shadow .25s var(--ease);
}
.seed-card:hover { transform: translateY(-3px) rotate(-.6deg); box-shadow: var(--shadow-2); }

/* the ticket itself: opens the seed's review */
.sc-open {
  display: grid; grid-template-columns: 78px 1fr; align-items: stretch;
  width: 100%; min-height: 92px; padding: 0; border: 0; border-radius: inherit;
  background: none; color: inherit; font: inherit; text-align: left; cursor: pointer;
}
/* drawn inside the edge: the card clips anything outside it */
.sc-open:focus-visible { outline: 3px solid color-mix(in srgb, var(--leaf) 45%, transparent); outline-offset: -3px; }

/* Edit: a small outlined pill in the bottom-right corner, beside the mastery % */
.sc-edit {
  position: absolute; z-index: 2; right: 12px; bottom: 12px;
  padding: 2px 12px; border: 1.5px solid var(--ink); border-radius: 999px;
  background: var(--paper); color: var(--ink);
  font-size: .72rem; font-weight: 800; line-height: 1.4; cursor: pointer;
  transition: background .2s var(--ease), color .2s var(--ease);
}
.sc-edit:hover { background: var(--ink); color: var(--paper); }
.sc-edit:focus-visible { outline: 3px solid color-mix(in srgb, var(--leaf) 45%, transparent); outline-offset: 2px; }

.status-new { --tone: var(--lilac); --tone-soft: color-mix(in srgb, var(--lilac) 28%, var(--paper)); }
.status-due { --tone: var(--berry); --tone-soft: var(--berry-soft); }
.status-wilting { --tone: var(--berry-deep); --tone-soft: color-mix(in srgb, var(--berry-soft) 70%, var(--butter-soft)); }
.status-growing { --tone: var(--butter-deep); --tone-soft: var(--butter-soft); }
.status-mastered { --tone: var(--leaf); --tone-soft: var(--leaf-soft); }

/* tinted stub with ticket perforations */
.sc-stub { position: relative; display: grid; place-items: end center; padding: 8px 6px 0; background: var(--tone-soft); }
.sc-stub::after { content: ""; position: absolute; right: -6px; top: 0; bottom: 0; width: 12px; background: radial-gradient(circle at 6px 8px, var(--paper)4px, transparent 4.5px) 0 0 / 12px 16px; }
.sc-stub img { width: 64px; height: 72px; object-fit: contain; object-position: 50% 100%; transform-origin: 50% 100%; transition: transform .45s var(--spring); }
.seed-card:hover .sc-stub img { transform: scale(1.12) rotate(-3deg); }

.sc-body { display: grid; gap: 3px; align-content: center; min-width: 0; padding: 12px 84px 12px 20px; }
.sc-title { font-family: var(--f-hand); font-weight: 700; font-size: 1.35rem; line-height: 1.05; overflow-wrap: anywhere; }
.sc-meta { font-size: .74rem; font-weight: 700; line-height: 1.35; color: var(--ink-soft); }
.sc-grow { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
.sc-grow .sp-meter-bar { flex: 1; }
.sc-grow .sp-meter-bar i { background: var(--tone); }
.sc-grow b { min-width: 3ch; font-size: .7rem; font-weight: 800; font-variant-numeric: tabular-nums; color: var(--ink-soft); }

/* the stamp slams down on hover */
.sc-stamp {
  position: absolute; z-index: 1; top: 10px; right: 10px; display: inline-flex; align-items: center; gap: 4px;
  padding: 1px 7px; border: 1.5px solid var(--tone); border-radius: 4px; background: rgba(255, 255, 255, .75);
  font-size: .58rem; font-weight: 900; letter-spacing: .1em; text-transform: uppercase;
  color: color-mix(in srgb, var(--tone) 70%, var(--ink));
  transform: rotate(6deg); transition: transform .3s var(--spring);
}
.seed-card:hover .sc-stamp { transform: rotate(-3deg) scale(1.12); }
.sc-stamp .drop { animation: bob 1s ease-in-out infinite alternate; }
</style>