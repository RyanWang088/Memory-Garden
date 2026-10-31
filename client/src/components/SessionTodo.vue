<script setup>
import { ref, computed } from 'vue'
import { usePomodoroStore, coinsFor, MIN_COIN_MINUTES } from '@/stores/pomodoro'
import { usePlannerStore, isoDay } from '@/stores/planner'

// To-do card on the Focus page, with the coin line:
// - today's planner tasks (ticking one here ticks it in the planner; × only hides it for this session)
// - this session's tasks: recommended reviews and the user's own (cleared when the session ends)
const pomo = usePomodoroStore()
const planner = usePlannerStore()
planner.load()
const draft = ref('')

// planner tasks first, then this session's; ticked ones at the bottom
const list = computed(() => {
  const today = isoDay(Date.now())
  const all = [
    ...planner.tasks.filter(t => t.date === today && !pomo.hiddenPlannerIds.includes(t.id))
      .map(t => ({ ...t, key: `planner-${t.id}`, fromPlanner: true })),
    ...pomo.tasks.map(t => ({ ...t, key: `session-${t.id}` })),
  ]
  return [...all.filter(t => !t.done), ...all.filter(t => t.done)]
})
const doneCount = computed(() => list.value.filter(t => t.done).length)
// highlight the first unticked task
const currentKey = computed(() => list.value.find(t => !t.done)?.key)

function toggle(task) {
  if (task.fromPlanner) planner.toggleDone(task.id)
  else pomo.toggleTask(task.id)
}
function remove(task) {
  if (task.fromPlanner) pomo.hidePlannerTask(task.id)
  else pomo.removeTask(task.id)
}

function add() {
  pomo.addTask(draft.value)
  draft.value = ''
}

const coinIcon = new URL('../assets/ui/coin.svg', import.meta.url).href
// coin line, e.g. "+10 coins so far · +20 when you finish"
const reward = computed(() => {
  const blocks = pomo.phase === 'setup' ? pomo.plan : pomo.blocks // before Start: use the times being set
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
    <!-- header: label on the left, count on the right -->
    <div class="d-flex justify-content-between align-items-baseline gap-2 mb-2">
      <span id="todo-title" class="text-label-caption sp-card-label" data-testid="todo-heading">To-do list</span>
      <span v-if="list.length" class="text-body-small" data-testid="todo-count">{{ doneCount }} / {{ list.length }} done</span>
    </div>

    <ul v-if="list.length" class="list-unstyled sp-rows mb-3">
      <li
        v-for="task in list" :key="task.key"
        class="task d-flex align-items-center gap-2" :class="{ done: task.done, current: task.key === currentKey }"
      >
        <input
          :id="`task-${task.key}`" type="checkbox" class="form-check-input mt-0"
          :checked="task.done" @change="toggle(task)"
        />
        <label :for="`task-${task.key}`" class="flex-fill">{{ task.text }}</label>
        <!-- a recommended review links to that seed's review page -->
        <RouterLink
          v-if="task.seedId" :to="{ name: 'seed-review', params: { id: task.seedId } }" class="review-link"
          :aria-label="`Open ${task.text}`" title="Open this review"
        >↗</RouterLink>
        <button
          type="button" class="remove" :aria-label="`Remove ${task.text}`"
          :title="task.fromPlanner ? 'Hide for this session (it stays in your planner)' : 'Remove'" @click="remove(task)"
        >×</button>
      </li>
    </ul>

    <!-- press Enter to add -->
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
/* the current task gets a soft butter highlight (label and dashed rows from theme.css) */
.task { padding: 8px; border-radius: var(--r-sm); }
.task.current { background: var(--butter-soft); }
.task label { cursor: pointer; overflow-wrap: anywhere; font-family: var(--f-body); color: var(--ink); }
.task.done label { color: var(--ink-faint); text-decoration: line-through; }

.form-check-input { width: 20px; height: 20px; border: 2px solid var(--ink-faint); border-radius: 50%; }
.form-check-input:checked { background-color: var(--leaf); border-color: var(--leaf); }
.form-check-input:focus { box-shadow: 0 0 0 .2rem var(--leaf-soft); }

/* × shows on hover (always on touch screens) */
.remove { border: 0; background: none; color: var(--ink-faint); font-size: 20px; line-height: 1; padding: 0 2px; opacity: 0; }
.task:hover .remove, .remove:focus-visible { opacity: 1; }
.remove:hover { color: var(--berry-ink); }
@media (hover: none) { .remove { opacity: 1; } }

/* ↗ opens the seed's review */
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
