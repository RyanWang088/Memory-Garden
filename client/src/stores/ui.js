import { defineStore } from 'pinia'
import { ref } from 'vue'

// Pure client state: nothing here is persisted to the backend.
export const useUiStore = defineStore('ui', () => {
  const activeTool = ref('pointer')   // 'pointer' | 'shovel' | 'wateringCan'
  const shedTab = ref('seeds')        // 'seeds' | 'study' | 'shop'
  const shedOpen = ref(true)          // mobile: collapse/expand the shed
  const seedPicked = ref(false)       // seed packet being dragged, or tapped and waiting for a garden spot
  const seedDragPointerId = ref(null)
  const modal = ref({ open: false, mode: null, seedId: null, draft: null }) // mode: 'create' | 'review'

  function setTool(tool) { activeTool.value = tool }
  function setShedTab(tab) { shedTab.value = tab }

  // Tab 1 when the garden is empty, otherwise tab 2 (study mode)
  function pickDefaultTab(hasPlants) { shedTab.value = hasPlants ? 'study' : 'seeds' }

  function openCreate(draft) { seedPicked.value = false; modal.value = { open: true, mode: 'create', seedId: null, draft } }
  function openReview(seedId) { modal.value = { open: true, mode: 'review', seedId, draft: null } }
  function closeModal() { modal.value = { open: false, mode: null, seedId: null, draft: null } }

  return { activeTool, shedTab, shedOpen, seedPicked, seedDragPointerId, modal, setTool, setShedTab, pickDefaultTab, openCreate, openReview, closeModal }
})
