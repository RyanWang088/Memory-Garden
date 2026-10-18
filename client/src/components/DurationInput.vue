<script setup>
import { ref, computed } from 'vue'
import { formatSeconds } from '@/stores/pomodoro'

// Google-timer style time box: click it, type digits and they fill in from the right
// (2 5 0 0 -> 00h 25m 00s), Backspace removes the last one, Enter saves and emits 'enter'.
const props = defineProps({
  modelValue: { type: Number, default: null }, // seconds; null = not set yet
  placeholder: { type: String, default: '--:--' },
})
const emit = defineEmits(['update:modelValue', 'enter'])

const MAX_DIGITS = 6 // hhmmss
const editing = ref(false)
const digits = ref('')
let fresh = false // the first digit typed replaces the old time instead of adding to it

const padded = computed(() => digits.value.padStart(MAX_DIGITS, '0'))
const editLabel = computed(() => `${padded.value.slice(0, 2)}h ${padded.value.slice(2, 4)}m ${padded.value.slice(4)}s`)
const shown = computed(() => {
  if (editing.value) return editLabel.value
  return props.modelValue === null ? props.placeholder : formatSeconds(props.modelValue)
})

function startEditing() {
  const total = props.modelValue ?? 0
  const hms = [Math.floor(total / 3600), Math.floor(total / 60) % 60, total % 60]
  digits.value = hms.map(n => String(n).padStart(2, '0')).join('').replace(/^0+/, '')
  editing.value = true
  fresh = true
}

function onBeforeInput(e) {
  e.preventDefault() // the box only ever shows editLabel
  if (e.inputType.startsWith('delete')) digits.value = digits.value.slice(0, -1)
  else if (/^\d$/.test(e.data ?? '')) {
    if (fresh) digits.value = ''
    if (digits.value.length < MAX_DIGITS) digits.value = (digits.value + e.data).replace(/^0+/, '')
  }
  fresh = false
}

// 90m is allowed and becomes 1h 30m, like Google's timer; 0 keeps the old time
function apply() {
  if (!editing.value) return
  editing.value = false
  const p = padded.value
  const seconds = Number(p.slice(0, 2)) * 3600 + Number(p.slice(2, 4)) * 60 + Number(p.slice(4))
  if (seconds > 0) emit('update:modelValue', seconds)
}

function onEnter(e) {
  apply()
  e.target.blur()
  emit('enter')
}

function cancel(e) {
  editing.value = false
  e.target.blur()
}
</script>

<template>
  <input
    type="text" inputmode="numeric" autocomplete="off"
    class="duration-input" :class="{ editing, empty: modelValue === null && !editing }"
    :value="shown"
    @focus="startEditing" @blur="apply" @beforeinput="onBeforeInput"
    @keydown.enter.prevent="onEnter" @keydown.esc="cancel"
  />
</template>

<style scoped>
/* looks like plain text until clicked */
.duration-input {
  display: block;
  width: 100%;
  margin: 0 auto;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: center;
  caret-color: transparent;
  cursor: pointer;
}
.duration-input:focus { outline: none; }
.duration-input.editing { text-decoration: underline 3px var(--periwinkle); text-underline-offset: 10px; cursor: text; }
.duration-input.empty { color: var(--bark-muted); }
</style>
