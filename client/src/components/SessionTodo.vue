<script setup>
import { ref, computed } from 'vue'
import { usePomodoroStore, coinsFor, MIN_COIN_MINUTES } from '@/stores/pomodoro'

// Left card on the Focus page (before Start and while running): the to-do list and the coin reward.
// The tasks live in the pomodoro store: the recommended reviews are added before Start, the user can add
// their own, and the list is cleared when a session ends.
const pomo = usePomodoroStore()
const draft = ref('')
const doneCount = computed(() => pomo.tasks.filter(t => t.done).length)
// the first unticked task is the one you're on, so it gets highlighted
const currentId = computed(() => pomo.tasks.find(t => !t.done)?.id)

function add() {
  pomo.addTask(draft.value)
  draft.value = ''
}

const coinIcon = new URL('../assets/ui/coin.svg', import.meta.url).href
// coins for this session's own plan, e.g. "+8 coins so far · +18 when you finish"
const reward = computed(() => {
  const blocks = pomo.phase === 'setup' ? pomo.plan : pomo.blocks // before Start: the times being picked
  const plannedSeconds = blocks.filter(b => b.type === 'focus').reduce((sum, b) => sum + b.seconds, 0)
  const planned = coinsFor(Math.floor(plannedSeconds / 60))  // if every focus block is finished
  const earned = coinsFor(Math.floor(pomo.focusDoneSeconds / 60)) // for the blocks finished so far
  if (!planned) return `Focus ${MIN_COIN_MINUTES}+ min in a session to earn coins`
  if (earned === planned) return `+${earned} coins earned`
  return earned ? `+${earned} coins so far · +${planned} when you finish` : `+${planned} coins when you finish`
})
</script>

<template>
  <section aria-labelledby="todo-title" data-testid="session-todo">
    <!-- same header as the Timer settings and Garden Radio cards: label on the left, count on the right -->
    <div class="d-flex justify-content-between align-items-baseline gap-2 mb-2">
      <span id="todo-title" class="text-label-caption sp-card-label" data-testid="todo-heading">To-do list</span>
      <span v-if="pomo.tasks.length" class="text-body-small" data-testid="todo-count">{{ doneCount }} / {{ pomo.tasks.length }} done</span>
    </div>

    <ul v-if="pomo.tasks.length" class="list-unstyled sp-rows mb-3">
      <li
        v-for="task in pomo.tasks" :key="task.id"
        class="task d-flex align-items-center gap-2" :class="{ done: task.done, current: task.id === currentId }"
      >
        <input
          :id="`task-${task.id}`" type="checkbox" class="form-check-input mt-0"
          :checked="task.done" @change="pomo.toggleTask(task.id)"
        />
        <label :for="`task-${task.id}`" class="flex-fill">{{ task.text }}</label>
        <!-- a recommended review links to that seed's review page -->
        <RouterLink
          v-if="task.seedId" :to="{ name: 'seed-review', params: { id: task.seedId } }" class="review-link"
          :aria-label="`Open ${task.text}`" title="Open this review"
        >↗</RouterLink>
        <button type="button" class="remove" :aria-label="`Remove ${task.text}`" @click="pomo.removeTask(task.id)">×</button>
      </li>
    </ul>

    <!-- Enter adds the task (phones show a "done" key) -->
    <form @submit.prevent="add">
      <input
        v-model="draft" type="text" maxlength="80" enterkeyhint="done" class="add-input"
        placeholder="+ Add a task…" aria-label="New task, press Enter to add" data-testid="todo-input"
      />
    </form>

    <div class="reward d-flex align-items-center gap-2 mt-3" data-testid="pomodoro-reward">
      <img :src="coinIcon" alt="" width="18" height="18" />
      <span>{{ reward }}</span>
    </div>
  </section>
</template>

<style scoped>
/* label and dashed rows come from theme.css (.sp-card-label, .sp-rows); the task you're on gets a soft butter highlight */
.task { padding: 8px; border-radius: var(--r-sm); }
.task.current { background: var(--butter-soft); }
.task label { cursor: pointer; overflow-wrap: anywhere; font-family: var(--f-body); color: var(--ink); }
.task.done label { color: var(--ink-faint); text-decoration: line-through; }

.form-check-input { width: 20px; height: 20px; border: 2px solid var(--ink-faint); border-radius: 50%; }
.form-check-input:checked { background-color: var(--leaf); border-color: var(--leaf); }
.form-check-input:focus { box-shadow: 0 0 0 .2rem var(--leaf-soft); }

/* the × only shows on hover (always on touch screens, which can't hover) */
.remove { border: 0; background: none; color: var(--ink-faint); font-size: 20px; line-height: 1; padding: 0 2px; opacity: 0; }
.task:hover .remove, .remove:focus-visible { opacity: 1; }
.remove:hover { color: var(--berry-ink); }
@media (hover: none) { .remove { opacity: 1; } }

/* the ↗ on a recommended review: opens that seed's review */
.review-link { color: var(--ink-soft); text-decoration: none; font-weight: 700; }
.review-link:hover, .review-link:focus-visible { color: var(--leaf); }

.add-input {
  width: 100%;
  padding: 8px 12px;
  border: 1.5px dashed var(--line);
  border-radius: var(--r-sm);
  background: transparent;
  color: inherit;
  font-family: var(--f-body);
}
.add-input::placeholder { color: var(--ink-faint); }
.add-input:focus { outline: none; border-style: solid; border-color: var(--leaf); }

.reward { padding-top: 12px; border-top: 1px dashed var(--line); font-family: var(--f-body); font-size: var(--fs-sm); font-weight: 700; color: var(--ink-soft); }
</style>
