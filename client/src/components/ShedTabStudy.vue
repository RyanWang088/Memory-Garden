<script setup>
import { useUiStore } from '@/stores/ui'

// Tab 2: study mode (default once plants exist). Pick a tool; with the watering can equipped,
// clicking a plant opens the review modal.
const ui = useUiStore()
const tools = [
  { id: 'pointer', label: 'Pointer' },
  { id: 'wateringCan', label: 'Watering can' },
  { id: 'shovel', label: 'Shovel' },
]
</script>

<template>
  <div data-testid="shed-study">
    <p class="small">Choose a tool, then click a plant.</p>
    <div class="btn-group-vertical w-100">
      <button
        v-for="t in tools" :key="t.id" class="btn btn-outline-dark"
        :class="{ active: ui.activeTool === t.id }" :data-testid="`tool-${t.id}`"
        @click="ui.setTool(t.id)"
      >{{ t.label }}</button>
    </div>
  </div>
</template>
