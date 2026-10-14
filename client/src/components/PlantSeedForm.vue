<script setup>
// Plant a seed: name the study set, pick a subject and tags, build flashcards by hand,
// preview them, then save. Shown after the seed packet is dropped on the garden.
// Emits 'save' with { title, subject, tags, cards } and 'cancel'.
import { computed, ref } from 'vue'
import { useGardenStore } from '@/stores/garden'
import { tagColors, tagStyle } from '@/lib/tagColors'
import tulipSvg from '@/assets/foliage/tulip.svg'

const props = defineProps({
  busy: { type: Boolean, default: false }, // true while the parent is saving
  error: { type: String, default: '' },
})
const emit = defineEmits(['save', 'cancel'])

const garden = useGardenStore()

// Study Set Details
const title = ref('')
const subject = ref('')
const tags = ref([]) // [{ name, color }]
const tagInput = ref('')
const tagColor = ref(tagColors[0].id) // colour for the next tag
const knownSubjects = computed(() => [...new Set(garden.seeds.map((s) => s.subject).filter(Boolean))]) // suggestions only

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

// Flashcard Builder
const question = ref('')
const answer = ref('')
const cards = ref([])
const canAddCard = computed(() => question.value.trim() && answer.value.trim())
const id = ref(0)
function addCard() {
  if (!canAddCard.value) return
  cards.value.push({ id:id.value, question: question.value.trim(), answer: answer.value.trim() })
  question.value = ''
  answer.value = ''
  id.value++
}

// Preview: the card being typed, otherwise the last one added
const preview = computed(() => {
  if (question.value.trim() || answer.value.trim()) return { question: question.value, answer: answer.value }
  return cards.value[cards.value.length - 1] ?? null
})

// Progress: 1 name it, 2 add cards, 3 review and save
const hasDetails = computed(() => title.value.trim() && subject.value.trim())
const hasCards = computed(() => cards.value.length > 0 || canAddCard.value)
const step = computed(() => (!hasDetails.value ? 1 : !hasCards.value ? 2 : 3))
const stepText = ['Name your study set and subject.', 'Add at least one flashcard.', 'Review your cards, then plant it.']

function save() {
  if (step.value < 3 || props.busy) return
  addCard() // a filled-in card that wasn't added with + yet is kept, not lost
  addTag() // same for a typed tag that wasn't added with Enter
  emit('save', { title: title.value.trim(), subject: subject.value.trim(), tags: tags.value, cards: cards.value })
}
</script>

<template>
  <form class="plant-form" data-testid="plant-seed-form" @submit.prevent="save">
    <header class="top mt-3">
      <img class="top-art" :src="tulipSvg" alt="" />
      <div>
        <h3>Plant a new seed</h3>
        <p class="text-body-small sub">It will grow into a tulip as you revise.</p>
      </div>
    </header>
    <!-- Progress -->
    <section class="sticky-top" data-testid="seed-progress">
      <div class="progress-head">
        <strong>Step {{ step }} of 3</strong>
        <span>{{ Math.round((step / 3) * 100) }}%</span>
      </div>
      <div class="progress" role="progressbar">
        <div class="progress-fill" :style="{ width: (step / 3) * 100 + '%' }" />
      </div>
      <p class="help">{{ stepText[step - 1] }}</p>
    </section>

    <!-- Study Set Details -->
    <section class="card-box">
      <h4>Study set details</h4>
      <label class="field">
        <span class="text-label-field">Study set name</span>
        <input v-model="title" maxlength="80" placeholder="e.g. WAD2 Lab Test 1 Revision" data-testid="seed-title" />
      </label>
      <label class="field">
        <span class="text-label-field">Subject</span>
        <input v-model="subject" maxlength="60" list="seed-subjects" placeholder="e.g. WAD2" data-testid="seed-subject" />
        <datalist id="seed-subjects">
          <option v-for="s in knownSubjects" :key="s" :value="s" />
        </datalist>
      </label>
      <label class="field">
        <span class="text-label-field">Tags</span>
        <input
          v-model="tagInput" maxlength="20" placeholder="Type a tag, pick a colour, press Enter"
          data-testid="seed-tag-input" @keydown="onTagKey"
        />
      </label>
      <div class="colours" role="radiogroup" aria-label="Tag colour">
        <button
          v-for="c in tagColors" :key="c.id" type="button" class="tag-pill"
          :class="{ selected: tagColor === c.id }" :style="tagStyle(c.id, tagColor === c.id)"
          role="radio" :aria-checked="tagColor === c.id" :aria-label="c.label"
          :data-testid="`tag-color-${c.id}`" @click="tagColor = c.id"
        >
          <span v-if="tagColor === c.id" aria-hidden="true">✓</span>{{ tagInput.trim() || 'Tag' }}
        </button>
      </div>
      <ul v-if="tags.length" class="chips">
        <li v-for="t in tags" :key="t.name" class="tag-pill" :style="tagStyle(t.color)">
          {{ t.name }}
          <button type="button" :aria-label="`Remove tag ${t.name}`" @click="tags = tags.filter((x) => x !== t)">×</button>
        </li>
      </ul>
    </section>

    <!-- Flashcard Builder -->
    <section class="card-box">
      <div class="card-head">
        <h4>Flashcard builder</h4>
        <button type="button" class="plus" :disabled="!canAddCard" aria-label="Add card" data-testid="card-add" @click="addCard">+</button>
      </div>
      <div class="qa">
        <label class="field">
          <span class="text-label-field">Question</span>
          <textarea v-model="question" rows="3" maxlength="500" placeholder="How do you centre text horizontally in CSS?" data-testid="card-question" />
          <span class="help">Keep it concise.</span>
        </label>
        <label class="field">
          <span class="text-label-field">Answer</span>
          <textarea v-model="answer" rows="3" maxlength="500" placeholder="Use text-align: center; on the element." data-testid="card-answer" />
        </label>
      </div>
      <p class="count" data-testid="card-count">
        <span class="badge text-label-caption">NEW</span> {{ cards.length }} {{ cards.length === 1 ? 'card' : 'cards' }} in this set
      </p>
      <ol v-if="cards.length" class="card-list">
        <li v-for="(c, i) in cards" :key="c.id">
          <span class="q">{{ c.question }}</span>
          <button type="button" :aria-label="`Remove card ${i + 1}`" @click="cards.splice(i, 1)">×</button>
        </li>
      </ol>
    </section>

    <!-- Preview -->
    <section class="card-box">
      <h4>Preview</h4>
      <div v-if="preview" class="flash" data-testid="card-preview">
        <div class="face">
          <span v-if="subject" class="subject-tag">{{ subject }}</span>
          <span class="text-label-caption caption">Question</span>
          <p class="big">{{ preview.question }}</p>
        </div>
        <div class="face answer">
          <span v-if="subject" class="subject-tag">{{ subject }}</span>
          <span class="text-label-caption caption">Answer</span>
          <p>{{ preview.answer }}</p>
        </div>
      </div>
      <p v-else class="help">Your cards will show here as you write them.</p>
    </section>

    <footer class="foot">
      <p v-if="error" class="error" data-testid="seed-error">{{ error }}</p>
      <button type="button" class="ghost-btn text-button" @click="emit('cancel')">Cancel</button>
      <button type="submit" class="plant-btn text-button" :disabled="step < 3 || busy" data-testid="seed-save">
        {{ busy ? 'Planting…' : 'Plant it 🌱' }}
      </button>
    </footer>
  </form>
</template>

<style scoped>
.plant-form { display: flex; flex-direction: column; gap: 16px; color: var(--bark); }
.top { display: flex; align-items: center; gap: 12px; }
.top h3 { margin: 0; }
.top-art { width: 48px; height: 56px; flex: none; }
.sub { margin: 0; color: var(--bark-muted); }
h4 { margin: 0; font-family: 'Fredoka', sans-serif; font-weight: 500; font-size: 18px; line-height: 24px; }

.card-box {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border: 2px solid var(--linen);
  border-radius: 16px;
  background: var(--paper);
  box-shadow: 0 4px 12px rgba(107, 74, 58, 0.06);
}
.card-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }

.field { display: flex; flex-direction: column; gap: 4px; min-width: 0; margin: 0; }
.help { margin: 0; font-size: 13px; line-height: 18px; color: var(--bark-muted); }
input, textarea {
  width: 100%;
  padding: 10px 12px;
  border: 2px solid var(--linen);
  border-radius: 10px;
  background: var(--paper);
  font-size: 15px;
  color: var(--bark);
  resize: vertical;
}
input:focus, textarea:focus { border-color: var(--periwinkle); outline: none; }

.chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 0; padding: 0; list-style: none; }
.colours { display: flex; flex-wrap: wrap; gap: 8px; }

button.tag-pill { cursor: pointer; }
.chips .tag-pill { padding-right: 4px; }
.chips button, .card-list button {
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: 50%;
  background: var(--paper);
  font-weight: 700;
  font-size: 15px;
  line-height: 1;
  color: var(--bark);
  cursor: pointer;
}

.qa { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.plus {
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: 50%;
  background: var(--peach);
  box-shadow: 0 4px 0 var(--berry);
  font-family: 'Fredoka', sans-serif;
  font-weight: 600;
  font-size: 22px;
  line-height: 1;
  color: var(--bark);
  cursor: pointer;
}
.plus:disabled { opacity: 0.45; cursor: default; }
.count { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 13px; line-height: 18px; color: var(--bark-muted); }
.card-list { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; list-style: none; }
.card-list li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 8px 8px 12px;
  border-radius: 10px;
  background: var(--cream);
  font-weight: 700;
  font-size: 14px;
}
.card-list .q { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.flash { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.face {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  min-height: 160px;
  padding: 12px;
  border: 2px solid var(--linen);
  border-radius: 24px;
  background: var(--paper);
  text-align: center;
}
.face.answer { border-color: var(--mint); background: #eefaf4; }
.face p { margin: 0; font-size: 15px; line-height: 22px; overflow-wrap: anywhere; }
.face .big { font-family: 'Fredoka', sans-serif; font-weight: 500; font-size: 18px; line-height: 24px; }
.subject-tag { align-self: flex-start; padding: 2px 10px; border-radius: 999px; background: var(--cream); font-weight: 700; font-size: 12px; }
.caption { color: var(--bark-muted); }

.progress-head { display: flex; justify-content: space-between; font-size: 14px; }
.progress-head span { color: var(--bark-muted); }
.track { height: 10px; border-radius: 999px; background: var(--linen); overflow: hidden; }
.bar { height: 100%; border-radius: inherit; background: var(--mint); transition: width 0.3s ease; }
.plant-form > .sticky-top {
  top: 0;
  z-index: 10;
  margin-inline: -24px;
  padding: 12px 24px;
  border-bottom: 1px solid var(--linen);
  background: var(--cream);
}
.plant-form > .sticky-top .progress {
  height: 6px;
  margin: 8px 0;
  border-radius: 999px;
  background: var(--linen);
}
.plant-form > .sticky-top .progress-fill {
  border-radius: inherit;
  transition: width 0.3s ease;
}
.plant-form > .sticky-top .help { margin: 0; }

.foot { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 12px; }
.error { width: 100%; margin: 0; font-weight: 700; font-size: 14px; color: var(--berry); }
.plant-btn, .ghost-btn {
  padding: 10px 22px;
  border: 0;
  border-radius: 999px;
  color: var(--bark);
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.plant-btn { background: var(--peach); box-shadow: 0 4px 0 var(--berry); }
.plant-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 0 var(--berry); }
.plant-btn:active:not(:disabled) { transform: translateY(2px); box-shadow: 0 2px 0 var(--berry); }
.plant-btn:disabled { opacity: 0.5; cursor: default; }
.ghost-btn { background: transparent; border: 2px solid var(--linen); }
.ghost-btn:hover { background: var(--linen); }

@media (max-width: 575.98px) {
  .qa, .flash { grid-template-columns: 1fr; }
}
</style>
