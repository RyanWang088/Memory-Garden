<script setup>
// The app's date field: type DD-MM-YYYY or pick from the calendar. v-model is a YYYY-MM-DD string, or null when cleared.
import { VueDatePicker } from '@vuepic/vue-datepicker'
import '@vuepic/vue-datepicker/dist/main.css'

const model = defineModel({ type: String, default: null })
defineProps({
  inputId: { type: String, required: true },
  minDate: { type: Date, default: undefined },
  clearable: { type: Boolean, default: true },
})
</script>

<template>
  <VueDatePicker
    v-model="model" model-type="yyyy-MM-dd" :formats="{ input: 'dd-MM-yyyy' }"
    :text-input="{ format: 'dd-MM-yyyy' }" placeholder="DD-MM-YYYY" :min-date="minDate"
    :time-config="{ enableTimePicker: false }" auto-apply teleport
    :ui="{ input: 'date-input' }" :input-attrs="{ id: inputId, clearable }"
  />
</template>

<style>
/* @vuepic/vue-datepicker in the app's colours. Not scoped: the calendar menu is teleported to <body>. */
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
.dp--input.date-input { border-width: 1.5px; }
</style>
