// src/stores/flower.js
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase, check } from '@/lib/supabase'
import { useAuthStore } from './auth'

// Owns the seed (flower) shop only. Coins and ownership live on auth.profile.
export const useFlowerStore = defineStore('flowers', () => {
  const auth = useAuthStore()

  const catalog = ref([])
  const loading = ref(false)
  const buying = ref(null) // id being purchased
  const error = ref('')

  const coins = computed(() => auth.profile?.coins ?? 0)
  const owned = computed(() => auth.profile?.unlocked_flowers ?? ['tulip'])

  // Status is for styling only; the server re-checks everything.
  const flowers = computed(() =>
    catalog.value.map((f) => ({
      ...f,
      status: owned.value.includes(f.id)
        ? 'owned'
        : coins.value >= f.price
          ? 'affordable'
          : 'too-expensive',
    })),
  )

  async function load() {
    if (catalog.value.length) return
    loading.value = true
    error.value = ''
    try {
      catalog.value = check(await supabase.from('flowers').select('*').order('price'))
    } catch {
      error.value = 'Could not load the seed shop. Please refresh.'
    } finally {
      loading.value = false
    }
  }

  async function buy(id) {
    if (buying.value) return false
    buying.value = id
    error.value = ''
    try {
      const res = check(await supabase.rpc('buy_flower', { p_flower: id }))
      auth.profile = { ...auth.profile, coins: res.coins, unlocked_flowers: res.unlocked_flowers }
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      return false
    } finally {
      buying.value = null
    }
  }

  return { catalog, loading, buying, error, coins, owned, flowers, load, buy }
})