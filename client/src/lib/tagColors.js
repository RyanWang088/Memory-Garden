// Tag colours (from the design's Forms -> Tag). A tag is saved in seeds.tags as { name, color } with `color` = id.
export const tagColors = [
  { id: 'peri', label: 'Periwinkle', bg: '#E6EBFF', border: '#8FA4FF', text: '#5A3E36' },
  { id: 'mint', label: 'Mint', bg: '#BFEBD6', border: '#7FC9A6', text: '#5A3E36' },
  { id: 'lilac', label: 'Lilac', bg: '#C7B5FF', border: '#5A3E36', text: '#5A3E36' },
  { id: 'peach', label: 'Peach', bg: '#FF9A85', border: '#E0705C', text: '#5A3E36' },
  { id: 'berry', label: 'Berry', bg: '#FFE1E6', border: '#F27A8E', text: '#A8304A' },
]

export const tagColorById = (id) => tagColors.find((c) => c.id === id) || tagColors[0]

// Inline style for a tag chip in colour `id`; `selected` adds the coloured border
export const tagStyle = (id, selected = false) => {
  const c = tagColorById(id)
  return { background: c.bg, color: c.text, borderColor: selected ? c.border : 'transparent' }
}
