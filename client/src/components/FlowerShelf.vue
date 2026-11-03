<script setup>
import { computed } from 'vue'
import { plantSpriteUrl, BLOOM_STAGE } from '@/lib/plantSprites'
import { SHELF_UNLOCK_PRICE } from '@/stores/garden'

// The flower house shelf: 3 rows of 6 slots, one keepsake flower per subject in its shelf_slot.
// Row 3 stays locked until it is bought. Emits 'unlock'.
//   subjects = garden.housedSubjects ([{ id, name, shelf_slot, flower, color }])
//   newId    = a subject just moved here, which pops into its slot
const props = defineProps({
  subjects: { type: Array, required: true },
  unlocked: { type: Boolean, default: false },
  coins: { type: Number, default: 0 },
  unlocking: { type: Boolean, default: false },
  newId: { type: String, default: '' },
})
const emit = defineEmits(['unlock'])

const ROWS = 3, PER_ROW = 6
const VASE_COLORS = ['var(--peach)', 'var(--peri-soft)', 'var(--lilac)', 'var(--cream)', 'var(--butter)', 'var(--mint)']

const rows = computed(() => {
  const bySlot = new Map(props.subjects.map(s => [s.shelf_slot, s]))
  return Array.from({ length: ROWS }, (_, row) => ({
    locked: row === ROWS - 1 && !props.unlocked,
    slots: Array.from({ length: PER_ROW }, (_, i) => ({ slot: row * PER_ROW + i, subject: bySlot.get(row * PER_ROW + i) })),
  }))
})
const canAfford = computed(() => props.coins >= SHELF_UNLOCK_PRICE)
</script>

<template>
  <section class="house" aria-label="Flower house shelves" data-testid="flower-shelf">
    <div v-for="(row, r) in rows" :key="r" class="shelf-row" :class="{ locked: row.locked }">
      <ul v-if="!row.locked" class="slots list-unstyled m-0">
        <li v-for="{ slot, subject } in row.slots" :key="slot" class="slot" :data-testid="subject ? 'shelf-flower' : 'shelf-empty'">
          <div v-if="subject" class="keepsake" :class="{ 'is-new': subject.id === newId }" tabindex="0"
            :aria-label="subject.name" :style="{ '--vase': VASE_COLORS[slot % VASE_COLORS.length] }">
            <img class="bloom" :src="plantSpriteUrl(BLOOM_STAGE, subject.flower, subject.color)" alt="" draggable="false" />
            <svg class="vase" viewBox="0 0 48 56" aria-hidden="true">
              <path d="M16 2h16v6c0 3 2 5 6 9 5 5 8 11 8 19 0 11-9 18-22 18S2 47 2 36c0-8 3-14 8-19 4-4 6-6 6-9z" />
              <ellipse cx="24" cy="4" rx="9" ry="2.5" class="vase-rim" />
            </svg>
            <span class="label sp-field">{{ subject.name }}</span>
          </div>
          <div v-else class="empty" aria-hidden="true"></div>
        </li>
      </ul>
      <div v-else class="unlock d-flex flex-column align-items-center justify-content-center gap-1">
        <button type="button" class="unlock-pill text-button" :disabled="!canAfford || unlocking" data-testid="shelf-unlock"
          @click="emit('unlock')">
          {{ unlocking ? 'Unlocking…' : `Unlock ${PER_ROW} more slots · ${SHELF_UNLOCK_PRICE} coins` }}
        </button>
        <span v-if="!canAfford" class="text-body-small">You need {{ SHELF_UNLOCK_PRICE - coins }} more coins.</span>
      </div>
      <div class="plank" aria-hidden="true"></div>
    </div>
  </section>
</template>

<style scoped>
.house {
  --wood: #D9B48F;
  --wood-edge: #B98E68;
  --stripe: #F6E6DA;
  display: flex; flex-direction: column; gap: 4px;
  padding: 24px 24px 20px;
  border: 3px solid var(--linen); border-radius: 28px;
  background: repeating-linear-gradient(90deg, var(--stripe) 0 40px, var(--linen) 40px 80px);
}
.shelf-row { position: relative; }
.slots {
  display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); align-items: end;
  height: 170px; padding: 0 4%;
}
.slot { display: flex; justify-content: center; align-items: flex-end; height: 100%; }

.empty { width: 52px; height: 64px; border: 2px dashed #CDB5A3; border-radius: 8px; }

/* the bloom's stem goes into the vase; the vase sits on the plank */
.keepsake { position: relative; width: 100%; max-width: 110px; height: 100%; outline: none; }
.bloom { position: absolute; left: 50%; bottom: 30px; width: 100%; height: auto; max-height: 140px; transform: translateX(-50%); object-fit: contain; object-position: bottom; }
.vase { position: absolute; left: 50%; bottom: 0; width: 46px; height: 54px; transform: translateX(-50%); }
.vase path { fill: var(--vase); stroke: var(--bark); stroke-width: 2.5; stroke-linejoin: round; }
.vase-rim { fill: var(--paper); opacity: .6; }

/* subject name on hover / keyboard focus */
.label {
  position: absolute; left: 50%; top: 0; z-index: 2; max-width: 160px; padding: 4px 10px;
  border-radius: 999px; background: var(--paper); box-shadow: 0 2px 6px var(--shadow-card);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  opacity: 0; transform: translate(-50%, 4px); transition: opacity .2s, transform .25s var(--spring); pointer-events: none;
}
.keepsake:hover .label, .keepsake:focus-visible .label { opacity: 1; transform: translate(-50%, 0); }
.keepsake:focus-visible .vase path { stroke: var(--periwinkle); }

/* a subject just moved here pops into its slot */
.is-new { animation: keepsakeIn .8s var(--spring) .3s both; transform-origin: 50% 100%; }
@keyframes keepsakeIn {
  from { opacity: 0; transform: translateY(-30px) scale(.4); }
  to { opacity: 1; transform: none; }
}

.plank {
  position: relative; height: 16px; margin: 0 -4px;
  background: var(--wood); border: 2px solid var(--wood-edge); border-radius: 4px;
}
/* brackets under each end of the plank */
.plank::before, .plank::after {
  content: ''; position: absolute; top: 100%; width: 0; height: 0;
  border-left: 9px solid transparent; border-right: 9px solid transparent; border-top: 14px solid var(--wood-edge);
}
.plank::before { left: 18px; }
.plank::after { right: 18px; }

.locked .unlock { height: 170px; }
.locked .plank { opacity: .7; }
.unlock-pill {
  padding: 10px 24px; border: 0; border-radius: 999px;
  background: var(--cream); color: var(--bark); box-shadow: 0 2px 6px var(--shadow-card);
  transition: transform .15s ease, box-shadow .15s ease;
}
.unlock-pill:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 4px 10px var(--shadow-card); }
.unlock-pill:disabled { opacity: .6; cursor: not-allowed; }

@media (max-width: 575.98px) {
  .house { padding: 16px 12px 14px; border-radius: 20px; }
  .slots, .locked .unlock { height: 120px; }
  .slots { padding: 0; }
  .empty { width: 34px; height: 44px; }
  .bloom { bottom: 22px; max-height: 96px; }
  .vase { width: 32px; height: 38px; }
}
@media (prefers-reduced-motion: reduce) {
  .is-new { animation-duration: .01s; animation-delay: 0s; }
}
</style>
