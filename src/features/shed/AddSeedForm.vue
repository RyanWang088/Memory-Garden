<script setup>
// Add a seed (design 7, steps 4-6), shown in the Seed Shed: name the study set, build flashcards by hand,
// preview them, then save. AI generation from notes is Phase 2.
// Pass `seed` to edit an existing study set instead (its spot and flower stay fixed).
// Emits 'save' with the seed's details and 'back' to return to the garden.
import { computed, ref } from 'vue'
import { useGardenStore } from '@/stores/garden'
import { flowerById } from '@/features/garden/flowers'
import { tagColors, tagStyle, toTag } from '@/features/garden/tagColors'

const props = defineProps({
  plot: { type: Number, required: true },
  flower: { type: String, required: true },
  seed: { type: Object, default: null }, // set when editing
  busy: { type: Boolean, default: false }, // true while the parent is saving
  error: { type: String, default: '' },
})
const emit = defineEmits(['save', 'back'])

const garden = useGardenStore()
const flower = computed(() => flowerById(props.flower))

// Study Set Details (copies, so Back discards edits)
const title = ref(props.seed?.title ?? '')
const subject = ref(props.seed?.subject ?? '')
const tags = ref((props.seed?.tags ?? []).map(toTag)) // [{ name, color }]
const tagInput = ref('')
const tagColor = ref(tagColors[0].id) // colour for the next tag
const knownSubjects = computed(() => [...new Set(garden.seeds.map((s) => s.subject))]) // suggestions only

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
const cards = ref((props.seed?.cards ?? []).map((c) => ({ ...c })))
const canAddCard = computed(() => question.value.trim() && answer.value.trim())

function addCard() {
  if (!canAddCard.value) return
  cards.value.push({ question: question.value.trim(), answer: answer.value.trim() })
  question.value = ''
  answer.value = ''
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
const stepText = ['Name your study set and subject.', 'Add at least one flashcard.', 'Review your cards before saving.']

function save() {
  if (step.value < 3 || props.busy) return
  addCard() // a filled-in card that wasn't added with + yet is kept, not lost
  addTag() // same for a typed tag that wasn't added with Enter
  emit('save', {
    title: title.value.trim(),
    subject: subject.value.trim(),
    tags: tags.value,
    cards: cards.value,
    plot: props.plot,
    flower: props.flower,
  })
}
</script>

<template>
  <form class="add-seed" data-testid="add-seed-form" @submit.prevent="save">
    <header class="top">
      <button type="button" class="back" data-testid="add-seed-back" @click="emit('back')">← Back</button>
      <div>
        <h3>{{ seed ? 'Edit seed' : 'Add a seed' }}</h3>
        <p class="sub">{{ flower.emoji }} {{ flower.label }} in spot {{ plot + 1 }}</p>
      </div>
    </header>

    <!-- Study Set Details -->
    <section class="card">
      <h4>Study Set Details</h4>
      <label class="field">
        <span class="label">Study Set Name</span>
        <input v-model="title" maxlength="80" placeholder="e.g. WAD2 Lab Test 1 Revision" data-testid="seed-title" />
      </label>
      <label class="field">
        <span class="label">Subject</span>
        <input v-model="subject" maxlength="60" list="seed-subjects" placeholder="e.g. WAD2 — Web Application Development 2" data-testid="seed-subject" />
        <datalist id="seed-subjects">
          <option v-for="s in knownSubjects" :key="s" :value="s" />
        </datalist>
      </label>
      <label class="field">
        <span class="label">Tags</span>
        <input
          v-model="tagInput"
          maxlength="20"
          placeholder="Type a tag, pick a colour, press Enter"
          data-testid="seed-tag-input"
          @keydown="onTagKey"
        />
      </label>
      <div class="colours" role="radiogroup" aria-label="Tag colour">
        <button
          v-for="c in tagColors"
          :key="c.id"
          type="button"
          class="tag-pill"
          :class="{ selected: tagColor === c.id }"
          :style="tagStyle(c.id, tagColor === c.id)"
          role="radio"
          :aria-checked="tagColor === c.id"
          :aria-label="c.label"
          :data-testid="`tag-color-${c.id}`"
          @click="tagColor = c.id"
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
    <section class="card">
      <div class="card-head">
        <h4>Flashcard Builder</h4>
        <button type="button" class="plus" :disabled="!canAddCard" aria-label="Add card" data-testid="card-add" @click="addCard">+</button>
      </div>
      <div class="qa">
        <label class="field">
          <span class="label">Question</span>
          <textarea v-model="question" rows="3" maxlength="500" placeholder="How do you centre text horizontally in CSS?" data-testid="card-question" />
          <span class="help">Keep it concise.</span>
        </label>
        <label class="field">
          <span class="label">Answer</span>
          <textarea v-model="answer" rows="3" maxlength="500" placeholder="Use text-align: center; on the element." data-testid="card-answer" />
        </label>
      </div>
      <p class="count" data-testid="card-count">
        <span class="badge">NEW</span> {{ cards.length }} {{ cards.length === 1 ? 'card' : 'cards' }} in this set
      </p>
      <ol v-if="cards.length" class="card-list">
        <li v-for="(c, i) in cards" :key="i">
          <span class="q">{{ c.question }}</span>
          <button type="button" :aria-label="`Remove card ${i + 1}`" @click="cards.splice(i, 1)">×</button>
        </li>
      </ol>
    </section>

    <!-- Preview -->
    <section class="card">
      <h4>Preview</h4>
      <div v-if="preview" class="flash" data-testid="card-preview">
        <div class="face">
          <span v-if="subject" class="tag">{{ subject }}</span>
          <span class="caption">Question</span>
          <p class="big">{{ preview.question }}</p>
        </div>
        <div class="face answer">
          <span v-if="subject" class="tag">{{ subject }}</span>
          <span class="caption">Answer</span>
          <p>{{ preview.answer }}</p>
        </div>
      </div>
      <p v-else class="help">Your cards will show here as you write them.</p>
    </section>

    <!-- Progress -->
    <section class="card progress" data-testid="seed-progress">
      <div class="progress-head">
        <strong>Step {{ step }} of 3</strong>
        <span>{{ Math.round((step / 3) * 100) }}%</span>
      </div>
      <div class="track"><div class="bar" :style="{ width: (step / 3) * 100 + '%' }" /></div>
      <p class="help">{{ stepText[step - 1] }}</p>
    </section>

    <!-- Footer actions -->
    <footer class="foot">
      <p class="help">✦ Tip: check each answer against your notes.</p>
      <p v-if="error" class="error" data-testid="seed-error">{{ error }}</p>
      <button type="submit" class="primary" :disabled="step < 3 || busy" data-testid="seed-save">
        {{ busy ? 'Saving…' : seed ? 'Save Changes' : 'Save Study Set' }}
      </button>
    </footer>
  </form>
</template>

<style scoped>
.add-seed { display: flex; flex-direction: column; gap: 16px; }
.top { display: flex; align-items: center; gap: 12px; }
h3 { margin: 0; font: 800 22px/1.2 var(--font-display); }
h4 { margin: 0; font: 800 17px/1.3 var(--font-display); }
.sub { margin: 2px 0 0; font: 700 14px var(--font-body); color: var(--ink-soft); }
.back {
  flex: none;
  padding: 8px 16px;
  border: 2px solid var(--line);
  border-radius: 999px;
  background: #fff;
  font: 800 14px var(--font-body);
  cursor: pointer;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border: 2px solid var(--line);
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 4px 12px rgba(92, 64, 44, 0.06);
}
.card-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }

.field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.label { font: 800 14px var(--font-body); }
.help { margin: 0; font: 600 13px var(--font-body); color: var(--ink-soft); }
input, textarea {
  width: 100%;
  padding: 10px 12px;
  border: 2px solid var(--line);
  border-radius: 8px;
  background: #fff;
  font: 600 15px var(--font-body);
  color: var(--ink);
  resize: vertical;
}
input:focus, textarea:focus { border-color: var(--sky-deep); outline: none; }

.chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 0; padding: 0; list-style: none; }
/* Tag (components.png -> Forms): pill, colours come from tagStyle(); selected = 2px border + check */
.colours { display: flex; flex-wrap: wrap; gap: 8px; }
.tag-pill {
  display: flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  padding: 4px 12px;
  border: 2px solid transparent;
  border-radius: 999px;
  font: 800 13px var(--font-body);
  overflow-wrap: anywhere;
}
button.tag-pill { cursor: pointer; }
.chips .tag-pill { padding-right: 4px; }
.chips button, .card-list button {
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.7);
  font: 800 15px/1 var(--font-body);
  cursor: pointer;
}

.qa { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.plus {
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: 50%;
  background: var(--petal);
  box-shadow: 0 4px 0 var(--petal-deep);
  font: 800 22px/1 var(--font-body);
  color: #fff;
  cursor: pointer;
}
.plus:disabled { opacity: 0.45; cursor: default; }
.count { display: flex; align-items: center; gap: 8px; margin: 0; font: 700 13px var(--font-body); color: var(--ink-soft); }
.badge { padding: 2px 8px; border-radius: 999px; background: var(--paper); font: 800 11px var(--font-body); color: var(--ink); }
.card-list { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; list-style: none; }
.card-list li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 8px 8px 12px;
  border-radius: 8px;
  background: var(--paper);
  font: 700 14px var(--font-body);
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
  border: 2px solid var(--line);
  border-radius: 24px;
  background: #fff;
  text-align: center;
}
.face.answer { border-color: var(--sky-deep); background: #e8f5fb; }
.face p { margin: 0; font: 600 15px/1.4 var(--font-body); overflow-wrap: anywhere; }
.face .big { font: 800 18px/1.3 var(--font-display); }
.tag { align-self: flex-start; padding: 2px 10px; border-radius: 999px; background: var(--paper); font: 800 12px var(--font-body); }
.caption { font: 800 12px var(--font-body); letter-spacing: 0.04em; text-transform: uppercase; color: var(--ink-soft); }

.progress { gap: 8px; }
.progress-head { display: flex; justify-content: space-between; font: 700 14px var(--font-body); }
.progress-head span { color: var(--ink-soft); }
.track { height: 10px; border-radius: 999px; background: var(--line); overflow: hidden; }
.bar { height: 100%; border-radius: inherit; background: var(--leaf); transition: width 0.3s ease; }

.foot { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; }
.error { width: 100%; margin: 0; font: 700 14px var(--font-body); color: var(--petal-deep); }
.primary {
  padding: 12px 24px;
  border: 0;
  border-radius: 999px;
  background: var(--leaf);
  box-shadow: 0 4px 0 var(--leaf-deep);
  font: 800 16px var(--font-body);
  color: #fff;
  cursor: pointer;
}
.primary:active:not(:disabled) { transform: translateY(2px); box-shadow: 0 2px 0 var(--leaf-deep); }
.primary:disabled { opacity: 0.5; cursor: default; }

@media (max-width: 719px) {
  .qa, .flash { grid-template-columns: 1fr; }
}
</style>
