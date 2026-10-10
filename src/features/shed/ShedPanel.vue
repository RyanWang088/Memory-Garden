<script setup>
// Seed Shed: create, read, update and delete seeds.
// Mounted by FeatureHost when this location opens. Emit 'close' to dismiss the overlay.
// Add a seed (design 7): drag a packet onto an empty garden spot, or tap a packet then a
// spot (touch screens don't fire drag events). That opens the Add a seed form.
// "Your seeds" lists planted study sets; Edit reopens the same form filled in, and Remove
// asks for confirmation inside the row (no browser dialog) before deleting.
import { computed, onMounted, ref } from 'vue'
import { useGardenStore } from '@/stores/garden'
import { flowers, flowerById, DRAG_TYPE } from '@/features/garden/flowers'
import GardenPlots from '@/features/garden/GardenPlots.vue'
import AddSeedForm from './AddSeedForm.vue'

defineEmits(['close'])

const garden = useGardenStore()
const error = ref('')
const picked = ref(null) // flower id chosen by tap, waiting for a spot
const draft = ref(null) // { plot, flower, seed? } opens the form; `seed` is set when editing
const saving = ref(false)
const saveError = ref('')
const planted = ref('') // confirmation shown after a save
const sortedSeeds = computed(() => [...garden.seeds].sort((a, b) => a.plot - b.plot))
const confirmingId = ref(null) // seed whose row shows "Remove this seed?"
const removing = ref(false)

onMounted(async () => {
  try {
    await garden.fetchSeeds()
  } catch (e) {
    error.value = e.message
  }
})

function choose(plot, flower) {
  picked.value = null
  confirmingId.value = null
  planted.value = ''
  saveError.value = ''
  draft.value = { plot, flower }
}
function edit(seed) {
  picked.value = null
  confirmingId.value = null
  planted.value = ''
  saveError.value = ''
  draft.value = { plot: seed.plot, flower: seed.flower, seed }
}

async function save(seed) {
  saving.value = true
  saveError.value = ''
  try {
    if (draft.value.seed) {
      await garden.editSeed(draft.value.seed.id, seed)
      planted.value = `✏️ "${seed.title}" is updated.`
    } else {
      await garden.plantSeed(seed)
      planted.value = `🌱 "${seed.title}" is planted in spot ${seed.plot + 1}.`
    }
    draft.value = null // back to the garden, where the sprout now shows
  } catch (e) {
    // 23505 = Supabase unique rule: someone already planted in this spot (e.g. in another tab)
    saveError.value = e.code === '23505' ? 'That spot already has a plant. Go back and pick another spot.' : e.message
  } finally {
    saving.value = false
  }
}
async function remove(seed) {
  removing.value = true
  error.value = ''
  try {
    await garden.removeSeed(seed.id)
    planted.value = `🗑️ "${seed.title}" is removed. Spot ${seed.plot + 1} is free again.`
    confirmingId.value = null
  } catch (e) {
    error.value = e.message
  } finally {
    removing.value = false
  }
}

function onDragStart(e, flower) {
  e.dataTransfer.setData(DRAG_TYPE, flower)
  e.dataTransfer.effectAllowed = 'copy'
}
</script>

<template>
  <section class="shed" data-testid="shed-panel">
    <AddSeedForm
      v-if="draft"
      :plot="draft.plot"
      :flower="draft.flower"
      :seed="draft.seed"
      :busy="saving"
      :error="saveError"
      @save="save"
      @back="draft = null"
    />

    <template v-else>
      <p v-if="error" class="error" data-testid="shed-error">{{ error }}</p>
      <p v-if="planted" class="planted" role="status" data-testid="shed-planted">{{ planted }}</p>

      <div class="tabs" role="tablist">
        <span class="tab active" role="tab" aria-selected="true" data-testid="shed-tab-seeds">Seeds</span>
      </div>
      <div class="seeds" role="tabpanel" data-testid="shed-seeds">
        <p class="hint">
          {{ picked ? 'Now tap an empty spot below to plant it.' : 'Drag a packet onto an empty spot, or tap a packet then a spot.' }}
        </p>
        <div class="packets">
          <button
            v-for="f in flowers"
            :key="f.id"
            type="button"
            class="packet"
            :class="{ picked: picked === f.id }"
            draggable="true"
            :aria-pressed="picked === f.id"
            :data-testid="`packet-${f.id}`"
            @dragstart="onDragStart($event, f.id)"
            @click="picked = picked === f.id ? null : f.id"
          >
            <span class="packet-art" aria-hidden="true">{{ f.emoji }}</span>
            <span>{{ f.label }}</span>
          </button>
        </div>
      </div>

      <GardenPlots plantable :picked="picked" @choose="choose" />

      <section v-if="sortedSeeds.length" class="mine" data-testid="shed-my-seeds">
        <h4>Your seeds</h4>
        <ul class="list">
          <li v-for="s in sortedSeeds" :key="s.id" class="row" :class="{ confirming: confirmingId === s.id }" :data-testid="`my-seed-${s.id}`">
            <span class="row-art" aria-hidden="true">{{ flowerById(s.flower).emoji }}</span>
            <div v-if="confirmingId === s.id" class="row-text" role="alert">
              <strong>Remove "{{ s.title }}"?</strong>
              <span>The plant and its {{ s.cards.length }} {{ s.cards.length === 1 ? 'card' : 'cards' }} will be deleted. This can't be undone.</span>
            </div>
            <div v-else class="row-text">
              <strong>{{ s.title }}</strong>
              <span>{{ s.subject }} · {{ s.cards.length }} {{ s.cards.length === 1 ? 'card' : 'cards' }} · Spot {{ s.plot + 1 }}</span>
            </div>
            <div class="row-actions">
              <template v-if="confirmingId === s.id">
                <button type="button" class="row-btn" :disabled="removing" @click="confirmingId = null">Cancel</button>
                <button type="button" class="row-btn danger" :disabled="removing" :data-testid="`confirm-remove-${s.id}`" @click="remove(s)">
                  {{ removing ? 'Removing…' : 'Remove' }}
                </button>
              </template>
              <template v-else>
                <button type="button" class="row-btn" :data-testid="`edit-seed-${s.id}`" @click="edit(s)">Edit</button>
                <button type="button" class="row-btn danger" :data-testid="`remove-seed-${s.id}`" @click="confirmingId = s.id">Remove</button>
              </template>
            </div>
          </li>
        </ul>
      </section>
    </template>
  </section>
</template>

<style scoped>
.shed { display: flex; flex-direction: column; gap: 16px; }
.error { margin: 0; font: 700 14px var(--font-body); color: var(--petal-deep); }
.planted {
  margin: 0;
  padding: 12px 16px;
  border: 2px solid var(--leaf);
  border-radius: 16px;
  background: #eef7e9;
  font: 800 14px var(--font-body);
  color: var(--leaf-deep);
}

.tabs { display: flex; gap: 4px; margin-bottom: -16px; }
.tab {
  padding: 8px 16px;
  border-radius: 16px 16px 0 0;
  background: var(--paper);
  font: 800 14px var(--font-body);
}
.seeds { padding: 16px; border-radius: 0 16px 16px 16px; background: var(--paper); }
.hint { margin: 0 0 12px; font: 700 14px var(--font-body); color: var(--ink-soft); }
.packets { display: flex; flex-wrap: wrap; gap: 12px; }
.packet {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 88px;
  padding: 12px 8px;
  border: 2px solid var(--line);
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 4px 0 var(--line);
  font: 800 13px var(--font-body);
  cursor: grab;
  transition: transform 0.18s var(--ease-spring);
}
.packet:hover { transform: translateY(-2px); }
.packet:active { cursor: grabbing; }
.packet.picked { border-color: var(--leaf); box-shadow: 0 4px 0 var(--leaf-deep); }
.packet-art { font-size: 32px; line-height: 1; }

.mine { display: flex; flex-direction: column; gap: 12px; }
h4 { margin: 0; font: 800 17px/1.3 var(--font-display); }
.list { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; list-style: none; }
.row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 2px solid var(--line);
  border-radius: 16px;
  background: #fff;
}
.row-art { flex: none; font-size: 28px; line-height: 1; }
.row-text { display: flex; flex-direction: column; flex: 1; min-width: 0; font: 700 13px var(--font-body); color: var(--ink-soft); }
.row-text strong { font: 800 15px var(--font-body); color: var(--ink); overflow-wrap: anywhere; }
.row-btn {
  flex: none;
  padding: 8px 16px;
  border: 2px solid var(--line);
  border-radius: 999px;
  background: #fff;
  font: 800 14px var(--font-body);
  cursor: pointer;
}
.row-btn:hover { background: var(--paper); }
.row-btn:disabled { opacity: 0.6; cursor: default; }
.row-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
/* Warning colours from foundations.png: berry-ink text on berry-soft */
.row.confirming { border-color: #f27a8e; }
.row.confirming .row-text, .row.confirming .row-text strong { color: #a8304a; }
/* Danger: styled like the design's "Forgot" rating button (berry-soft fill, berry-ink text, berry shadow) */
.row-btn.danger { border-color: #ffe1e6; background: #ffe1e6; box-shadow: 0 4px 0 #f27a8e; color: #a8304a; }
.row-btn.danger:hover { border-color: #ffd0d8; background: #ffd0d8; }
.row-btn.danger:active:not(:disabled) { transform: translateY(2px); box-shadow: 0 2px 0 #f27a8e; }
</style>
