<script setup>
import { computed } from 'vue'
import { examLabel } from '@/stores/garden'

// Asks where an exam's plants live once it is over: keep them in the garden, or move them to the flower house,
// where the subject shows as one keepsake flower. Emits 'choose' with 'garden' | 'house'; the parent does the work.
//   exam = { id, name, subject, subject_id, shelf_slot, seedIds } from garden.examsOver
const props = defineProps({
  exam: { type: Object, required: true },
  freeSlots: { type: Number, required: true },
  busy: { type: String, default: '' }, // the choice being saved, '' when idle
  error: { type: String, default: '' },
})
const emit = defineEmits(['choose'])

const plantCount = computed(() => props.exam.seedIds.length)
// a subject that is already on the shelf (from an earlier exam) keeps its slot, so it needs no free one
const canMove = computed(() => props.exam.shelf_slot !== null || props.freeSlots > 0)
</script>

<template>
  <section class="exam-over" role="dialog" aria-labelledby="exam-over-title" data-testid="exam-over">
    <h3 id="exam-over-title" class="m-0">{{ examLabel(exam.subject, exam.name) }} is over</h3>
    <p class="text-body-small m-0">
      Where should its {{ plantCount }} {{ plantCount === 1 ? 'bloom' : 'blooms' }} live? In the house they become
      keepsakes and stop asking for reviews.
    </p>
    <p v-if="!canMove" class="text-body-small m-0" data-testid="exam-over-full">
      Your shelves are full. Unlock more space on your <RouterLink :to="{ name: 'profile' }">profile</RouterLink>.
    </p>
    <p v-if="error" class="text-danger text-body-small m-0" role="alert">{{ error }}</p>
    <div class="actions d-flex justify-content-end flex-wrap gap-2">
      <button type="button" class="btn-outline text-button" :disabled="!!busy" data-testid="exam-keep" @click="emit('choose', 'garden')">
        {{ busy === 'garden' ? 'Saving…' : 'Keep in garden' }}
      </button>
      <button type="button" class="btn-primary border-0 text-button w-auto" :disabled="!!busy || !canMove"
        data-testid="exam-move" @click="emit('choose', 'house')">
        <img src="../assets/ui/shovel.svg" alt="" class="btn-icon" />
        {{ busy === 'house' ? 'Moving…' : 'Move to house' }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.exam-over {
  display: flex; flex-direction: column; gap: 8px;
  width: min(500px, calc(100% - 32px)); padding: 20px;
  background: var(--paper); color: var(--bark);
  border: 2px solid var(--bark); border-radius: 16px; box-shadow: 0 4px 0 var(--bark);
}
.actions { margin-top: 8px; }
.btn-outline {
  min-height: 44px; padding: 8px 18px; border: 2px solid var(--bark); border-radius: 999px;
  background: var(--paper); color: var(--bark); box-shadow: 0 3px 0 var(--bark);
  transition: transform .15s ease, box-shadow .15s ease;
}
.btn-outline:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 5px 0 var(--bark); }
.btn-outline:active:not(:disabled) { transform: translateY(2px); box-shadow: 0 1px 0 var(--bark); }
.btn-primary:disabled, .btn-outline:disabled { opacity: .55; cursor: not-allowed; transform: none; }
.btn-icon { width: 20px; height: 20px; }
/* phones: compact so the garden still peeks out above the shed drawer */
@media (max-width: 575.98px) {
  .exam-over { padding: 14px 16px; gap: 6px; }
  .exam-over h3 { font-size: 18px; line-height: 24px; }
  .actions { flex-wrap: nowrap !important; margin-top: 4px; }
  .actions > * { flex: 1 1 0; min-height: 40px; padding: 6px 10px; font-size: 14px; justify-content: center; }
}
</style>
