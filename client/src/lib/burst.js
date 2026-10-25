// A little burst of leaves from a button when it's pressed (the journal look's "pressable" feedback).
// Usage in a component:  import { vBurst } from '@/lib/burst'  then  <button v-burst>…</button>
const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export function burst(el, count = 7) {
  if (!el || reduceMotion()) return
  const box = document.createElement('span')
  box.className = 'sp-burst'
  box.setAttribute('aria-hidden', 'true')
  for (let i = 0; i < count; i++) {
    const leaf = document.createElement('i')
    leaf.style.setProperty('--r', `${(360 / count) * i + Math.random() * 30}deg`)
    if (i % 3 === 1) leaf.style.background = 'var(--butter)'
    if (i % 3 === 2) leaf.style.background = 'var(--berry)'
    box.append(leaf)
  }
  if (getComputedStyle(el).position === 'static') el.style.position = 'relative'
  el.append(box)
  setTimeout(() => box.remove(), 750)
}

export const vBurst = {
  mounted(el) { el.addEventListener('click', () => burst(el)) },
}
