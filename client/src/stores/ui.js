import { defineStore } from 'pinia'
import { ref } from 'vue'

// Pure client state: nothing here is persisted to the backend.
export const useUiStore = defineStore('ui', () => {
  const activeTool = ref('pointer')   // 'pointer' | 'shovel' | 'wateringCan'
  const shedTab = ref('seeds')        // 'seeds' | 'study' | 'shop'
  const shedOpen = ref(true)          // mobile: collapse/expand the shed
  const seedPicked = ref(false)       // seed packet being dragged, or tapped and waiting for a garden spot
  const seedDragPointerId = ref(null)
  const selectedSeedColor = ref('red')
  const selectedGardenSeedId = ref(null)
  const modal = ref({ open: false, mode: null, seedId: null, draft: null }) // mode: 'create' | 'review'

  function setTool(tool) { activeTool.value = tool }
  function setShedTab(tab) {
    shedTab.value = tab
    activeTool.value = tab === 'study' ? 'wateringCan' : 'pointer'
  }

  // Tab 1 when the garden is empty, otherwise tab 2 (study mode)
  function pickDefaultTab(hasPlants) { setShedTab(hasPlants ? 'study' : 'seeds') }
  function selectGardenSeed(seedId) { selectedGardenSeedId.value = seedId }
  function clearGardenSeedSelection() { selectedGardenSeedId.value = null }

  function openCreate(draft) { seedPicked.value = false; modal.value = { open: true, mode: 'create', seedId: null, draft } }
  function openReview(seedId) { modal.value = { open: true, mode: 'review', seedId, draft: null } }
  function closeModal() { modal.value = { open: false, mode: null, seedId: null, draft: null } }

  return {
    activeTool, shedTab, shedOpen, seedPicked, seedDragPointerId, selectedSeedColor, selectedGardenSeedId, modal,
    setTool, setShedTab, pickDefaultTab, selectGardenSeed, clearGardenSeedSelection,
    openCreate, openReview, closeModal,
  }
})
