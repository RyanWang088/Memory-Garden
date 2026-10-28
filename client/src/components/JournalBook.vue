<script setup>
import { ref, reactive, computed, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useJournalStore, isoDay } from '@/stores/journal'
import { useAuthStore } from '@/stores/auth'
import { usePomodoroStore } from '@/stores/pomodoro'
import { foliageUrl } from '@/lib/plantSprites'
import { burst, vBurst } from '@/lib/burst'
import SproutIcon from '@/components/SproutIcon.vue'
import potArt from '@/assets/ui/pot.svg'

// The open-book journal: to-do list on the left page, month calendar on the right.
// Ported from the reviewed Sproutly Interactive HTML (assets/journal.js + book.css).
//   cover:    starts closed and swings open (autoOpen ms, or click)
//   compact:  shorter pages, no "Focus on this" (landing page demo)
//   demo:     uses sample tasks kept in this component only (landing page, signed-out visitors)
const props = defineProps({
  cover: { type: Boolean, default: false },
  autoOpen: { type: Number, default: 0 },
  compact: { type: Boolean, default: false },
  demo: { type: Boolean, default: false },
})

const router = useRouter()
const auth = useAuthStore()
const pomo = usePomodoroStore()

/* ---------- data source: the journal store, or a local sample for the landing page ---------- */
const DAY = 864e5
const TODAY = new Date(); TODAY.setHours(0, 0, 0, 0)
const todayIso = isoDay(TODAY)
const plusDays = (n) => isoDay(TODAY.getTime() + n * DAY)
function demoSource() {
  const SUBJ = [
    { name: 'Statistics', color: '#3E8B57' }, { name: 'Calculus', color: '#4F86C6' }, { name: 'UI/UX Design', color: '#E0546A' },
    { name: 'WAD', color: '#8D72D6' }, { name: 'Finance', color: '#D99E2B' }, { name: 'Data Analytics', color: '#2E9C9C' }, { name: 'Life', color: '#9A8174' },
  ]
  let n = 0
  const t = (off, text, subject, done = false, star = false) => ({ id: `d${n++}`, text, subject, date: plusDays(off), done, star })
  const tasks = ref([
    t(0, 'Statistics: hypothesis tests', 'Statistics', false, true), t(0, 'Calculus problem set 4', 'Calculus', true),
    t(0, 'WAD lab: Pinia store', 'WAD'), t(0, 'Water the garden', 'Life'),
    t(1, 'UI/UX: usability test notes', 'UI/UX Design'), t(2, 'Finance: NPV questions', 'Finance'),
    t(-1, 'Calculus: chain rule drills', 'Calculus', true), t(3, 'Data Analytics: SQL joins', 'Data Analytics'),
  ])
  const find = (id) => tasks.value.find((x) => x.id === id)
  return reactive({
    tasks, subjects: SUBJ, LIFE: 'Life',
    exams: [{ date: plusDays(9), subject: 'Statistics', title: 'Statistics exam' }, { date: plusDays(16), subject: 'Calculus', title: 'Calculus exam' }],
    reviewsDue: [{ seedId: 'x', title: 'Hypothesis testing', subject: 'Statistics', date: todayIso }],
    colorOf: (name) => SUBJ.find((s) => s.name === name)?.color ?? '#9A8174',
    readiness: () => 64,
    addTask({ text, subject, date }) { const task = { id: `d${n++}`, text: text.trim().slice(0, 90), subject, date, done: false, star: false }; tasks.value.push(task); return task },
    toggleDone: (id) => { const x = find(id); if (x) x.done = !x.done },
    toggleStar: (id) => { const x = find(id); if (x) x.star = !x.star },
    rename: (id, text) => { const x = find(id); if (x && text.trim()) x.text = text.trim().slice(0, 90) },
    remove: (id) => { tasks.value = tasks.value.filter((x) => x.id !== id) },
  })
}
const src = props.demo ? demoSource() : useJournalStore()
if (!props.demo) src.load()

const flower = computed(() => auth.profile?.onboarding_answers?.flower || 'pink')
const subjectColor = (name) => src.colorOf(name)

/* ---------- state ---------- */
const state = reactive({
  selected: todayIso,
  view: new Date(TODAY.getFullYear(), TODAY.getMonth(), 1),
  filter: 'week', // 'week' | 'month' | 'all' (week and month follow the picked date)
  side: 'left',  // single-page mode (narrow screens): which page shows
  turn: 'next',  // direction of the page-turn animation
})
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
const fmt = (d, o) => d.toLocaleDateString('en-GB', o)

/* ---------- cover ---------- */
const closed = ref(props.cover)
const settled = ref(!props.cover)
function openBook() {
  if (!closed.value) return
  closed.value = false
  setTimeout(() => (settled.value = true), 1300)
}
function closeBook() { settled.value = false; closed.value = true }
let openTimer = null
onMounted(() => { if (props.cover && props.autoOpen) openTimer = setTimeout(openBook, props.autoOpen) })
onBeforeUnmount(() => clearTimeout(openTimer))
defineExpose({ open: openBook, close: closeBook })

/* ---------- left page: to-do ---------- */
// the week (Monday–Sunday) and month around the picked date
const range = computed(() => {
  const sel = parse(state.selected)
  if (state.filter === 'week') {
    const start = new Date(sel.getFullYear(), sel.getMonth(), sel.getDate() - ((sel.getDay() + 6) % 7))
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6)
    return { from: isoDay(start), to: isoDay(end), start, end }
  }
  if (state.filter === 'month') {
    const start = new Date(sel.getFullYear(), sel.getMonth(), 1), end = new Date(sel.getFullYear(), sel.getMonth() + 1, 0)
    return { from: isoDay(start), to: isoDay(end), start, end }
  }
  return null
})
const inScope = (t) => !range.value || (t.date >= range.value.from && t.date <= range.value.to)
const visibleTasks = computed(() => src.tasks.filter(inScope)
  .sort((a, b) => a.date.localeCompare(b.date) || (a.done - b.done) || (b.star - a.star)))
// a divider line before each new day; the picked day is highlighted
const rows = computed(() => {
  let last = ''
  return visibleTasks.value.flatMap((t) => {
    const out = []
    if (t.date !== last) out.push({ divider: true, key: `div-${t.date}`, label: dayWord(t.date, true), picked: t.date === state.selected })
    last = t.date
    out.push({ task: t, key: t.id })
    return out
  })
})
function dayWord(date, long = false) {
  const diff = Math.round((parse(date) - TODAY) / DAY)
  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  if (diff === -1) return 'yesterday'
  return fmt(parse(date), long ? { weekday: 'long', day: 'numeric', month: 'short' } : { weekday: 'short', day: 'numeric', month: 'short' })
}
const title = computed(() => {
  if (state.filter === 'all') return { main: 'All tasks', small: `${src.tasks.length} written in this journal` }
  const { start, end, from, to } = range.value
  if (state.filter === 'month') {
    const thisMonth = todayIso >= from && todayIso <= to
    return { main: fmt(start, { month: 'long' }), small: thisMonth ? `This month · ${start.getFullYear()}` : `${start.getFullYear()}` }
  }
  const thisWeek = todayIso >= from && todayIso <= to
  const sameMonth = start.getMonth() === end.getMonth()
  const main = sameMonth ? `${start.getDate()}–${end.getDate()} ${fmt(end, { month: 'long' })}`
    : `${fmt(start, { day: 'numeric', month: 'short' })} – ${fmt(end, { day: 'numeric', month: 'short' })}`
  return { main, small: thisWeek ? 'This week' : `Week of ${fmt(start, { day: 'numeric', month: 'long' })}` }
})
// the day's sprout grows as tasks get ticked off
const grow = computed(() => {
  const scope = src.tasks.filter(inScope)
  const done = scope.filter((t) => t.done).length, total = scope.length, p = total ? done / total : 0
  const stage = !total || p === 0 ? 'seed' : p === 1 ? 'bloom' : p >= 0.5 ? 'bud' : 'sprout'
  const art = { seed: 'seed', sprout: 'sprout', bud: 'tulip-3', bloom: `tulip-${flower.value}-4` }[stage]
  return { done, total, p, stage, src: foliageUrl(art), label: total ? `${done} of ${total} done` : 'nothing yet' }
})

function toggle(t, e) {
  src.toggleDone(t.id)
  if (t.done) burst(e.currentTarget)
}
const removing = ref(new Set())
function remove(t) {
  removing.value = new Set(removing.value).add(t.id)
  setTimeout(() => { src.remove(t.id); removing.value.delete(t.id) }, 320)
}
// double-click a task to edit it in place; Enter saves, Esc cancels
const editingId = ref(null)
function startEdit(t, e) {
  editingId.value = t.id
  nextTick(() => { const el = e.target; el.focus(); document.getSelection()?.selectAllChildren(el) })
}
function finishEdit(t, e, keep = true) {
  if (editingId.value !== t.id) return
  if (keep) src.rename(t.id, e.target.textContent)
  e.target.textContent = t.text
  editingId.value = null
}

const draft = reactive({ text: '', subject: src.LIFE ?? 'Life', date: todayIso })
const draftInvalid = ref(false)
const listEl = ref(null)
function addTask() {
  if (!draft.text.trim()) { draftInvalid.value = true; setTimeout(() => (draftInvalid.value = false), 900); return }
  const date = draft.date || state.selected
  src.addTask({ text: draft.text, subject: draft.subject, date })
  draft.text = ''
  if (date !== state.selected) select(date)
  nextTick(() => listEl.value?.scrollTo({ top: listEl.value.scrollHeight, behavior: 'smooth' }))
}

/* ---------- right page: calendar ---------- */
const monthKey = computed(() => `${state.view.getFullYear()}-${state.view.getMonth()}`)
const cells = computed(() => {
  const y = state.view.getFullYear(), m = state.view.getMonth()
  const first = new Date(y, m, 1)
  const start = new Date(y, m, 1 - ((first.getDay() + 6) % 7))
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    const k = isoDay(d)
    const tasks = src.tasks.filter((t) => t.date === k)
    const exam = src.exams.find((x) => x.date === k)
    const due = src.reviewsDue.filter((r) => r.date === k).length
    return {
      k, n: d.getDate(), out: d.getMonth() !== m, tasks, exam, due,
      inWeek: state.filter === 'week' && range.value && k >= range.value.from && k <= range.value.to,
      allDone: tasks.length > 0 && tasks.every((t) => t.done),
      label: `${fmt(d, { weekday: 'long', day: 'numeric', month: 'long' })}${tasks.length ? `, ${tasks.length} task${tasks.length > 1 ? 's' : ''}` : ''}${exam ? `, ${exam.title}` : ''}${due ? `, ${due} seed${due > 1 ? 's' : ''} to review` : ''}`,
    }
  })
})
const weeks = computed(() => Array.from({ length: 6 }, (_, r) => cells.value.slice(r * 7, r * 7 + 7)))
const monthName = computed(() => fmt(state.view, { month: 'long' }))

// the ticket under the calendar: what the picked day holds, and the next exam
const ticket = computed(() => {
  const d = parse(state.selected)
  const tasks = src.tasks.filter((t) => t.date === state.selected)
  const exam = src.exams.find((x) => x.date === state.selected)
  const next = src.exams.filter((x) => x.date >= state.selected).sort((a, b) => a.date.localeCompare(b.date))[0]
  const due = src.reviewsDue.filter((r) => r.date === state.selected)
  const left = tasks.filter((t) => !t.done).length
  let heading = exam ? exam.title : tasks.length ? (left ? `${left} thing${left > 1 ? 's' : ''} to do` : 'All done. Bloom!') : due.length ? 'Seeds to water' : 'A quiet day'
  let line
  if (exam) line = `Exam day. Your ${exam.subject} seeds are ${src.readiness(exam.subject)}% grown. Good luck!`
  else {
    const parts = [...new Set(tasks.map((t) => t.subject))]
    if (due.length) parts.push(`${due.length} seed${due.length > 1 ? 's' : ''} due for review`)
    line = parts.length ? parts.join(' · ') : 'Nothing planned.'
    if (next) { const days = Math.round((parse(next.date) - d) / DAY); line += ` · ${next.title} in ${days} day${days === 1 ? '' : 's'}` }
  }
  const topic = exam ? exam.subject : tasks.find((t) => !t.done)?.text || ''
  const dueSubject = src.subjects.find((s) => s.name === due[0]?.subject)?.name
  return { d, heading, line, topic, due: due.length, dueSubject }
})

function select(k) {
  state.selected = k
  draft.date = k
  const d = parse(k)
  if (d.getMonth() !== state.view.getMonth() || d.getFullYear() !== state.view.getFullYear()) {
    turn(d > state.view ? 1 : -1, new Date(d.getFullYear(), d.getMonth(), 1))
  }
  if (state.filter === 'all') state.filter = 'week'
}
function turn(dir, target) {
  state.turn = dir > 0 ? 'next' : 'prev'
  state.view = target || new Date(state.view.getFullYear(), state.view.getMonth() + dir, 1)
}
function onDayKey(e, cell) {
  const move = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key]
  if (move) {
    e.preventDefault()
    select(isoDay(parse(cell.k).getTime() + move * DAY + 2 * 3600e3)) // +2h guards against DST
    nextTick(() => document.querySelector('.day.is-selected')?.focus({ preventScroll: true }))
  }
  if (e.key === 'PageUp') { e.preventDefault(); turn(-1) }
  if (e.key === 'PageDown') { e.preventDefault(); turn(1) }
}
const addInput = ref(null)
function onDayDblClick() { state.side = 'left'; nextTick(() => addInput.value?.focus()) }

function focusOnThis() {
  if (pomo.phase === 'setup') pomo.topic = ticket.value.topic
  router.push({ name: 'pomodoro' })
}

/* ---------- single-page mode tabs (narrow screens) ---------- */
const flip = ref('')
function setSide(side) {
  if (state.side === side) return
  flip.value = 'out'
  setTimeout(() => { state.side = side; flip.value = 'in'; setTimeout(() => (flip.value = ''), 400) }, 260)
}

const filters = [{ key: 'week', label: 'This Week' }, { key: 'month', label: 'This Month' }, { key: 'all', label: 'All' }]
const filterIndex = computed(() => filters.findIndex((f) => f.key === state.filter))
</script>

<template>
  <div class="book-wrap">
    <div class="book" :class="{ compact, 'is-closed': closed, 'is-open': !closed, 'is-settled': settled }" :data-side="state.side">
      <div class="book-tabs" role="tablist" aria-label="Journal pages">
        <button type="button" role="tab" :aria-selected="state.side === 'left'" @click="setSide('left')">To-do</button>
        <button type="button" role="tab" :aria-selected="state.side === 'right'" @click="setSide('right')">Calendar</button>
      </div>

      <div class="book-board">
        <!-- LEFT PAGE: to-do -->
        <section class="page page-left" :class="{ 'flip-out': flip === 'out' && state.side === 'left', 'flip-in': flip === 'in' && state.side === 'left' }" aria-label="To-do list">
          <span class="sp-tape t1" aria-hidden="true"></span>
          <div class="page-inner">
            <div class="todo-head">
              <div>
                <span class="sp-eyebrow">To-do</span>
                <h2 class="todo-date">{{ title.main }}<small>{{ title.small }}</small></h2>
              </div>
              <div class="grow" aria-live="polite">
                <div class="grow-pot"><img :key="grow.stage" class="pop" :src="grow.src" :data-stage="grow.stage" alt="" /></div>
                <div class="grow-bar"><i :style="{ width: `${grow.p * 100}%` }"></i></div>
                <div class="grow-label">{{ grow.label }}</div>
              </div>
            </div>

            <div class="todo-tools">
              <div class="sp-seg" role="tablist" aria-label="Show tasks">
                <span class="sp-seg-thumb" :style="{ width: `calc((100% - 8px) / 3)`, transform: `translateX(${filterIndex * 100}%)` }"></span>
                <button v-for="f in filters" :key="f.key" type="button" role="tab" :aria-selected="state.filter === f.key" @click="state.filter = f.key">{{ f.label }}</button>
              </div>
            </div>

            <div ref="listEl" class="lined">
              <ul class="tasks">
                <li v-if="!rows.length" class="empty-day">
                  <template v-if="state.filter === 'week'">A free week. <b>Plant</b> a task below,<br />or enjoy the sunshine.</template>
                  <template v-else-if="state.filter === 'month'">Nothing planned this month yet.<br /><b>Plant</b> a task below.</template>
                  <template v-else>No tasks yet. <b>Plant</b> one below.</template>
                </li>
                <template v-for="(row, i) in rows" :key="row.key">
                  <li v-if="row.divider" class="day-divider" :class="{ picked: row.picked }">{{ row.label }}</li>
                  <li
                    v-else class="task" :class="{ done: row.task.done, removing: removing.has(row.task.id) }"
                    :style="{ animationDelay: `${Math.min(i * 45, 400)}ms` }" data-testid="journal-task"
                  >
                    <button
                      type="button" class="check" role="checkbox" :aria-checked="row.task.done"
                      :aria-label="`Mark “${row.task.text}” ${row.task.done ? 'not done' : 'done'}`" @click="toggle(row.task, $event)"
                    >
                      <svg viewBox="0 0 30 30" aria-hidden="true"><circle class="ring" cx="15" cy="15" r="12" /><path class="ring-ink" d="M15 3.2C22 3 27.2 8.4 26.8 15.3 26.4 22 21 27 14.6 26.8 8 26.6 3 21.4 3.3 14.8 3.6 8.2 9 3.4 16 3.6" /><path class="tick" d="M9.5 15.5l3.8 3.8 7.4-8.3" /></svg>
                    </button>
                    <div class="t-main">
                      <span
                        class="t-text" title="Double-click to edit" :contenteditable="editingId === row.task.id"
                        @dblclick="startEdit(row.task, $event)" @blur="finishEdit(row.task, $event)"
                        @keydown.enter.prevent="$event.target.blur()" @keydown.esc="finishEdit(row.task, $event, false)"
                      >{{ row.task.text }}</span>
                      <div class="t-meta">
                        <span class="tag" :style="{ '--c': subjectColor(row.task.subject) }">{{ row.task.subject }}</span>
                        <span v-if="!row.task.done && row.task.date < todayIso" class="t-due late">overdue</span>
                      </div>
                    </div>
                    <div class="t-actions">
                      <button type="button" class="star" :aria-pressed="row.task.star" aria-label="Priority" @click="src.toggleStar(row.task.id)">
                        <svg viewBox="0 0 24 24" :fill="row.task.star ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3.5l2.6 5.5 6 .8-4.4 4.1 1.1 5.9L12 17l-5.3 2.8 1.1-5.9L3.4 9.8l6-.8z" /></svg>
                      </button>
                      <button type="button" class="del" aria-label="Delete task" @click="remove(row.task)">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" /></svg>
                      </button>
                    </div>
                  </li>
                </template>
              </ul>
            </div>

            <form class="add-task" autocomplete="off" @submit.prevent="addTask">
              <label class="sr-only" :for="`${demo ? 'demo' : 'j'}-new`">New task</label>
              <input
                :id="`${demo ? 'demo' : 'j'}-new`" ref="addInput" v-model="draft.text" class="sp-input" :class="{ 'is-invalid': draftInvalid }"
                maxlength="90" placeholder="Write a new task…" enterkeyhint="done" data-testid="journal-new-task"
              />
              <label class="sr-only" :for="`${demo ? 'demo' : 'j'}-subj`">Subject</label>
              <select :id="`${demo ? 'demo' : 'j'}-subj`" v-model="draft.subject" class="sp-input">
                <option v-for="s in src.subjects" :key="s.name" :value="s.name">{{ s.name }}</option>
              </select>
              <label class="sr-only" :for="`${demo ? 'demo' : 'j'}-date`">Due date</label>
              <input :id="`${demo ? 'demo' : 'j'}-date`" v-model="draft.date" class="sp-input" type="date" />
              <button class="add-btn" type="submit" aria-label="Add task" data-testid="journal-add">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>
              </button>
            </form>
          </div>
        </section>

        <!-- RIGHT PAGE: calendar -->
        <section class="page page-right" :class="{ 'flip-out': flip === 'out' && state.side === 'right', 'flip-in': flip === 'in' && state.side === 'right' }" aria-label="Calendar">
          <span class="sp-tape is-leaf t2" aria-hidden="true"></span>
          <div class="leaf-stage">
            <Transition :name="`leaf-${state.turn}`">
              <div :key="monthKey" class="page-inner cal-page">
                <div class="cal-head">
                  <h2 class="cal-title">{{ monthName }}<span>{{ state.view.getFullYear() }} · little plans</span></h2>
                  <div class="cal-nav">
                    <button class="sp-chip" type="button" @click="select(todayIso)">Today</button>
                    <button class="sp-icon-btn" type="button" aria-label="Previous month" @click="turn(-1)"><SproutIcon glyph="chevron-left" :size="18" /></button>
                    <button class="sp-icon-btn" type="button" aria-label="Next month" data-testid="journal-next-month" @click="turn(1)"><SproutIcon glyph="chevron-right" :size="18" /></button>
                  </div>
                </div>
                <div class="cal-grid" role="grid" :aria-label="fmt(state.view, { month: 'long', year: 'numeric' })">
                  <div class="cal-row wk" role="row"><span v-for="w in ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']" :key="w" role="columnheader">{{ w }}</span></div>
                  <div v-for="(week, r) in weeks" :key="r" class="cal-row" role="row">
                    <button
                      v-for="c in week" :key="c.k" type="button" class="day" :class="{ out: c.out, 'is-selected': c.k === state.selected, 'in-week': c.inWeek }"
                      :tabindex="c.k === state.selected ? 0 : -1" :aria-label="c.label" :aria-current="c.k === state.selected ? 'date' : undefined"
                      :data-date="c.k" @click="select(c.k)" @dblclick="onDayDblClick" @keydown="onDayKey($event, c)"
                    >
                      <span class="n">{{ c.n }}</span>
                      <svg v-if="c.k === todayIso" class="ink-circle" viewBox="0 0 38 32" aria-hidden="true"><path d="M21 3.5C30 3 36 9 35 16.5 34 25 26 29.5 17.5 29 9 28.5 3 23 3.5 15.5 4 8 11 3.5 22.5 4.5" /></svg>
                      <span v-if="c.exam" class="stamp">EXAM</span>
                      <span class="dots">
                        <i v-for="t in c.tasks.slice(0, 5)" :key="t.id" :class="{ done: t.done }" :style="{ '--c': subjectColor(t.subject) }"></i>
                        <SproutIcon v-if="c.due" name="water" :size="13" class="due-drop" />
                      </span>
                      <img v-if="c.allDone" class="bloom" :src="foliageUrl(`tulip-${flower}-4`)" alt="" />
                    </button>
                  </div>
                </div>
                <div class="cal-foot">
                  <div :key="state.selected" class="ticket" aria-live="polite">
                    <div class="ticket-date">
                      <small>{{ fmt(ticket.d, { weekday: 'short' }).toUpperCase() }}</small><b>{{ ticket.d.getDate() }}</b><small>{{ fmt(ticket.d, { month: 'short' }).toUpperCase() }}</small>
                    </div>
                    <div class="ticket-body">
                      <h4>{{ ticket.heading }}</h4>
                      <p>{{ ticket.line }}</p>
                      <div v-if="!compact && (ticket.topic || ticket.due)" class="d-flex flex-wrap gap-2">
                        <button v-if="ticket.topic" v-burst type="button" class="sp-btn sp-btn-sm" @click="focusOnThis">Focus on this <span class="arrow">→</span></button>
                        <RouterLink v-if="ticket.due" :to="{ name: 'garden', query: { q: ticket.topic||ticket.dueSubject } }" class="sp-btn sp-btn-sm sp-btn-leaf">Water seeds</RouterLink>
                      </div>
                    </div>
                  </div>
                  <div v-if="!compact" class="legend">
                    <span v-for="s in src.subjects.slice(0, 6)" :key="s.name" class="tag" :style="{ '--c': s.color }">
                      {{ s.name }}<template v-if="s.name !== src.LIFE && !demo"> · {{ src.readiness(s.name) }}%</template>
                    </span>
                  </div>
                </div>
              </div>
            </Transition>
          </div>
          <button class="curl" type="button" aria-label="Turn to next month" @click="turn(1)"><span>next</span></button>
        </section>
      </div>
      <span class="ribbon" aria-hidden="true"></span>

      <div v-if="cover" class="cover" role="button" tabindex="0" aria-label="Open your journal" @click="openBook" @keydown.enter.space.prevent="openBook">
        <div class="cover-face">
          <span class="frame"></span>
          <div>
            <img class="cover-emblem" :src="potArt" alt="" />
            <div class="cover-title">Sproutly</div>
            <div class="cover-sub">Journal · {{ TODAY.getFullYear() }}</div>
            <div class="cover-hint">tap to open</div>
          </div>
          <span class="cover-strap"></span>
        </div>
        <div class="cover-back"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.book-wrap { container: book / inline-size; width: 100%; position: relative; }

.book {
  --cloth: #3d6b4c; --cloth-2: #31593f;
  --page-h: clamp(560px, calc(100vh - 180px), 820px);
  position: relative; margin: 0 auto; max-width: 1220px;
  perspective: 2600px;
  transition: transform 1.1s var(--ease);
}
.book.is-closed { transform: translateX(-25%); }
.book-board {
  position: relative; display: grid; grid-template-columns: 1fr 1fr;
  padding: 14px 14px 18px; border-radius: 20px;
  background:
    var(--grain),
    repeating-linear-gradient(0deg, rgba(255,255,255,.035) 0 2px, transparent 2px 4px),
    repeating-linear-gradient(90deg, rgba(0,0,0,.05) 0 1px, transparent 1px 3px),
    linear-gradient(180deg, var(--cloth), var(--cloth-2));
  background-size: 220px 220px, auto, auto, auto;
  box-shadow: 0 2px 0 #284733, 0 40px 70px -30px rgba(30, 40, 25, .65), 0 16px 30px -18px rgba(30, 40, 25, .5);
  transform-style: preserve-3d;
  transition: clip-path .5s ease .25s; clip-path: inset(0 0 0 0 round 20px);
}
.book.is-closed .page-left, .book.is-closed .book-board::before { opacity: 0; }
.book.is-closed .book-board { clip-path: inset(0 0 0 50% round 20px); }

.page {
  position: relative; height: var(--page-h); min-width: 0;
  background-color: var(--sheet);
  display: flex; flex-direction: column;
  transition: opacity .4s ease .35s;
}
.page::after { content: ""; position: absolute; inset: 0; pointer-events: none; z-index: 0; background-image: var(--grain); opacity: .16; mix-blend-mode: multiply; border-radius: inherit; }
.page > * { position: relative; z-index: 1; }
.page > .sp-tape { position: absolute; z-index: 3; }
.page-left {
  border-radius: 10px 3px 3px 10px;
  background-image: linear-gradient(90deg, rgba(255,255,255,.5) 0, transparent 4%, transparent 86%, rgba(110, 80, 50, .07) 95%, rgba(110, 80, 50, .2) 100%);
  box-shadow: -1px 1px 0 #ede1cd, -2px 2px 0 #fbf4e8, -3px 3px 0 #e6d7bf, -4px 4px 0 #f8efe1, -5px 5px 0 #e0cfb4, -6px 6px 0 #f3e8d6, -7px 7px 0 #d9c6a8;
}
.page-right {
  border-radius: 3px 10px 10px 3px;
  background-image: linear-gradient(270deg, rgba(255,255,255,.5) 0, transparent 4%, transparent 86%, rgba(110, 80, 50, .07) 95%, rgba(110, 80, 50, .2) 100%);
  box-shadow: 1px 1px 0 #ede1cd, 2px 2px 0 #fbf4e8, 3px 3px 0 #e6d7bf, 4px 4px 0 #f8efe1, 5px 5px 0 #e0cfb4, 6px 6px 0 #f3e8d6, 7px 7px 0 #d9c6a8;
}
.book-board::before {
  content: ""; position: absolute; z-index: 5; top: 14px; bottom: 18px; left: 50%; width: 64px; transform: translateX(-50%);
  background: linear-gradient(90deg, transparent 0, rgba(90, 60, 35, .06) 30%, rgba(60, 40, 20, .26) 49%, rgba(255,255,255,.35) 50.5%, rgba(90, 60, 35, .1) 56%, transparent 100%);
  pointer-events: none; transition: opacity .4s ease .35s;
}
.book-board::after {
  content: ""; position: absolute; z-index: 6; top: 30px; bottom: 34px; left: calc(50% - 1px); width: 2px;
  background: repeating-linear-gradient(180deg, rgba(120, 90, 60, .55) 0 9px, transparent 9px 18px);
  pointer-events: none;
}
.book.is-closed .book-board::after { opacity: 0; }

.page-inner { flex: 1; min-height: 0; display: flex; flex-direction: column; padding: clamp(14px, 2cqi, 22px) clamp(18px, 3.4cqi, 42px) 22px; }
.page-left .page-inner { padding-right: clamp(26px, 4cqi, 52px); }
.page-right .page-inner { padding-left: clamp(26px, 4cqi, 52px); }

.sp-tape.t1 { top: -8px; left: 22%; transform: rotate(-4deg); }
.sp-tape.t2 { top: -9px; left: -14%; transform: rotate(5deg); }
.ribbon { position: absolute; z-index: 7; left: calc(50% + 34px); bottom: -30px; width: 14px; height: 74px; pointer-events: none; transform-origin: top center; animation: ribbon-sway 6s ease-in-out infinite alternate; }
.ribbon::before { content: ""; position: absolute; inset: 0; background: linear-gradient(90deg, #b13a51, #e0546a 45%, #c7445c); clip-path: polygon(0 0, 100% 0, 100% 100%, 50% calc(100% - 10px), 0 100%); }
@keyframes ribbon-sway { from { transform: rotate(-.6deg); } to { transform: rotate(.8deg); } }
.book.is-closed .ribbon { opacity: 0; }

/* cover */
.cover { position: absolute; z-index: 20; top: 0; bottom: 0; left: 50%; width: 50%; transform-origin: left center; transform-style: preserve-3d; transition: transform 1.25s cubic-bezier(.5, .05, .25, 1); pointer-events: none; }
.book.is-closed .cover { pointer-events: auto; cursor: pointer; }
.book.is-open .cover { transform: rotateY(-180deg); }
.book.is-settled .cover { visibility: hidden; }
.cover-face, .cover-back { position: absolute; inset: 0; backface-visibility: hidden; -webkit-backface-visibility: hidden; border-radius: 4px 20px 20px 4px; }
.cover-face {
  background: var(--grain), repeating-linear-gradient(0deg, rgba(255,255,255,.04) 0 2px, transparent 2px 4px), repeating-linear-gradient(90deg, rgba(0,0,0,.05) 0 1px, transparent 1px 3px), radial-gradient(120% 90% at 30% 20%, #4f8460, #2f573d);
  background-size: 220px 220px, auto, auto, auto;
  box-shadow: inset 10px 0 18px -10px rgba(0,0,0,.45), inset 0 0 0 2px rgba(255,255,255,.06);
  display: grid; place-items: center; text-align: center; color: #f4dfa6;
}
.cover-face .frame { position: absolute; inset: 22px; border: 1.5px solid rgba(244, 223, 166, .45); border-radius: 10px; }
.cover-face .frame::before { content: ""; position: absolute; inset: 6px; border: 1px dashed rgba(244, 223, 166, .3); border-radius: 6px; }
.cover-title { font-family: var(--f-display); font-style: italic; font-size: clamp(2.2rem, 6cqi, 3.6rem); font-weight: 600; line-height: 1; text-shadow: 0 1px 0 rgba(0,0,0,.25); }
.cover-sub { margin-top: 10px; font-size: .72rem; font-weight: 800; letter-spacing: .3em; text-transform: uppercase; opacity: .85; }
.cover-emblem { width: 92px; height: 92px; margin: 0 auto 14px; filter: sepia(1) saturate(2.2) hue-rotate(5deg) brightness(1.05) drop-shadow(0 1px 0 rgba(0,0,0,.3)); opacity: .9; }
.cover-hint { margin-top: 26px; font-family: var(--f-hand); font-size: 1.3rem; color: #f8e9c2; opacity: .9; animation: hint 1.6s ease-in-out infinite alternate; }
@keyframes hint { to { transform: translateY(-4px); opacity: .6; } }
.cover-strap { position: absolute; right: 34px; top: -2px; bottom: -2px; width: 18px; background: linear-gradient(90deg, #a83148, #d24c63 50%, #a83148); box-shadow: 0 0 6px rgba(0,0,0,.3); transition: transform .4s var(--ease); }
.book.is-open .cover-strap { transform: translateX(60px); opacity: 0; transition: transform .4s, opacity .3s; }
.cover-back { transform: rotateY(180deg); border-radius: 20px 4px 4px 20px; background: radial-gradient(circle at 8px 8px, rgba(62, 139, 87, .18) 2px, transparent 2.5px) 0 0/18px 18px, #f3ead9; box-shadow: inset -10px 0 18px -10px rgba(0,0,0,.25); }

/* left page: to-do */
.todo-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.todo-date { font-family: var(--f-hand) !important; font-weight: 700; font-size: clamp(2rem, 4.2cqi, 2.7rem); line-height: 1; color: var(--ink); margin: .15em 0 0; letter-spacing: 0; }
.todo-date small { display: block; font-family: var(--f-body); font-size: .74rem; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-soft); margin-top: 8px; }
.grow { display: grid; justify-items: center; gap: 2px; flex: none; text-align: center; }
.grow-pot { position: relative; width: 74px; height: 74px; border-radius: 50%; background: radial-gradient(circle at 50% 70%, var(--leaf-soft), transparent 70%); display: grid; place-items: end center; }
.grow-pot img { width: 74px; height: 74px; transform-origin: 50% 95%; }
.grow-pot img[data-stage="seed"], .grow-pot img[data-stage="sprout"] { transform: scale(1.9); }
.grow-pot img[data-stage="bud"] { transform: scale(1.15); }
.grow-pot img.pop { animation: grow-pop .7s var(--spring); }
@keyframes grow-pop { 0% { scale: .4; translate: 0 10px; } 100% { scale: 1; translate: 0 0; } }
.grow-label { font-size: .72rem; font-weight: 800; color: var(--ink-soft); font-variant-numeric: tabular-nums; }
.grow-bar { width: 66px; height: 5px; border-radius: 5px; background: var(--sheet-3); overflow: hidden; }
.grow-bar i { display: block; height: 100%; width: 0; background: var(--leaf); border-radius: inherit; transition: width .6s var(--spring); }
.todo-tools { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 14px 0 6px; flex-wrap: wrap; }
.todo-tools .sp-seg button { padding: .35em .9em; font-size: .78rem; }

.lined {
  --lh: 44px;
  flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain;
  margin: 0 -8px; padding: 0 8px;
  background:
    linear-gradient(90deg, transparent 38px, var(--margin) 38px, var(--margin) 39.5px, transparent 39.5px),
    repeating-linear-gradient(180deg, transparent 0 calc(var(--lh) - 1px), var(--rule) calc(var(--lh) - 1px) var(--lh));
  background-attachment: local;
  scrollbar-width: thin; scrollbar-color: var(--sheet-3) transparent;
}
.tasks { list-style: none; margin: 0; padding: 0; }
.task { position: relative; display: grid; grid-template-columns: 34px 1fr auto; align-items: center; gap: 0 12px; min-height: var(--lh); padding: 4px 4px 4px 0; animation: write-in .55s var(--ease) both; }
@keyframes write-in { from { clip-path: inset(0 100% 0 0); opacity: .3; } to { clip-path: inset(0 0 0 0); opacity: 1; } }
.task.removing { animation: tear .35s ease forwards; }
@keyframes tear { to { transform: translateX(30px) rotate(2deg); opacity: 0; } }
.check { width: 30px; height: 30px; padding: 0; border: 0; background: none; display: grid; place-items: center; border-radius: 50%; }
.check svg { width: 28px; height: 28px; overflow: visible; }
.check .ring { fill: #fff; stroke: var(--ink-faint); stroke-width: 1.6; transition: stroke .2s, fill .3s; }
.check .ring-ink { fill: none; stroke: var(--leaf); stroke-width: 2.4; stroke-linecap: round; stroke-dasharray: 90; stroke-dashoffset: 90; transition: stroke-dashoffset .45s var(--ease); }
.check .tick { fill: none; stroke: var(--leaf-deep); stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 30; stroke-dashoffset: 30; transition: stroke-dashoffset .3s var(--ease) .25s; }
.check:hover .ring { stroke: var(--leaf); }
.check:active svg { transform: scale(.88); }
.task.done .ring { fill: var(--leaf-soft); }
.task.done .ring-ink, .task.done .tick { stroke-dashoffset: 0; }
.t-main { min-width: 0; line-height: 1.25; }
.t-text {
  position: relative; display: inline; font-family: var(--f-hand); font-weight: 600; font-size: 1.42rem; color: var(--ink);
  background: linear-gradient(var(--berry-deep), var(--berry-deep)) no-repeat 0 58% / 0% 2px;
  transition: background-size .45s var(--ease), color .3s; outline: none; overflow-wrap: anywhere;
}
.t-text[contenteditable="true"] { background: var(--butter-soft); border-radius: 4px; padding: 0 4px; }
.task.done .t-text { background-size: 100% 2px; color: var(--ink-faint); }
.t-meta { display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: center; margin-top: 1px; font-size: .74rem; font-weight: 700; color: var(--ink-soft); }
.tag { display: inline-flex; align-items: center; gap: 5px; }
.tag::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: var(--c); }
.t-due.late { color: var(--berry-deep); }
.t-actions { display: flex; gap: 2px; opacity: .25; transition: opacity .2s; }
.task:hover .t-actions, .task:focus-within .t-actions { opacity: 1; }
.t-actions button { width: 30px; height: 30px; border: 0; background: none; border-radius: 8px; color: var(--ink-soft); display: grid; place-items: center; transition: background .2s, color .2s; }
.t-actions button:hover { background: var(--sheet-2); color: var(--ink); }
.t-actions svg { width: 16px; height: 16px; }
.t-actions .star[aria-pressed="true"] { color: var(--butter-deep); }
.task:has(.star[aria-pressed="true"]) .t-actions { opacity: 1; }
.empty-day { padding: 18px 0 0 46px; font-family: var(--f-hand); font-size: 1.45rem; color: var(--ink-soft); line-height: var(--lh); }
.empty-day b { color: var(--leaf); font-weight: 700; }
.day-divider.picked { color: var(--leaf-deep); }
.day-divider.picked::after { content: " · picked day"; letter-spacing: .06em; text-transform: none; font-weight: 700; color: var(--ink-soft); }
.day-divider { padding-left: 46px; height: var(--lh); display: flex; align-items: flex-end; padding-bottom: 6px; font-size: .7rem; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: var(--berry-deep); }

.add-task { display: grid; grid-template-columns: 1fr auto auto 44px; gap: 8px; align-items: center; margin-top: 12px; padding-top: 12px; border-top: 1.5px dashed var(--line); }
.add-task .sp-input { min-height: 44px; font-family: var(--f-hand); font-size: 1.3rem; padding: .2em .8em; }
.add-task select.sp-input, .add-task input[type="date"].sp-input { font-family: var(--f-body); font-size: .82rem; font-weight: 700; padding: .3em .6em; width: auto; }
.add-task select.sp-input { max-width: 140px; text-overflow: ellipsis; }
.add-btn { width: 44px; height: 44px; border-radius: 50%; border: 0; background: var(--ink); color: var(--sheet); display: grid; place-items: center; box-shadow: 0 3px 0 #2c201b; transition: transform .2s var(--spring), box-shadow .2s; }
.add-btn:hover { transform: translateY(-2px) rotate(90deg); }
.add-btn:active { transform: translateY(2px); box-shadow: 0 1px 0 #2c201b; }
.add-btn svg { width: 18px; height: 18px; }

/* right page: calendar */
.leaf-stage { position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; perspective: 2200px; }
.cal-page { background: var(--sheet); border-radius: 3px 10px 10px 3px; }
.cal-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 10px; }
.cal-title { font-style: italic; font-weight: 600; font-size: clamp(2.1rem, 4.6cqi, 3rem); line-height: .95; margin: 0; }
.cal-title span { display: block; font-family: var(--f-body); font-style: normal; font-size: .72rem; font-weight: 800; letter-spacing: .3em; color: var(--ink-soft); margin-top: 6px; }
.cal-nav { display: flex; gap: 6px; align-items: center; }
.cal-grid { flex: 1; min-height: 0; display: grid; grid-template-rows: auto repeat(6, 1fr); margin-top: 14px; border-top: 1.5px solid var(--ink); }
.cal-row { display: grid; grid-template-columns: repeat(7, 1fr); }
.cal-row.wk { padding: 6px 0; border-bottom: 1px solid var(--line); }
.cal-row.wk span { font-size: .66rem; font-weight: 800; letter-spacing: .12em; color: var(--ink-soft); text-align: left; padding-left: 6px; }
.cal-row.wk span:nth-child(n+6) { color: var(--berry-deep); }
.day { position: relative; display: flex; flex-direction: column; align-items: flex-start; justify-content: space-between; min-width: 0; padding: 5px 6px 6px; border: 0; background: none; text-align: left; border-bottom: 1px solid var(--line); border-right: 1px dashed color-mix(in srgb, var(--line) 80%, transparent); transition: background .2s; color: var(--ink); }
.day:nth-child(7n) { border-right: 0; }
.day.in-week { background: color-mix(in srgb, var(--leaf-soft) 55%, transparent); }
.day:hover { background: color-mix(in srgb, var(--butter-soft) 60%, transparent); }
.day .n { position: relative; z-index: 1; font-family: var(--f-display); font-weight: 600; font-size: 1rem; line-height: 1; padding: 4px 3px; font-variant-numeric: lining-nums tabular-nums; }
.day.out .n { color: var(--ink-faint); font-weight: 400; }
.day.is-selected::before { content: ""; position: absolute; inset: 4px; border-radius: 6px 12px 7px 14px; z-index: 0; background: color-mix(in srgb, var(--butter) 55%, transparent); transform: rotate(-1.5deg); animation: highlight .35s var(--ease); }
@keyframes highlight { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
.day .ink-circle { position: absolute; z-index: 2; left: -4px; top: -3px; width: 38px; height: 32px; pointer-events: none; overflow: visible; }
.day .ink-circle path { fill: none; stroke: var(--berry); stroke-width: 2; stroke-linecap: round; stroke-dasharray: 120; stroke-dashoffset: 120; animation: draw 1s var(--ease) .3s forwards; }
@keyframes draw { to { stroke-dashoffset: 0; } }
.dots { position: relative; z-index: 1; display: flex; gap: 3px; flex-wrap: wrap; align-items: center; padding-left: 3px; }
.dots i { width: 7px; height: 7px; border-radius: 50%; background: var(--c); }
.dots i.done { background: transparent; box-shadow: inset 0 0 0 1.5px var(--c); }
.stamp { position: absolute; z-index: 1; right: 4px; top: 6px; padding: 1px 5px; border: 1.5px solid var(--berry); border-radius: 4px; font-size: .56rem; font-weight: 900; letter-spacing: .1em; color: var(--berry); transform: rotate(8deg); background: rgba(255,255,255,.6); }
.day .bloom { position: absolute; z-index: 1; right: 2px; bottom: 2px; width: 26px; height: 26px; }
.cal-foot { display: flex; gap: 14px; align-items: stretch; margin-top: 14px; }
.ticket { flex: 1; display: grid; grid-template-columns: 64px 1fr; min-width: 0; border-radius: 14px; background: #fff; box-shadow: var(--shadow-1); overflow: hidden; animation: ticket-in .45s var(--spring); }
@keyframes ticket-in { from { transform: translateY(8px) rotate(-1deg); opacity: 0; } }
.ticket-date { display: grid; place-content: center; text-align: center; color: #fff; background: var(--berry); position: relative; line-height: 1; padding: 8px 0; }
.ticket-date::after { content: ""; position: absolute; right: -6px; top: 0; bottom: 0; width: 12px; background: radial-gradient(circle at 6px 8px, var(--paper)4px, transparent 4.5px) 0 0/12px 16px; }
.ticket-date b { font-family: var(--f-display); font-size: 1.7rem; font-weight: 600; display: block; margin: 3px 0; }
.ticket-date small { font-size: .6rem; font-weight: 800; letter-spacing: .14em; }
.ticket-body { padding: 10px 14px 10px 18px; min-width: 0; display: grid; gap: 4px; align-content: center; }
.ticket-body h4 { margin: 0; font-family: var(--f-display); font-style: italic; color: var(--berry-deep); font-size: 1.05rem; font-weight: 600; }
.ticket-body p { margin: 0; font-size: .8rem; color: var(--ink-soft); line-height: 1.4; overflow-wrap: anywhere; }
.ticket-body .sp-btn { margin-top: 4px; }
.legend { display: grid; align-content: center; gap: 2px; font-size: .7rem; font-weight: 700; color: var(--ink-soft); }

/* corner curl = next month */
.curl { position: absolute; z-index: 8; right: 0; bottom: 0; width: 46px; height: 46px; padding: 0; border: 0; background: linear-gradient(135deg, transparent 50%, #efe2cc 50%, #fbf5ea 72%, #e5d4b8 100%); border-radius: 0 0 10px 0; box-shadow: -3px -3px 6px -2px rgba(90, 60, 30, .25); transition: width .3s var(--spring), height .3s var(--spring); }
.curl:hover, .curl:focus-visible { width: 74px; height: 74px; }
.curl span { position: absolute; right: 8px; bottom: 6px; font-family: var(--f-hand); font-size: 1rem; color: var(--ink-soft); opacity: 0; transition: opacity .2s; }
.curl:hover span, .curl:focus-visible span { opacity: 1; }

/* page turn: the old month swings over the spine (next), or the previous month swings back in (prev) */
.leaf-next-leave-active, .leaf-prev-enter-active { position: absolute; inset: 0; z-index: 15; transform-origin: left center; backface-visibility: hidden; box-shadow: -10px 0 30px -12px rgba(60, 40, 20, .35); }
.leaf-next-leave-active { animation: turn-next .9s cubic-bezier(.45, .05, .3, 1) forwards; }
.leaf-prev-enter-active { animation: turn-prev .9s cubic-bezier(.45, .05, .3, 1) both; }
.leaf-next-enter-active, .leaf-prev-leave-active { transition: none; }
@keyframes turn-next { from { transform: rotateY(0); } to { transform: rotateY(-180deg); } }
@keyframes turn-prev { from { transform: rotateY(-180deg); } to { transform: rotateY(0); } }

.book-tabs { display: none; }

/* single page: narrow books */
@container book (max-width: 760px) {
  .book { --page-h: auto; }
  .book.is-closed { transform: none; }
  .book-board { grid-template-columns: 1fr; padding: 12px 12px 16px 26px; }
  .book.is-closed .book-board { clip-path: inset(0 0 0 0 round 20px); }
  .book-board::before { left: 26px; width: 28px; transform: none; background: linear-gradient(90deg, rgba(60,40,20,.22), transparent); top: 12px; bottom: 16px; }
  .book-board::after { left: 18px; top: 26px; bottom: 30px; }
  .book.is-closed .page-left { opacity: 1; }
  .cover { left: 0; width: 100%; }
  .book[data-side="left"] .page-right, .book[data-side="right"] .page-left { display: none; }
  .page { min-height: 560px; border-radius: 4px 12px 12px 4px; }
  .page-left { box-shadow: 1px 1px 0 #ede1cd, 2px 2px 0 #fbf4e8, 3px 3px 0 #e6d7bf, 4px 4px 0 #f8efe1, 5px 5px 0 #e0cfb4; background-image: linear-gradient(90deg, rgba(110,80,50,.16), transparent 6%); }
  .page-right { background-image: linear-gradient(90deg, rgba(110,80,50,.16), transparent 6%); }
  .page-inner { padding: 22px 18px 18px 26px !important; }
  .ribbon { left: auto; right: 54px; }
  .add-task { grid-template-columns: 1fr 1fr 44px; }
  .add-task > .sp-input:first-of-type { grid-column: 1 / 3; }
  .add-task .add-btn { grid-column: 3; grid-row: 1; }
  .add-task select.sp-input { grid-row: 2; grid-column: 1; width: 100%; }
  .add-task input[type="date"].sp-input { grid-row: 2; grid-column: 2 / 4; width: 100%; }
  .lined { max-height: 52vh; min-height: 260px; }
  .cal-grid { min-height: 380px; }
  .book-tabs { display: flex; gap: 6px; position: absolute; z-index: 9; top: -30px; right: 22px; }
  .book-tabs button { border: 0; padding: 8px 14px 14px; border-radius: 10px 10px 0 0; font-weight: 800; font-size: .78rem; letter-spacing: .06em; background: var(--sheet-3); color: var(--ink-soft); transform: translateY(6px); transition: transform .25s var(--spring), background .2s; }
  .book-tabs button[aria-selected="true"] { background: var(--berry); color: #fff; transform: translateY(0); }
  .page.flip-out { animation: flip-out .28s ease-in forwards; transform-origin: left center; }
  .page.flip-in { animation: flip-in .38s var(--ease); transform-origin: left center; }
  .curl { display: none; }
  .cal-foot { flex-direction: column; }
}
@container book (max-width: 420px) {
  .day .n { font-size: .9rem; }
  .stamp { font-size: .48rem; padding: 0 3px; right: 1px; }
  .ticket { grid-template-columns: 56px 1fr; }
}
@keyframes flip-out { to { transform: perspective(1400px) rotateY(-80deg); opacity: .4; } }
@keyframes flip-in { from { transform: perspective(1400px) rotateY(70deg); opacity: .4; } }
.book.compact { --page-h: 540px; }
@container book (min-width: 761px) and (max-width: 1000px) {
  .add-task { grid-template-columns: 1fr 1fr 44px; }
  .add-task > .sp-input:first-of-type { grid-column: 1 / 3; }
  .add-task .add-btn { grid-column: 3; grid-row: 1; }
  .add-task select.sp-input { grid-row: 2; grid-column: 1; width: 100%; }
  .add-task input[type="date"].sp-input { grid-row: 2; grid-column: 2 / 4; width: 100%; }
}
.due-drop { margin-left: 1px; }
</style>
