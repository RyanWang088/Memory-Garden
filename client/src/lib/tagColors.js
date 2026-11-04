// Tag colours are the app's own CSS variables. A tag is saved in seeds.tags as { name, color } with `color` = id.
// Tags saved before the palette change keep working: LEGACY maps their old ids onto the new ones.
const IDS = ['leaf', 'berry', 'butter', 'lilac', 'sky']
const LEGACY = { mint: 'leaf', peri: 'sky', peach: 'butter' }

export const tagColors = IDS.map((id) => ({ id, label: id[0].toUpperCase() + id.slice(1) }))

export const tagColorById = (id) => tagColors.find((c) => c.id === (LEGACY[id] ?? id)) || tagColors[0]

// Inline style for a tag chip in colour `id`; `selected` adds the coloured border (same shape as before, so existing callers keep working)
export const tagStyle = (id, selected = false) => {
  const colour = `var(--${tagColorById(id).id})`
  return { background: `color-mix(in srgb, ${colour} 26%, var(--sheet))`, color: 'var(--ink)', borderColor: selected ? colour : 'transparent' }
}

export const SEED_COLORS = ['red', 'purple', 'yellow', 'pink']