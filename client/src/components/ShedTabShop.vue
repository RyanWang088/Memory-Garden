<script setup>
import { onMounted } from 'vue'
import { useShopStore } from '@/stores/shop'
import { useToastStore } from '@/stores/toast'
import { burst } from '@/lib/burst'
import shopSvg from '@/assets/ui/shop.svg'
import coinSvg from '@/assets/ui/coin.svg'

const shop = useShopStore()
const toast = useToastStore()
const supplySprites = import.meta.glob('../assets/ui/*.{svg,png}', {
  eager: true,
  import: 'default',
  query: '?url',
})

const TAPES = ['', 'is-leaf', 'is-butter']
const tapeOf = (n) => TAPES[n % TAPES.length]

function supplyImage(item) {
  return supplySprites[`../assets/ui/${item.id}.svg`]
    ?? supplySprites[`../assets/ui/${item.id}.png`]
    ?? shopSvg
}
const short = (item) => Math.max(0, item.price - shop.coins)
const pct = (item) => (item.price > 0 ? Math.min(100, Math.round((shop.coins / item.price) * 100)) : 100)

async function buy(item, e) {
  if (shop.buying !== null) return
  if (item.status === 'too-expensive') {
    toast.show({
      type: 'warning',
      title: 'Not enough coins',
      message: `You need ${item.price - shop.coins} more coins to buy ${item.name}.`,
    })
    return
  }

  const button = e.currentTarget
  if (!await shop.buy(item.id)) {
    toast.show({
      type: 'warning',
      title: 'Supply purchase failed',
      message: shop.error || 'We couldn’t buy this supply. Please try again.',
    })
    return
  }

  burst(button)
  toast.show({
    type: 'success',
    title: 'Supply purchased',
    message: `${item.name} added to your bag.`,
  })
}

onMounted(() => shop.load())
</script>

<template>
  <section class="shed-shop" data-testid="shed-shop">
    <header class="d-grid gap-2 pb-3 border-bottom">
      <span class="sp-eyebrow">Garden shed</span>
      <h3 class="m-0 fs-3">Shed <em>supplies</em></h3>
      <p class="small text-body-secondary m-0">Tend your garden with a little help from these tools.</p>
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

    <div v-if="shop.catalogue.length" class="sp-packet-grid">
      <div v-for="(item, n) in shop.catalogue" :key="item.id" class="sp-reveal" :style="{ '--i': Math.min(n, 8) }">
        <article class="sp-packet">
          <span class="sp-tape" :class="tapeOf(n)" aria-hidden="true"></span>
          <span class="sp-packet-art"><img :src="supplyImage(item)" alt="" draggable="false" /><span class="sp-ledge"></span></span>
          <span class="sp-packet-name">{{ item.name }}</span>
          <span class="sp-chip bag-chip" :class="{ has: item.qty > 0 }">In bag <b :key="item.qty">{{ item.qty }}</b></span>

          <div v-if="item.status === 'too-expensive'" class="sp-short">
            <div class="sp-meter-bar" role="progressbar" :aria-valuenow="shop.coins" aria-valuemin="0" :aria-valuemax="item.price" :aria-label="`${item.name} savings`"><i :style="{ width: `${pct(item)}%` }"></i></div>
            <small>{{ short(item) }} more coin{{ short(item) === 1 ? '' : 's' }}</small>
          </div>

          <button
            class="sp-btn sp-btn-sm buy-btn" :class="item.status === 'too-expensive' ? 'sp-btn-ghost' : 'sp-btn-butter'" type="button"
            :disabled="shop.buying !== null" :aria-label="`Buy ${item.name} for ${item.price} coins`"
            :data-testid="`buy-${item.id}`" @click="buy(item, $event)"
          >
            <img :src="coinSvg" width="22" height="22" alt="" />{{ shop.buying === item.id ? 'Buying…' : item.price }}
          </button>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped>
.bag-chip { padding: .1em .7em; font-size: .72rem; }
.bag-chip b { display: inline-block; font-variant-numeric: tabular-nums; animation: pop-in .45s var(--spring); }
.bag-chip.has { background: var(--leaf-soft); border-color: var(--leaf); color: var(--leaf-deep); }
</style>