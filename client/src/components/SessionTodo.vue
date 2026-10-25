<script setup>
import { ref, computed } from 'vue'
import { usePomodoroStore, FOCUS_REWARD } from '@/stores/pomodoro'

// Left card on the running Focus page: the session topic, its to-do list and the reward.
// The tasks live in the pomodoro store and are cleared when a new session starts.
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
// during a break, show what's been earned so far (break n comes right after focus block n)
const reward = computed(() => {
  if (pomo.mode === 'focus') return `+${FOCUS_REWARD.coins} coins when it ends`
  const blocksDone = pomo.current.number
  return `Earned so far: +${blocksDone * FOCUS_REWARD.coins} coins`
})
</script>

<template>
  <section aria-labelledby="todo-title" data-testid="session-todo">
    <div class="d-flex justify-content-between align-items-baseline">
      <span id="todo-title" class="text-label-caption">Focusing on</span>
      <span v-if="pomo.tasks.length" class="text-body-small" data-testid="todo-count">{{ doneCount }} / {{ pomo.tasks.length }} done</span>
    </div>
    <div class="text-body-strong mb-3" data-testid="pomodoro-topic-label">{{ pomo.topic }}</div>

    <ul v-if="pomo.tasks.length" class="list-unstyled d-grid gap-2 mb-2">
      <li
        v-for="task in pomo.tasks" :key="task.id"
        class="task d-flex align-items-center gap-2" :class="{ done: task.done, current: task.id === currentId }"
      >
        <input
          :id="`task-${task.id}`" type="checkbox" class="form-check-input mt-0"
          :checked="task.done" @change="pomo.toggleTask(task.id)"
        />
        <label :for="`task-${task.id}`" class="flex-fill">{{ task.text }}</label>
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
/* each task is a soft pill; the one you're on is outlined in periwinkle */
.task {
  padding: 8px 12px;
  background: var(--cream);
  border: 2px solid transparent;
  border-radius: 10px;
}
.task.current { background: var(--peri-soft); border-color: var(--periwinkle); }
.task label { cursor: pointer; overflow-wrap: anywhere; }
.task.done label { color: var(--bark-muted); text-decoration: line-through; }

.form-check-input { width: 18px; height: 18px; border: 2px solid var(--bark-muted); border-radius: 5px; }
.form-check-input:checked { background-color: var(--mint-deep); border-color: var(--mint-deep); }
.form-check-input:focus { box-shadow: 0 0 0 .2rem var(--peri-soft); }

/* the × only shows on hover (always on touch screens, which can't hover) */
.remove { border: 0; background: none; color: var(--bark-muted); font-size: 20px; line-height: 1; padding: 0 2px; opacity: 0; }
.task:hover .remove, .remove:focus-visible { opacity: 1; }
.remove:hover { color: var(--berry-ink); }
@media (hover: none) { .remove { opacity: 1; } }

.add-input {
  width: 100%;
  padding: 8px 12px;
  border: 2px dashed var(--linen);
  border-radius: 10px;
  background: transparent;
  color: inherit;
}
.add-input::placeholder { color: var(--bark-muted); }
.add-input:focus { outline: none; border-style: solid; border-color: var(--periwinkle); }

.reward {
  padding: 8px 12px;
  background: #FFF3C4; /* light butter */
  border-radius: 10px;
  font-family: var(--f-display);
  font-weight: 500;
  font-size: 14px;
}
.text-body-strong[data-testid="pomodoro-topic-label"] { font-family: var(--f-hand); font-size: 1.7rem; line-height: 1.1; font-weight: 600; overflow-wrap: anywhere; }
.task label { font-family: var(--f-hand); font-size: 1.3rem; line-height: 1.1; }
.task { background: transparent; }
.task.current { background: var(--butter-soft); border-color: transparent; }
.task.done label { text-decoration-color: var(--berry-deep); color: var(--ink-faint); }
.form-check-input { border-radius: 50%; width: 22px; height: 22px; border-color: var(--ink-faint); }
.form-check-input:checked { background-color: var(--leaf); border-color: var(--leaf); }
.add-input { font-family: var(--f-hand); font-size: 1.25rem; border-color: var(--line); }
.add-input:focus { border-color: var(--leaf); }
.reward { background: transparent; border-top: 1.5px dashed var(--line); border-radius: 0; padding: 12px 0 0; font-family: var(--f-body); font-weight: 700; color: var(--ink-soft); }
</style>
