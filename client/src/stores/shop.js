import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useAuthStore } from './auth'

export const useShopStore = defineStore('shop', () => {
  const auth = useAuthStore()

  // Static catalogue is fine for now. Move to a `shop_items` table if it needs to change without a deploy.
  const items = ref([
    { id: 'fertiliser', name: 'Fertiliser', price: 20, kind: 'booster' },
    { id: 'double-exp', name: 'Double EXP (1h)', price: 40, kind: 'booster' },
    { id: 'streak-freeze', name: 'Streak freeze', price: 30, kind: 'booster' },
    { id: 'seed-limited', name: 'Limited edition seed', price: 100, kind: 'seed' },
  ])

  // TODO(backend): store owned items in an `inventory` table (user_id, item_id, qty).
  // For now this only deducts coins from the profile.
  async function buy(itemId) {
    const item = items.value.find(i => i.id === itemId)
    if (!item || auth.profile.coins < item.price) throw new Error('Not enough coins')
    await auth.updateProfile({ coins: auth.profile.coins - item.price })
  }

  return { items, buy }
})
