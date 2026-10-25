<script setup>
import { computed } from 'vue'
import { tagStyle } from '@/lib/tagColors'
import { isWilting } from '@/lib/plantStage'

const props = defineProps({
  seed: { type: Object, required: true },
})
defineEmits(['select'])
//delete below when backend done
const DAY = 86400000
const REVIEW_EVERY_DAYS = 3 // next review = last review + 3 days

const LABELS = {
  new: 'New',
  due: 'Due today',
  wilting: 'Wilting',
  growing: 'Growing',
  mastered: 'Mastered',
}

const mastery = computed(() => props.seed.mastery ?? 0) // 0-100, if you track it

const daysSinceReview = computed(() =>
  Math.floor((Date.now() - new Date(props.seed.last_reviewed)) / DAY)
)

const status = computed(() => {
  if (mastery.value >= 100) return 'mastered'
  if (!props.seed.last_reviewed) return 'new'
  if (isWilting(props.seed)) return 'wilting'
  if (daysSinceReview.value >= REVIEW_EVERY_DAYS) return 'due'
  return 'growing'
})

const nextReview = computed(() => {
  if (status.value === 'new') return 'Ready to start'
  const left = REVIEW_EVERY_DAYS - daysSinceReview.value
  return left <= 0 ? 'Review today' : `Next review in ${left}d`
})

const flowerImage = computed(() =>
  new URL(`../assets/foliage/${props.seed.flower || 'tulip'}-4.svg`, import.meta.url).href
)
</script>

<template>
  <button
    class="seed-card d-flex align-items-center gap-3 bg-white text-start"
    @click="$emit('select', seed)"
  >
    <div class="bg rounded-3 flex-shrink-0">
      <img class="img-fluid w-100 h-75 object-fit-contain" :src="flowerImage" :alt="`${seed.flower || 'tulip'} flower`" />
    </div>

    <div class="d-flex flex-grow-1 flex-column gap-1 overflow-hidden">
      <div class="d-flex align-items-center gap-1">
        <span v-if="seed.subject" class="tag-pill" :style="tagStyle('peri')">{{ seed.subject }}</span>
        <span class="badge text-label-caption flex-shrink-0" :class="`status-badge--${status}`">
          {{ LABELS[status] }}
        </span>
      </div>

      <span class="text-body-strong d-block text-break">{{ seed.title }}</span>
      <span class="text-body-small d-block text-truncate">{{ nextReview }}</span>

      <div class="progress w-100 flex-shrink-0" role="progressbar" :aria-valuenow="mastery" aria-valuemin="0" aria-valuemax="100">
        <div class="progress-fill" :style="{ width: mastery + '%' }"></div>
      </div>
    </div>
  </button>
</template>

<style scoped>
.seed-card {
  box-sizing: border-box;
  width: min(340px, 100%);
  min-height: 126px; /* was height: grows with long titles */
  padding: 12px 16px 12px 12px;
  border: 2px solid var(--linen);
  border-radius: 16px;
  color: var(--bark);
  cursor: pointer;
}

.bg {
  display: flex;
  flex: 0 0 72px;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 80px;
  overflow: hidden;
  background-color: var(--linen);
}
</style>