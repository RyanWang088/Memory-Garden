<script setup>
import { ref } from 'vue'
import { useShopStore } from '@/stores/shop'
import { useAuthStore } from '@/stores/auth'

// Tab 3: equipment shop (boosters + rewards).
const shop = useShopStore()
const auth = useAuthStore()
const error = ref('')

async function buy(id) {
  error.value = ''
  try { await shop.buy(id) } catch (e) { error.value = e.message }
}
</script>

<template>
  <div data-testid="shed-shop">
    <p class="small">Coins: {{ auth.profile?.coins }}</p>
    <ul class="list-unstyled">
      <li v-for="item in shop.items" :key="item.id" class="d-flex justify-content-between align-items-center mb-2">
        <span>{{ item.name }}</span>
        <button class="btn btn-sm btn-dark" :data-testid="`buy-${item.id}`" @click="buy(item.id)">🪙 {{ item.price }}</button>
      </li>
    </ul>
    <div v-if="error" class="text-danger small">{{ error }}</div>
  </div>
</template>
