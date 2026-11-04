<script setup>
// Plant a seed: name the study set, pick a subject and tags, build flashcards by hand or upload a
// document for the AI to turn into flashcards, browse/edit them in the preview, then save.
// Shown after the seed packet is dropped on the garden, and again (filled in) to edit a planted seed.
// Emits 'save' with { title, subject, exam_name, exam_date, tags, cards } and 'cancel'.
// Editing: each saved card keeps its id in the 'save' cards, so the server keeps that card's review progress.
import { computed, markRaw, onBeforeUnmount, ref, watch } from 'vue'
import { useGardenStore, examLabel } from '@/stores/garden'
import { useFlowerStore } from '@/stores/flower'
import { plantSpriteUrl, BLOOM_STAGE } from '@/lib/plantSprites'
import { apiFetch } from '@/lib/http'
import { tagColors, tagStyle } from '@/lib/tagColors'
import { VueDatePicker } from '@vuepic/vue-datepicker'
import '@vuepic/vue-datepicker/dist/main.css'
import tulipSvg from '@/assets/foliage/tulip-pink-4.svg'
import SuggestInput from './SuggestInput.vue'

const props = defineProps({
  busy: { type: Boolean, default: false }, // true while the parent is saving
  error: { type: String, default: '' },
  seed: { type: Object, default: null }, // a planted seed to edit; null = planting a new one
  flower: { type: String, default: 'tulip' }, // flower id of the packet being planted (new seeds only)
  color: { type: String, default: 'pink' }, // petal colour picked in the shed (new seeds only)
})
const emit = defineEmits(['save', 'cancel'])

const garden = useGardenStore()
const isEdit = !!props.seed

// "a tulip" / "an orchid": the flower's shop name, or its id until the shop catalog has loaded
const flowerStore = useFlowerStore()
if (!isEdit) flowerStore.load()
const flowerName = computed(() => {
  const name = (flowerStore.catalog.find((f) => f.id === props.flower)?.name ?? props.flower.replaceAll('-', ' ')).toLowerCase()
  return `${/^[aeiou]/.test(name) ? 'an' : 'a'} ${name}`
})

// Card limits: up to 50 AI pairs per uploaded file, 200 cards per seed (the server checks 200 too)
const MAX_CARDS = 200
const NEAR_LIMIT = 180
const MAX_AI_PER_FILE = 50
let nextId = 0

// Study Set Details
const title = ref(props.seed?.title ?? '')
const subject = ref(props.seed?.subject ?? '')
const tags = ref((props.seed?.tags ?? []).map((t) => ({ name: t.name, color: t.color }))) // [{ name, color }]
const tagInput = ref('')
const tagColor = ref(tagColors[0].id) // colour for the next tag
const knownSubjects = computed(() => [...new Set(garden.seeds.map((s) => s.subject).filter(Boolean))]) // suggestions only

// Exam (optional): a subject can have several, e.g. Midterm and Final. The name and date belong to the exam and
// are shared by all its seeds; a date with no name is saved as an exam called 'Exam'. An existing exam's upcoming
// date is filled in; a past one is not, so it can't block planting. Leaving the date blank keeps whatever the
// exam already has. Shown as DD-MM-YYYY, stored as YYYY-MM-DD.
const now = new Date()
const minExamDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()) // start of today, local
const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
const examName = ref(props.seed?.exam_name ?? '')
// editing: the seed's exam date if it is still to come (a past one is left blank, which keeps it)
const savedDate = props.seed?.exam_date?.slice(0, 10)
const examDate = ref(savedDate && savedDate >= today ? savedDate : null) // YYYY-MM-DD
const subjectSeeds = computed(() => garden.seeds.filter((s) => s.subject === subject.value.trim() && s.exam_id))
const knownExams = computed(() => [...new Set(subjectSeeds.value.map((s) => s.exam_name))]) // suggestions only
const examKey = computed(() => (examName.value.trim() || 'Exam').toLowerCase())
const savedExamDate = computed(() => {
  const date = subjectSeeds.value.find((s) => s.exam_name.toLowerCase() === examKey.value && s.exam_date)?.exam_date
  return date && date >= today ? date : ''
})
watch(savedExamDate, (date) => { examDate.value = date || null })
const examPast = computed(() => !!examDate.value && examDate.value < today)
const examHelp = computed(() => {
  const label = examLabel(subject.value.trim(), examName.value.trim())
  if (savedExamDate.value && examDate.value === savedExamDate.value) return `Saved for all your ${label} seeds.`
  if (savedExamDate.value) return `This changes the date for all your ${label} seeds.`
  if (!subject.value.trim()) return 'Optional.'
  return examName.value.trim() || examDate.value ? `When is your ${label}? Optional.` : 'Optional. Name it if the subject has more than one exam.'
})

function addTag() {
  const name = tagInput.value.trim()
  const taken = tags.value.some((t) => t.name.toLowerCase() === name.toLowerCase())
  if (name && !taken && tags.value.length < 8) tags.value.push({ name, color: tagColor.value })
  tagInput.value = ''
}
// Enter or comma turns the typed text into a chip (Enter must not submit the form)
function onTagKey(e) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault()
    addTag()
  }
}

// Cards: typed in the builder or generated by the AI from an uploaded file, all in one list.
// fileId is only set on AI cards, so removing a file can remove its cards.
// traps: the 3 trap answers as typed (blank = none); cleaned into wrong_options when the seed is saved.
// cardId: the saved card's id when editing (id is only this form's own key).
const cards = ref((props.seed?.cards ?? []).map((c) => ({
  id: nextId++, cardId: c.id, question: c.question, answer: c.answer, traps: [...(c.wrong_options ?? []), '', '', ''].slice(0, 3),
}))) // [{ id, cardId?, fileId?, question, answer, traps }]
const totalCards = computed(() => cards.value.length)
const isFull = computed(() => totalCards.value >= MAX_CARDS)
const overBy = computed(() => totalCards.value - MAX_CARDS)

// Flashcard Builder
const question = ref('')
const answer = ref('')
const traps = ref(['', '', '']) // the new card's trap answers, typed under the Preview
const drafting = computed(() => !!(question.value.trim() || answer.value.trim()))
const canAddCard = computed(() => question.value.trim() && answer.value.trim() && !isFull.value)
function addCard() {
  if (!canAddCard.value) return
  cards.value.push({ id: nextId++, question: question.value.trim(), answer: answer.value.trim(), traps: traps.value })
  question.value = ''
  answer.value = ''
  traps.value = ['', '', '']
  index.value = cards.value.length - 1
}

// Quiz options, under the Preview: four answer lines for the card on screen (the new card, or any added one,
// typed or AI). The first is the answer, ticked; the user only types the three crossed-out traps, and the quiz
// shuffles all four, so the position doesn't matter.
const same = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase()
// trimmed, no blanks, none equal to the answer, no repeats (case-insensitive), at most 3
function cleanTraps(list, correct) {
  const kept = []
  for (const t of list.map((x) => x.trim())) {
    if (t && !same(t, correct) && !kept.some((k) => same(k, t))) kept.push(t)
  }
  return kept.slice(0, 3)
}
// why a typed trap will be skipped, shown under its line
function trapNote(list, i, correct) {
  const t = list[i].trim()
  if (!t) return ''
  if (correct.trim() && same(t, correct)) return 'Same as the answer, so it will be skipped.'
  if (list.slice(0, i).some((x) => x.trim() && same(x, t))) return 'Repeated, so it will be skipped.'
  return ''
}
// the lines shown under the Preview: the new card while typing, otherwise the card on screen
// an added card's traps are only typed into its edit copy (after Edit), so Cancel drops them and Save keeps them
const tileTraps = computed(() => (showDraft.value ? traps.value : editing.value ? editing.value.traps : current.value?.traps))
// trap lines are text boxes only for the new card being typed or a card opened with Edit; otherwise read-only
const trapsEditable = computed(() => showDraft.value || !!editing.value)
const tileAnswer = computed(() => (showDraft.value ? answer.value : editing.value ? editing.value.answer : current.value?.answer ?? ''))
const trapCount = computed(() => (tileTraps.value ? cleanTraps(tileTraps.value, tileAnswer.value).length : 0))

// Upload a file: each file is sent to the server, which returns AI-written pairs
const ACCEPTED = ['pdf', 'pptx', 'docx']
const MAX_MB = 25
const fileInput = ref(null)
const files = ref([]) // [{ id, file, name, size, status: 'generating' | 'done' | 'failed', error, requested, count, confirming }]
const controllers = new Map() // file id -> AbortController for its running request
const dragging = ref(false)
const fileError = ref('')
const extOf = (name) => name.split('.').pop().toLowerCase()
const generating = computed(() => files.value.some((f) => f.status === 'generating'))
const failedFiles = computed(() => files.value.filter((f) => f.status === 'failed'))
const pairsFrom = (f) => cards.value.filter((c) => c.fileId === f.id).length

function addFiles(list) {
  fileError.value = ''
  for (const f of list) {
    const ext = extOf(f.name)
    if (ext === 'ppt') fileError.value = `${f.name}: please save it as PPTX and upload again.`
    else if (!ACCEPTED.includes(ext)) fileError.value = `${f.name} isn't a PDF, PPTX or DOCX file.`
    else if (f.size > MAX_MB * 1024 * 1024) fileError.value = `${f.name} is over ${MAX_MB}MB.`
    else if (isFull.value) fileError.value = `This seed is full (${MAX_CARDS} cards). Delete some cards to upload another file.`
    else if (!files.value.some((x) => x.name === f.name && x.size === f.size)) {
      files.value.push({ id: nextId++, file: markRaw(f), name: f.name, size: f.size, status: 'generating', error: '', requested: 0, count: 0, confirming: false })
      generate(files.value[files.value.length - 1])
    }
  }
}
function onPick(e) {
  addFiles(e.target.files)
  e.target.value = '' // lets the same file be picked again after removing it
}
function onDrop(e) {
  dragging.value = false
  addFiles(e.dataTransfer.files)
}
function fileSize(bytes) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
function fileStatus(f) {
  if (f.status === 'generating') return 'Generating…'
  if (f.status === 'failed') return f.error
  const n = pairsFrom(f)
  return `${n} ${n === 1 ? 'pair' : 'pairs'}${f.requested < MAX_AI_PER_FILE && f.count === f.requested ? ' (seed limit reached)' : ''}`
}

// Asks for at most 50 pairs, or fewer when the seed is close to 200 cards
// (room already promised to other files still generating counts as taken)
async function generate(f) {
  const reserved = files.value.filter((x) => x !== f && x.status === 'generating').reduce((n, x) => n + x.requested, 0)
  const room = MAX_CARDS - totalCards.value - reserved
  if (room <= 0) {
    f.status = 'failed'
    f.error = `This seed is full (${MAX_CARDS} cards). Delete some cards, then try again.`
    return
  }
  f.requested = Math.min(MAX_AI_PER_FILE, room)
  f.status = 'generating'
  f.error = ''
  const controller = new AbortController()
  controllers.set(f.id, controller)

  const body = new FormData()
  body.append('file', f.file)
  body.append('maxCards', String(f.requested))
  body.append('existingQuestions', JSON.stringify(cards.value.map((c) => c.question)))
  try {
    const { cards: generated } = await apiFetch('/api/seeds/generate', { method: 'POST', body, signal: controller.signal })
    const first = cards.value.length
    // the AI's trap answers fill the tiles, still editable; padded to 3 tiles
    const tilesFrom = (wrong = []) => [...wrong, '', '', ''].slice(0, 3)
    cards.value.push(...generated.map((c) => ({ id: nextId++, fileId: f.id, question: c.question, answer: c.answer, traps: tilesFrom(c.wrong_options) })))
    f.status = 'done'
    f.count = generated.length
    // jump to this file's first pair, unless the user is part-way through changing the card on screen
    if (isEdit ? !editChanged.value : !editing.value) index.value = first
  } catch (e) {
    if (controller.signal.aborted) return // the file was removed while generating
    f.status = 'failed'
    f.error = e instanceof Error ? e.message : String(e)
  } finally {
    controllers.delete(f.id)
  }
}

// A file with pairs asks first (f.confirming shows the prompt); otherwise it goes straight away
function removeFile(f) {
  if (f.status === 'done' && pairsFrom(f) > 0) f.confirming = true
  else dropFile(f)
}
// Removes the file and every pair generated from it (edited ones too)
function dropFile(f) {
  controllers.get(f.id)?.abort()
  cards.value = cards.value.filter((c) => c.fileId !== f.id)
  files.value = files.value.filter((x) => x !== f)
  stopEditing()
  clampIndex()
}

onBeforeUnmount(() => controllers.forEach((c) => c.abort()))

// Preview: all cards in one list. While a card is being typed, it is shown live.
// While a file is generating, a loading box shows if there is nothing else to show, otherwise a short note.
const index = ref(0)
const current = computed(() => cards.value[index.value] ?? null)
const showDraft = computed(() => drafting.value)
const showLoading = computed(() => generating.value && !showDraft.value && cards.value.length === 0)
const canBrowse = computed(() => !showDraft.value && cards.value.length > 0)

function clampIndex() {
  index.value = Math.min(index.value, Math.max(0, cards.value.length - 1))
}
function go(step) {
  if (isEdit) keepEdit() // editing a seed: moving on keeps what was typed in the card on screen
  stopEditing()
  index.value = Math.min(Math.max(0, index.value + step), cards.value.length - 1)
}
watch(drafting, (d) => {
  if (!d) return
  if (isEdit) keepEdit() // editing a seed: starting a new card keeps the changes to the one on screen
  stopEditing()
})

// Edit / delete the pair on screen
const editing = ref(null) // { question, answer, traps } while editing the current pair
const canSaveEdit = computed(() => editing.value?.question.trim() && editing.value?.answer.trim())
function startEdit() {
  editing.value = { question: current.value.question, answer: current.value.answer, traps: [...current.value.traps] }
}
function stopEditing() {
  editing.value = null
}
function saveEdit() {
  if (!canSaveEdit.value) return
  current.value.question = editing.value.question.trim()
  current.value.answer = editing.value.answer.trim()
  current.value.traps = editing.value.traps.map((t) => t.trim())
  stopEditing()
  if (isEdit) startEdit() // editing a seed: the card stays open, ready for more changes
}
function deleteCurrent() {
  stopEditing()
  cards.value.splice(index.value, 1)
  clampIndex()
}

// Editing a seed: the card on screen is always open in its text boxes, with Save instead of Edit.
// Save lights up when the question, answer or a trap answer differs from the card, and turns grey again once saved;
// moving to another card or saving the seed keeps any changes.
const editChanged = computed(() => !!editing.value && !!current.value
  && (editing.value.question.trim() !== current.value.question || editing.value.answer.trim() !== current.value.answer
    || editing.value.traps.some((t, i) => t.trim() !== (current.value.traps[i] ?? '').trim())))
function keepEdit() {
  if (editChanged.value) saveEdit()
}
if (isEdit) {
  // a different card on screen (arrows, delete, a file's new cards) opens that card
  watch(current, (card) => { if (card && !drafting.value) startEdit(); else stopEditing() }, { immediate: true })
  watch(drafting, (d) => { if (!d && current.value && !editing.value) startEdit() }) // back from typing a new card
}

// Card source carousel: the builder and the upload panel take turns in one slot
const SOURCES = [{ id: 'builder', label: 'Flashcard builder' }, { id: 'upload', label: 'Upload a file' }]
const source = ref('builder')
const sourceIndex = computed(() => SOURCES.findIndex((s) => s.id === source.value))
const slideDir = ref('left')
function showSource(i) {
  if (i === sourceIndex.value) return
  slideDir.value = i > sourceIndex.value ? 'left' : 'right'
  source.value = SOURCES[i].id
}

// Progress: 1 name it, 2 add cards (once name and subject are filled), 3 review and save (once a card is really added)
const hasDetails = computed(() => title.value.trim() && subject.value.trim())
const hasCards = computed(() => totalCards.value > 0 || canAddCard.value)
const step = computed(() => (!hasDetails.value ? 1 : totalCards.value > 0 ? 3 : 2))
const stepText = ['Name your study set and subject.', 'Add at least one flashcard or upload a study document.', 'Review your cards, then plant it.']
// what the vine shows for each step: a seed, a sprout, then the chosen flower in bloom.
// seed and sprout are drawn small at the bottom of their 256px canvas (room left for the grown flower), so they get scaled up
const STAGES = computed(() => [
  { src: plantSpriteUrl(1, props.flower, props.color), small: true },
  { src: plantSpriteUrl(2, props.flower, props.color), small: true },
  { src: plantSpriteUrl(BLOOM_STAGE, props.flower, props.color), small: false },
])
// header picture: the finished flower (the vine below shows the progress)
const topArt = computed(() => (isEdit ? tulipSvg : plantSpriteUrl(BLOOM_STAGE, props.flower, props.color)))

const plantNote = computed(() => {
  if (examPast.value) return { error: true, text: 'Pick an exam date from today onwards, or leave it blank.' }
  if (overBy.value > 0) return { error: true, text: `Delete ${overBy.value} ${overBy.value === 1 ? 'card' : 'cards'} to plant. A seed can have at most ${MAX_CARDS}.` }
  if (generating.value) return { error: false, text: 'Wait until your file finishes generating, then plant it.' }
  return null
})
const canPlant = computed(() => hasDetails.value && hasCards.value && !props.busy && !generating.value && overBy.value <= 0 && !examPast.value)

function save() {
  if (!canPlant.value) return
  if (isEdit) keepEdit() // changes typed into the card on screen are saved too
  addCard() // a filled-in card that wasn't added with + yet is kept, not lost
  addTag() // same for a typed tag that wasn't added with Enter
  emit('save', {
    title: title.value.trim(), subject: subject.value.trim(),
    exam_name: examName.value.trim() || undefined, exam_date: examDate.value || undefined, tags: tags.value,
    cards: cards.value.map(({ cardId, question, answer, traps }) => ({ id: cardId, question, answer, wrong_options: cleanTraps(traps, answer) })),
  })
}
</script>

<template>
  <form class="plant-form d-flex flex-column gap-3" data-testid="plant-seed-form" @submit.prevent="save">
    <header class="d-flex align-items-center gap-3 mt-4">
      <img class="top-art flex-shrink-0" :src="topArt" alt="" />
      <div v-if="isEdit">
        <h3 class="sp-display">Edit <em>{{ title }}</em></h3>
        <p class="text-body-small m-0">Cards you keep stay as grown as they are.</p>
      </div>
      <div v-else>
        <h3 class="sp-display">Plant a <em>new seed</em></h3>
        <p class="text-body-small m-0">It will grow into {{ flowerName }} as you revise.</p>
      </div>
    </header>

    <!-- Progress (planting only: an edited seed already has everything): a seed grows along the vine -->
    <section v-if="!isEdit" class="sticky-top" data-testid="seed-progress">
      <div class="d-flex justify-content-between align-items-center gap-1">
        <strong class="small">Step {{ step }} of 3</strong>
        <span class="help text-end">{{ stepText[step - 1] }}</span>
      </div>
      <div
        class="vine" role="progressbar" aria-label="Planting progress"
        :aria-valuenow="Math.round((step / 3) * 100)" aria-valuemin="0" aria-valuemax="100"
      >
        <i class="vine-fill" :style="{ width: `${((step - 1) / 2) * 100}%` }" />
        <img
          v-for="(st, i) in STAGES" :key="i" class="vine-node" :class="{ small: st.small, on: step > i }"
          :style="{ left: `${i * 50}%` }" :src="st.src" alt=""
        />
      </div>
    </section>

    <!-- Study Set Details -->
    <section class="card-box">
      <h4 class="sp-display sp-card-title m-0">Study set details</h4>
      <label class="sp-field">
        <span class="sp-label">Study set name</span>
        <input v-model="title" class="sp-input" maxlength="80" placeholder="e.g. WAD2 Lab Test 1 Revision" data-testid="seed-title" />
      </label>
      <!-- SuggestInput, not <datalist>: Chrome's datalist popup lands in the wrong place in DevTools' phone view -->
      <div class="sp-field">
        <label class="sp-label" for="seed-subject">Subject</label>
        <SuggestInput id="seed-subject" v-model="subject" :suggestions="knownSubjects" maxlength="60"
          placeholder="e.g. WAD2" data-testid="seed-subject" />
      </div>
      <div class="sp-field">
        <label class="sp-label" for="seed-exam-name">Exam</label>
        <SuggestInput id="seed-exam-name" v-model="examName" :suggestions="knownExams" maxlength="40"
          placeholder="e.g. Midterm" data-testid="seed-exam-name" />
      </div>
      <div class="sp-field">
        <label class="sp-label" for="seed-exam-date">Exam date</label>
        <VueDatePicker
          v-model="examDate" model-type="yyyy-MM-dd" :formats="{ input: 'dd-MM-yyyy' }"
          :text-input="{ format: 'dd-MM-yyyy' }" placeholder="DD-MM-YYYY" :min-date="minExamDate"
          :time-config="{ enableTimePicker: false }" auto-apply teleport
          :ui="{ input: 'exam-input' }" :input-attrs="{ id: 'seed-exam-date' }" data-testid="seed-exam-date"
        />
        <span class="help" data-testid="seed-exam-help">{{ examHelp }}</span>
      </div>
      <label class="sp-field">
        <span class="sp-label">Tags</span>
        <input
          v-model="tagInput" class="sp-input" maxlength="20" placeholder="Type a tag, pick a colour, press Enter"
          data-testid="seed-tag-input" @keydown="onTagKey"
        />
      </label>
      <div class="d-flex flex-wrap gap-2" role="radiogroup" aria-label="Tag colour">
        <button
          v-for="c in tagColors" :key="c.id" type="button" class="sp-chip" :style="tagStyle(c.id, tagColor === c.id)"
          role="radio" :aria-checked="tagColor === c.id" :aria-label="c.label"
          :data-testid="`tag-color-${c.id}`" @click="tagColor = c.id"
        >
          <span v-if="tagColor === c.id" aria-hidden="true">✓</span>{{ tagInput.trim() || 'Tag' }}
        </button>
      </div>
      <ul v-if="tags.length" class="d-flex flex-wrap gap-2 list-unstyled m-0 p-0">
        <li v-for="t in tags" :key="t.name" class="sp-chip pe-1" :style="tagStyle(t.color)">
          {{ t.name }}
          <button type="button" class="btn-close" :aria-label="`Remove tag ${t.name}`" @click="tags = tags.filter((x) => x !== t)" />
        </li>
      </ul>
    </section>

    <!-- Flashcard Builder and Upload a file: a two-slide carousel, one shown at a time -->
    <div class="d-flex flex-column gap-2">
      <div class="sp-seg w-100" role="tablist" aria-label="How to add cards">
        <span class="sp-seg-thumb" :style="{ width: 'calc(50% - 4px)', transform: `translateX(${sourceIndex * 100}%)` }" aria-hidden="true" />
        <button
          v-for="(s, i) in SOURCES" :key="s.id" type="button" role="tab"
          :aria-selected="source === s.id" :data-testid="`source-${s.id}`" @click="showSource(i)"
        >{{ s.label }}</button>
      </div>
      <div class="overflow-hidden">
        <Transition :name="`slide-${slideDir}`" mode="out-in">
          <section v-if="source === 'builder'" key="builder" class="card-box" role="tabpanel">
            <div class="d-flex align-items-center justify-content-between gap-2">
              <h4 class="sp-display sp-card-title m-0">Flashcard builder</h4>
              <button type="button" class="sp-btn sp-btn-leaf sp-btn-sm" :disabled="!canAddCard" data-testid="card-add" @click="addCard">+ Add card</button>
            </div>
            <div class="d-grid gap-3">
              <label class="sp-field">
                <span class="sp-label">Question</span>
                <textarea v-model="question" class="sp-input" rows="3" maxlength="500" placeholder="How do you centre text horizontally in CSS?" data-testid="card-question" />
              </label>
              <label class="sp-field">
                <span class="sp-label">Answer</span>
                <textarea v-model="answer" class="sp-input" rows="3" maxlength="500" placeholder="Use text-align: center; on the element." data-testid="card-answer" />
              </label>
            </div>
            <p
              class="d-flex align-items-center gap-2 m-0 small sp-muted sp-tnum"
              :class="overBy > 0 ? 'fw-bold text-berry-deep' : totalCards >= NEAR_LIMIT ? 'fw-bold near' : ''" data-testid="card-count"
            >
              <span class="sp-badge">NEW</span>
              <span>
                {{ totalCards }} / {{ MAX_CARDS }} cards in this set<template v-if="overBy > 0">, delete {{ overBy }} to plant</template><template v-else-if="isFull">, this seed is full</template><template v-else-if="totalCards >= NEAR_LIMIT">, you're near the limit</template>
              </span>
            </p>
          </section>

          <!-- Upload a file -->
          <section v-else key="upload" class="card-box" role="tabpanel">
            <div>
              <h4 class="sp-display sp-card-title m-0">Upload a file</h4>
              <p class="help">Select and upload your notes or slides.</p>
            </div>
            <div
              class="sp-empty-state dropzone d-flex flex-column align-items-center gap-2 text-center py-4 px-3 my-auto"
              :class="{ dragging: dragging && !isFull, full: isFull }" data-testid="file-dropzone"
              @dragover.prevent="dragging = true" @dragleave="dragging = false" @drop.prevent="onDrop"
            >
              <template v-if="isFull">
                <p class="fw-bold m-0">This seed is full ({{ MAX_CARDS }} cards)</p>
                <p class="help">Delete some cards to upload another file.</p>
              </template>
              <template v-else>
                <p class="fw-bold m-0">Choose a file or drag &amp; drop it here</p>
                <p class="help">PDF, PPTX and DOCX supported, up to {{ MAX_MB }}MB</p>
              </template>
              <button type="button" class="sp-btn sp-btn-ghost sp-btn-sm mt-2" :disabled="isFull" data-testid="file-browse" @click="fileInput.click()">Browse file</button>
              <input
                ref="fileInput" type="file" class="visually-hidden" multiple
                accept=".pdf,.pptx,.docx,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                data-testid="file-input" @change="onPick"
              />
            </div>
            <p v-if="fileError" class="sp-field-msg" data-testid="file-error">{{ fileError }}</p>
            <ul v-if="files.length" class="d-flex flex-column gap-2 list-unstyled m-0 p-0">
              <li v-for="f in files" :key="f.id" class="file-row d-flex flex-wrap align-items-center gap-3" data-testid="file-row">
                <span class="sp-badge flex-shrink-0" :class="`type-${extOf(f.name).slice(0, 3)}`">{{ extOf(f.name) }}</span>
                <span class="d-flex flex-column flex-grow-1 overflow-hidden">
                  <span class="text-truncate fw-bold small">{{ f.name }}</span>
                  <span :class="f.status === 'failed' ? 'sp-field-msg' : 'help'">{{ fileSize(f.size) }} · {{ fileStatus(f) }}</span>
                </span>
                <button v-if="f.status === 'failed'" type="button" class="sp-btn sp-btn-sm sp-btn-ghost" @click="generate(f)">Try again</button>
                <button type="button" class="btn-close" :aria-label="`Remove ${f.name}`" @click="removeFile(f)" />
                <div v-if="f.confirming" class="confirm d-flex flex-wrap align-items-center justify-content-between gap-2 w-100" role="alert" data-testid="file-confirm">
                  <p class="m-0 fw-bold small">Delete this file and its {{ pairsFrom(f) }} question/answer {{ pairsFrom(f) === 1 ? 'pair' : 'pairs' }}? Edited pairs are deleted too.</p>
                  <div class="d-flex gap-2">
                    <button type="button" class="sp-btn sp-btn-sm sp-btn-ghost" @click="f.confirming = false">Cancel</button>
                    <button type="button" class="sp-btn sp-btn-sm" data-testid="file-confirm-delete" @click="dropFile(f)">Delete</button>
                  </div>
                </div>
              </li>
            </ul>
          </section>
        </Transition>
      </div>
    </div>

    <!-- Preview -->
    <section class="card-box">
      <div class="d-flex flex-wrap align-items-center gap-2">
        <h4 class="sp-display sp-card-title m-0">Preview</h4>
        <div v-if="canBrowse" class="d-flex gap-2 ms-auto">
          <button type="button" class="sp-icon-btn" :disabled="index === 0" aria-label="Previous pair" data-testid="pair-prev" @click="go(-1)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
          </button>
          <button type="button" class="sp-icon-btn" :disabled="index >= cards.length - 1" aria-label="Next pair" data-testid="pair-next" @click="go(1)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>
      <p v-if="generating && !showLoading" class="help d-flex align-items-center gap-2" role="status" data-testid="preview-generating">
        <span class="spinner-border spinner-border-sm" aria-hidden="true" />Generating cards from your file…
      </p>

      <div v-if="showLoading" class="sp-empty-state loading d-flex flex-column align-items-center justify-content-center gap-2 p-3 text-center sp-muted" role="status" data-testid="preview-loading">
        <span class="spinner-border" aria-hidden="true" />
        <p class="fw-bold m-0">Loading, please wait…</p>
        <p class="help">Reading your document and writing flashcards. Long documents can take a minute.</p>
      </div>

      <template v-else>
        <div v-for="f in failedFiles" :key="f.id" class="d-flex flex-wrap align-items-center justify-content-between gap-2" role="alert">
          <p class="sp-field-msg flex-fill">{{ f.name }}: {{ f.error }}</p>
          <button type="button" class="sp-btn sp-btn-sm sp-btn-ghost" @click="generate(f)">Try again</button>
        </div>

        <div v-if="showDraft || current" class="row g-3" data-testid="card-preview">
          <div class="col-sm-6">
            <div class="card-box face h-100">
              <span v-if="subject" class="sp-chip align-self-start">{{ subject }}</span>
              <span class="text-label-caption">Question</span>
              <textarea v-if="editing" v-model="editing.question" class="sp-input text-start w-100 flex-grow-1" rows="4" maxlength="500" aria-label="Edit question" data-testid="edit-question" />
              <p v-else class="sp-display fs-5 text-break">{{ showDraft ? question : current.question }}</p>
            </div>
          </div>
          <div class="col-sm-6">
            <div class="card-box face answer h-100">
              <span v-if="subject" class="sp-chip align-self-start">{{ subject }}</span>
              <span class="text-label-caption">Answer</span>
              <textarea v-if="editing" v-model="editing.answer" class="sp-input text-start w-100 flex-grow-1" rows="4" maxlength="500" aria-label="Edit answer" data-testid="edit-answer" />
              <p v-else class="m-0 text-break">{{ showDraft ? answer : current.answer }}</p>
            </div>
          </div>
        </div>

        <!-- Quiz options: the answer is ticked, the three traps are crossed out, all written on lines -->
        <details v-if="tileTraps" class="quiz-options" data-testid="quiz-options">
          <summary class="d-flex align-items-baseline gap-2">
            <span class="sp-label">Quiz options</span>
            <span class="help">Optional{{ trapCount ? ` · ${trapCount} trap ${trapCount === 1 ? 'answer' : 'answers'}` : '' }}</span>
          </summary>
          <ul class="list-unstyled m-0 mt-2 p-0">
            <li v-for="n in 4" :key="n" class="line sp-task-row" :style="{ animationDelay: `${(n - 1) * 60}ms` }">
              <span class="sp-check" :class="n === 1 ? 'is-ticked' : 'is-crossed'" aria-hidden="true">
                <svg viewBox="0 0 30 30"><circle class="sp-check-ring" cx="15" cy="15" r="12" /><path class="sp-check-ink" d="M15 3.2C22 3 27.2 8.4 26.8 15.3 26.4 22 21 27 14.6 26.8 8 26.6 3 21.4 3.3 14.8 3.6 8.2 9 3.4 16 3.6" /><path class="sp-check-tick" d="M9.5 15.5l3.8 3.8 7.4-8.3" /><path class="sp-check-cross" d="M10.5 10.5l9 9" /><path class="sp-check-cross" d="M19.5 10.5l-9 9" /></svg>
              </span>
              <span v-if="n === 1" class="line-text sp-task-label" :class="{ empty: !tileAnswer.trim() }" data-testid="tile-correct">{{ tileAnswer.trim() || 'Your answer shows here' }}</span>
              <input v-else-if="trapsEditable" v-model="tileTraps[n - 2]" class="line-input sp-task-label" maxlength="500" :placeholder="`Trap answer ${n - 1}`" :aria-label="`Trap answer ${n - 1}`" :data-testid="`card-trap-${n - 2}`" />
              <span v-else class="line-text sp-task-label" :class="{ empty: !tileTraps[n - 2].trim() }" :data-testid="`card-trap-${n - 2}`">{{ tileTraps[n - 2].trim() || 'No trap answer' }}</span>
              <span v-if="n > 1 && trapNote(tileTraps, n - 2, tileAnswer)" class="sp-field-msg">{{ trapNote(tileTraps, n - 2, tileAnswer) }}</span>
            </li>
          </ul>
        </details>
        <p v-else class="help">No cards yet. Use the Flashcard builder above or upload a file.</p>

        <p v-if="showDraft" class="help">New card. Click Add card to keep it.</p>
        <div v-else-if="current" class="d-flex flex-wrap align-items-center justify-content-between gap-2">
          <span class="small fw-bold sp-muted sp-tnum" data-testid="pair-count">Pair {{ index + 1 }} / {{ cards.length }}</span>
          <div class="d-flex gap-2">
            <!-- editing a seed: the card is always open, so Save sits where Edit was -->
            <template v-if="isEdit">
              <button type="button" class="sp-btn sp-btn-sm sp-btn-leaf" :disabled="!editChanged || !canSaveEdit" data-testid="edit-save" @click="saveEdit">Save</button>
              <button type="button" class="sp-btn sp-btn-sm sp-btn-ghost" data-testid="pair-delete" @click="deleteCurrent">Delete</button>
            </template>
            <template v-else-if="editing">
              <button type="button" class="sp-btn sp-btn-sm sp-btn-ghost" @click="stopEditing">Cancel</button>
              <button type="button" class="sp-btn sp-btn-sm sp-btn-leaf" :disabled="!canSaveEdit" data-testid="edit-save" @click="saveEdit">Save</button>
            </template>
            <template v-else>
              <button type="button" class="sp-btn sp-btn-sm sp-btn-ghost" data-testid="pair-edit" @click="startEdit">Edit</button>
              <button type="button" class="sp-btn sp-btn-sm sp-btn-ghost" data-testid="pair-delete" @click="deleteCurrent">Delete</button>
            </template>
          </div>
        </div>
      </template>
    </section>

    <footer class="d-flex flex-wrap align-items-center justify-content-end gap-3">
      <p v-if="error" class="sp-field-msg w-100" data-testid="seed-error">{{ error }}</p>
      <p v-if="plantNote" :class="plantNote.error ? 'sp-field-msg w-100' : 'help w-100 text-end'" data-testid="plant-note">{{ plantNote.text }}</p>
      <button type="button" class="sp-btn sp-btn-ghost" @click="emit('cancel')">Cancel</button>
      <button type="submit" class="sp-btn" :disabled="!canPlant" data-testid="seed-save">
        <template v-if="isEdit">{{ busy ? 'Saving…' : 'Save changes' }}</template>
        <template v-else>{{ busy ? 'Planting…' : 'Plant it 🌱' }}</template>
      </button>
    </footer>
  </form>
</template>

<style scoped>
.top-art { width: 48px; height: 56px; }
.help { margin: 0; font-size: 13px; line-height: 18px; color: var(--ink-soft); }
.near { color: var(--butter-deep); }

/* surfaces: every panel and every preview face */
.card-box {
  display: flex; flex-direction: column; gap: var(--s-4); padding: var(--s-4);
  border: 1.5px solid var(--line); border-radius: var(--r-md); background: var(--paper);
  box-shadow: 0 4px 12px rgba(107, 74, 58, .06);
}
.face { align-items: center; gap: var(--s-2); padding: var(--s-3); min-height: 160px; text-align: center; box-shadow: none; }
.face.answer { border-color: var(--leaf-soft); background: #eefaf4; }

/* progress: a seed grows into the chosen flower along the vine */
.plant-form > .sticky-top { margin-inline: -24px; padding: 12px 24px 14px; border-bottom: 1px solid var(--line); background: var(--sheet); }
.vine { position: relative; height: 8px; margin: 25px 22px 0; border-radius: 8px; background: var(--line); }
.vine-fill { display: block; height: 100%; border-radius: inherit; background: var(--leaf); transition: width .6s var(--spring); }
.vine-node {
  position: absolute; bottom: -4px; width: 40px; height: 40px; translate: -50% 0; transform-origin: 50% 100%;
  pointer-events: none; filter: grayscale(1) opacity(.35); transition: filter .4s, transform .5s var(--spring);
}
.vine-node.small { transform: scale(1.8); }
.vine-node.on { filter: none; }
.vine-node.on:not(.small) { transform: scale(1.12); }

/* carousel slide */
.slide-left-enter-active, .slide-left-leave-active, .slide-right-enter-active, .slide-right-leave-active { transition: transform .22s ease, opacity .22s ease; }
.slide-left-enter-from, .slide-right-leave-to { transform: translateX(40px); opacity: 0; }
.slide-left-leave-to, .slide-right-enter-from { transform: translateX(-40px); opacity: 0; }

/* fields: SuggestInput's inner input matches .sp-input */
textarea.sp-input { resize: vertical; }
:deep(.suggest-field) { width: 100%; min-height: 48px; padding: .7em 1em; border: 1.5px solid var(--line); border-radius: 14px; background: #fff; }
:deep(.suggest-field:focus) { outline: none; border-color: var(--leaf); box-shadow: 0 0 0 4px color-mix(in srgb, var(--leaf) 18%, transparent); }
.sp-chip .btn-close { font-size: .7rem; }
.sp-icon-btn:disabled { opacity: .4; pointer-events: none; }

/* upload */
.dropzone { transition: border-color .15s, background .15s; }
.dropzone.dragging { border-color: var(--leaf); background: var(--leaf-soft); }
.dropzone.full { background: var(--sheet); color: var(--ink-soft); }
.file-row { padding: 10px 8px 10px 12px; border-radius: var(--r-sm); background: var(--sheet); }
.type-pdf { background: var(--berry); color: #fff; }
.type-ppt { background: var(--butter-deep); color: #fff; }
.type-doc { background: var(--leaf); color: #fff; }
.confirm { padding: 10px 12px; border: 1.5px solid var(--berry); border-radius: var(--r-sm); background: var(--paper); }
.loading { min-height: 160px; border-color: #d9d4d2; background: #eeebea; }

/* quiz options: four lines, answer ticked, traps crossed, written in hand on a dashed underline */
.quiz-options summary { cursor: pointer; list-style: none; }
.quiz-options summary::-webkit-details-marker { display: none; }
.quiz-options summary::before { content: "▸"; color: var(--ink-faint); transition: transform .2s var(--spring); }
.quiz-options[open] summary::before { transform: rotate(90deg); }
.line { display: grid; grid-template-columns: 34px 1fr; align-items: center; gap: 0 10px; min-height: 44px; }
.line > .sp-field-msg { grid-column: 2; }
.line-text.empty, .line-input::placeholder { color: var(--ink-faint); }
.line:first-child .line-text { background: linear-gradient(var(--leaf-soft), var(--leaf-soft)) no-repeat 0 90% / 100% .55em; justify-self: start; }
.line-input { width: 100%; min-width: 0; padding: 0; border: 0; border-bottom: 1.5px dashed var(--line); border-radius: 0; outline: 0; background: none; transition: border-color .2s; }
.line-input:focus { border-bottom-color: var(--leaf); }
</style>

<style>
/* Exam date picker (@vuepic/vue-datepicker) in the form's colours. Not scoped: the calendar menu is teleported to <body>. */
:root .dp--theme-light {
  --dp-font-family: nunito, sans-serif;
  --dp-font-size: 15px;
  --dp-border-radius: 14px;
  --dp-input-padding: 12px 30px 12px 16px;
  --dp-background-color: var(--paper);
  --dp-text-color: var(--ink);
  --dp-border-color: var(--line);
  --dp-border-color-hover: var(--line);
  --dp-border-color-focus: var(--leaf);
  --dp-menu-border-color: var(--line);
  --dp-primary-color: var(--leaf);
  --dp-icon-color: var(--ink-soft);
}
.dp--input.exam-input { border-width: 1.5px; }
</style>