<script setup>

import { computed, ref, useId } from 'vue'

defineOptions({ inheritAttrs: false })
const props = defineProps({
  modelValue: { type: String, default: '' },
  suggestions: { type: Array, default: () => [] },
  max: { type: Number, default: 5 }, // at most this many shown, so the list never covers the form on a small phone
})
const emit = defineEmits(['update:modelValue'])

const listId = `suggest-${useId()}`
const open = ref(false)
const active = ref(-1) // highlighted suggestion (arrow keys), -1 = none

// ones that start with the typed text first, then ones that contain it; never the exact text already typed
const matches = computed(() => {
  const typed = props.modelValue.trim().toLowerCase()
  const others = props.suggestions.filter((s) => s.toLowerCase() !== typed)
  if (!typed) return others.slice(0, props.max)
  const starts = others.filter((s) => s.toLowerCase().startsWith(typed))
  const contains = others.filter((s) => !s.toLowerCase().startsWith(typed) && s.toLowerCase().includes(typed))
  return starts.concat(contains).slice(0, props.max)
})
const showing = computed(() => open.value && matches.value.length > 0)

function onInput(e) {
  emit('update:modelValue', e.target.value)
  open.value = true
  active.value = -1
}

function pick(value) {
  emit('update:modelValue', value)
  open.value = false
  active.value = -1
}

function onKeydown(e) {
  const n = matches.value.length
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    if (!n) return
    e.preventDefault()
    if (!open.value) { open.value = true; active.value = -1 }
    // cycles none -> 1st -> ... -> last -> none (so you can get back to what you typed)
    const step = e.key === 'ArrowDown' ? 1 : -1
    active.value = ((active.value + 1 + step + n + 1) % (n + 1)) - 1
  } else if (e.key === 'Enter' && showing.value && active.value >= 0) {
    e.preventDefault()
    pick(matches.value[active.value])
  } else if (e.key === 'Escape' && showing.value) {
    e.preventDefault()
    e.stopPropagation() // only close the list, not the page's dialog
    open.value = false
  }
}
</script>

<template>
  <div class="suggest">
    <input
      v-bind="$attrs" :value="modelValue" class="suggest-field" type="text" autocomplete="off"
      role="combobox" aria-autocomplete="list" :aria-expanded="showing" :aria-controls="listId"
      :aria-activedescendant="showing && active >= 0 ? `${listId}-${active}` : undefined"
      @input="onInput" @focus="open = true" @blur="open = false; active = -1" @keydown="onKeydown"
    />
    <!-- mousedown.prevent keeps the focus in the input, so the blur doesn't close the list before the click -->
    <ul v-show="showing" :id="listId" class="suggest-list" role="listbox">
      <li
        v-for="(s, i) in matches" :id="`${listId}-${i}`" :key="s" role="option" :aria-selected="i === active"
        class="suggest-option" :class="{ active: i === active }" :data-testid="`${$attrs['data-testid']}-option`"
        @mousedown.prevent @click="pick(s)" @mousemove="active = i"
      >{{ s }}</li>
    </ul>
  </div>
</template>

<style scoped>
.suggest { position: relative; }

/* floats over the fields */
.suggest-list {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 30;
  margin: 0;
  padding: 4px;
  list-style: none;
  border: 2px solid var(--line);
  border-radius: 10px;
  background: var(--paper);
  box-shadow: 0 8px 20px rgba(107, 74, 58, 0.14);
}

.suggest-option {
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 15px;
  color: var(--ink);
  cursor: pointer;
  overflow-wrap: anywhere;
}

.suggest-option.active { background: var(--leaf-soft); }
</style>