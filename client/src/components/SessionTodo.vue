<script setup>
import { ref, computed, nextTick } from 'vue'
import { usePomodoroStore, coinsFor, MIN_COIN_MINUTES } from '@/stores/pomodoro'
import { usePlannerStore, isoDay } from '@/stores/planner'
import { burst } from '@/lib/burst'

// To-do card on the Focus page, with the coin line:
// - today's planner tasks (ticking one here ticks it in the planner; × only hides it for this session)
// - this session's tasks: recommended reviews, and the user's own (unfinished ones carry over to the next session)
const pomo = usePomodoroStore()
const planner = usePlannerStore()
planner.load()
const draft = ref('')
const showInfo = ref(false)
const removing = ref(new Set())

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

function toggle(task, event) {
  const wasDone = task.done
  if (task.fromPlanner) planner.toggleDone(task.id)
  else pomo.toggleTask(task.id)
  if (!wasDone) burst(event.currentTarget)
}
function remove(task) {
  if (removing.value.has(task.key)) return
  removing.value = new Set(removing.value).add(task.key)
  setTimeout(() => {
    if (task.fromPlanner) pomo.hidePlannerTask(task.id)
    else pomo.removeTask(task.id)
    removing.value.delete(task.key)
  }, 350)
}

// a long list scrolls inside the card, so show the new task (it sits after the other unticked ones)
const listEl = ref(null)
async function add() {
  pomo.addTask(draft.value)
  draft.value = ''
  await nextTick()
  listEl.value?.children[list.value.filter(t => !t.done).length - 1]?.scrollIntoView({ block: 'nearest' })
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
      <span class="d-flex align-items-center gap-1">
        <span id="todo-title" class="text-label-caption text-berry-deep" data-testid="todo-heading">To-do list</span>
        <!-- how long typed tasks last: shows on hover or keyboard focus, and on tap for phones -->
        <span class="info-wrap">
          <button
            type="button" class="info" :aria-expanded="showInfo" aria-label="About typed tasks" data-testid="todo-info"
            @click="showInfo = !showInfo" @blur="showInfo = false"
          >i</button>
          <span class="info-tip" :class="{ open: showInfo }" role="tooltip" data-testid="todo-info-tip">Tasks typed here clear when you close this tab or log out. Use the planner to keep them.</span>
        </span>
      </span>
      <span v-if="list.length" class="text-body-small" data-testid="todo-count">{{ doneCount }} / {{ list.length }} done</span>
    </div>

    <ul v-if="list.length" ref="listEl" class="todo-list list-unstyled sp-rows mb-3">
      <li
        v-for="task in list" :key="task.key"
        class="task sp-task-row d-flex align-items-center gap-2"
        :class="{ done: task.done, 'is-done': task.done, 'is-removing': removing.has(task.key), current: task.key === currentKey }"
      >
        <button
          type="button" class="sp-check" :class="{ 'is-ticked': task.done }" role="checkbox" :aria-checked="task.done"
          :aria-label="`Mark “${task.text}” ${task.done ? 'not done' : 'done'}`" @click="toggle(task, $event)"
        >
          <svg viewBox="0 0 30 30" aria-hidden="true"><circle class="sp-check-ring" cx="15" cy="15" r="12" /><path class="sp-check-ink" d="M15 3.2C22 3 27.2 8.4 26.8 15.3 26.4 22 21 27 14.6 26.8 8 26.6 3 21.4 3.3 14.8 3.6 8.2 9 3.4 16 3.6" /><path class="sp-check-tick" d="M9.5 15.5l3.8 3.8 7.4-8.3" /></svg>
        </button>
        <span class="sp-task-label flex-fill">{{ task.text }}</span>
        <!-- a recommended review returns to the plant and opens its review controls -->
        <RouterLink
          v-if="task.seedId" :to="{ name: 'garden', query: { scrollTo: task.seedId } }" class="review-link"
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
/* the i next to the title and its message */
.info-wrap { position: relative; display: inline-flex; }
.info { width: 16px; height: 16px; display: grid; place-items: center; padding: 0; border: 1.5px solid var(--ink-faint); border-radius: 50%; background: none; color: var(--ink-soft); font-size: 11px; font-weight: 800; line-height: 1; }
.info:hover, .info:focus-visible { border-color: var(--leaf); color: var(--leaf); }
.info-tip { position: absolute; z-index: 5; top: calc(100% + 6px); left: -70px; width: 220px; padding: 8px 10px; border-radius: var(--r-sm); background: var(--ink); color: var(--sheet); font-size: var(--fs-xs); font-weight: 600; line-height: 1.35; opacity: 0; visibility: hidden; transition: opacity .15s, visibility .15s; }
.info:hover + .info-tip, .info:focus-visible + .info-tip, .info-tip.open { opacity: 1; visibility: visible; }

/* long lists scroll here, so Add a task and the coin line stay in view */
.todo-list { max-height: 420px; overflow-x: hidden; overflow-y: auto; }
/* the current task gets a soft butter highlight (label and dashed rows from theme.css) */
.task { padding: 8px; border-radius: var(--r-sm); }
.task.current { background: var(--butter-soft); }

/* × shows on hover (always on touch screens) */
.remove { border: 0; background: none; color: var(--ink-faint); font-size: 20px; line-height: 1; padding: 0 2px; opacity: 0; }
.task:hover .remove, .remove:focus-visible { opacity: 1; }
.remove:hover { color: var(--berry-deep); }
@media (hover: none) { .remove { opacity: 1; } }

/* ↗ opens the seed in the garden */
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
