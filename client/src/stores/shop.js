// src/stores/shop.js  (replaces the old client-side shop store)
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase, check } from '@/lib/supabase'
import { useAuthStore } from './auth'

const MESSAGES = {
  INSUFFICIENT_COINS: 'Not enough coins for that yet.',
  STACK_LIMIT: 'Your bag is full of that item.',
  UNKNOWN_ITEM: 'That item is not sold here.',
  INVALID_QUANTITY: 'Invalid quantity.',
  NOT_IN_INVENTORY: "You don't have that item.",
  NOT_AUTHENTICATED: 'Please log in again.',
}
const friendly = (e) => {
  const msg = e?.message ?? ''
  const key = Object.keys(MESSAGES).find((k) => msg.includes(k))
  return key ? MESSAGES[key] : 'Something went wrong. Please try again.'
}

export const useShopStore = defineStore('shop', () => {
  const auth = useAuthStore()

  const items = ref([])      // catalogue rows from `shop_items`
  const inventory = ref({})  // { item_id: qty }
  const loading = ref(false)
  const buying = ref(null)   // id being purchased
  const error = ref('')

  const coins = computed(() => auth.profile?.coins ?? 0)

  // Status is for styling only; the server re-checks everything.
  const catalogue = computed(() =>
    items.value.map((i) => ({
      ...i,
      qty: inventory.value[i.id] ?? 0,
      status: coins.value >= i.price ? 'affordable' : 'too-expensive',
    })),
  )

  async function load() {
    loading.value = true
    error.value = ''
    try {
      const [cat, inv] = await Promise.all([
        supabase.from('shop_items').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('inventory').select('item_id, qty'),
      ])
      items.value = check(cat)
      inventory.value = Object.fromEntries(check(inv).map((r) => [r.item_id, r.qty]))
    } catch {
      error.value = 'Could not load the shop. Please refresh.'
    } finally {
      loading.value = false
    }
  }

  // No client-side math: server response overwrites coins and quantity.
  async function buy(id) {
    if (buying.value) return false
    buying.value = id
    error.value = ''
    try {
      const res = check(await supabase.rpc('buy_item', { p_item: id, p_qty: 1 }))
      auth.profile = { ...auth.profile, coins: res.coins }
      inventory.value = { ...inventory.value, [id]: res.qty }
      return true
    } catch (e) {
      error.value = friendly(e)
      return false
    } finally {
      buying.value = null
    }
  }

  // Consume one item (other features call this, then apply the effect).
  async function use(id) {
    error.value = ''
    try {
      const res = check(await supabase.rpc('use_item', { p_item: id }))
      inventory.value = { ...inventory.value, [id]: res.qty }
      return true
    } catch (e) {
      error.value = friendly(e)
      return false
    }
  }

  return { items, inventory, loading, buying, error, coins, catalogue, load, buy, use }
})