<script setup>
import { onMounted } from 'vue'
import { useShopStore } from '@/stores/shop'
import { useToastStore } from '@/stores/toast'
import shopSvg from '@/assets/ui/shop.svg'
import { tagStyle } from '@/lib/tagColors'

const shop = useShopStore()
const toast = useToastStore()
const supplySprites = import.meta.glob('../assets/ui/*.{svg,png}', {
  eager: true,
  import: 'default',
  query: '?url',
})

function supplyImage(item) {
  return supplySprites[`../assets/ui/${item.id}.svg`]
    ?? supplySprites[`../assets/ui/${item.id}.png`]
    ?? shopSvg
}

async function buy(item) {
  if (shop.buying !== null) return
  if (item.status === 'too-expensive') {
    toast.show({
      type: 'warning',
      title: 'Not enough coins',
      message: `You need ${item.price - shop.coins} more coins to buy ${item.name}.`,
    })
    return
  }

  if (!await shop.buy(item.id)) {
    toast.show({
      type: 'warning',
      title: 'Supply purchase failed',
      message: shop.error || 'We couldn’t buy this supply. Please try again.',
    })
    return
  }

  toast.show({
    type: 'success',
    title: 'Supply purchased',
    message: `${item.name} added to your bag.`,
  })
}

onMounted(() => shop.load())
</script>

<template>
  <section class="product" data-testid="shed-shop">
    <header class="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
      <h3 class="m-0">Shed Supplies</h3>
      <p class="text-body-small m-0">
        Tend your garden with the help of these tools
      </p>
    </header>

    <p v-if="shop.loading && !shop.items.length" class="text-body-small" role="status">
      Loading supplies…
    </p>
    <p v-if="shop.error && !shop.items.length" class="alert alert-danger py-2 mb-3" role="alert">
      {{ shop.error }}
    </p>
    <div v-if="!shop.loading && !shop.catalogue.length && !shop.error" class="product-empty text-center p-4">
      <span class="d-block mb-2" aria-hidden="true">🧰</span>
      <p class="text-body-small m-0">No supplies are available right now. Please check back soon.</p>
    </div>

    <div v-if="shop.catalogue.length" class="row row-cols-2 g-3">
      <div v-for="item in shop.catalogue" :key="item.id" class="col">
        <article class="product-card d-flex flex-column align-items-center gap-2 p-2">
          <span class="product-art d-flex justify-content-center align-items-center">
            <img class="packet-art" :src="supplyImage(item)" :alt="item.name" draggable="false" />
          </span>
          <span class="text-label-field product-name">{{ item.name }}</span>
          <span class="tag-pill" :style="tagStyle('mint')">
            In bag: {{ item.qty }}
          </span>
          <button
            class="btn seed-buy text-button"
            type="button"
            :disabled="shop.buying !== null"
            :aria-label="`Buy ${item.name} for ${item.price} coins`"
            :data-testid="`buy-${item.id}`"
            @click="buy(item)"
          >
            <img src="../assets/ui/coin.svg" width="30px" alt="" />
            {{ shop.buying === item.id ? 'Buying…' : item.price }}
          </button>
        </article>
      </div>
    </div>
  </section>
</template>
