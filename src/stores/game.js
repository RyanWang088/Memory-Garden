import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { locationById } from '@/world/locations'

export const useGameStore = defineStore('game', () => {
  const activeLocation = ref(null) // id of the open feature overlay, or null
  const nearbyLocation = ref(null) // id of the door the player is standing at
  const travel = ref(null) // { id, nonce } request for the world to move the player

  const mode = computed(() => (activeLocation.value ? 'panel' : 'walking'))
  const active = computed(() => locationById(activeLocation.value))
  const nearby = computed(() => locationById(nearbyLocation.value))

  function requestTravel(id) {
    if (!locationById(id)) return
    travel.value = { id, nonce: (travel.value?.nonce ?? 0) + 1 }
  }

  /** Opens a feature overlay. With `travel`, the player is also moved to its door. */
  function open(id, { travel: moveThere = false } = {}) {
    const loc = locationById(id)
    if (!loc || !loc.panel) return false
    if (moveThere) requestTravel(id)
    activeLocation.value = id
    return true
  }

  function close() {
    activeLocation.value = null
  }

  function setNearby(id) {
    nearbyLocation.value = id
  }

  return { activeLocation, nearbyLocation, travel, mode, active, nearby, open, close, setNearby, requestTravel }
})
