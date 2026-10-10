// The four seed packets from the design system (Flowers: four types x growth stages).
// `ids` must match the check on seeds.flower in supabase/setup.sql.
// Emoji are placeholders until the flower and packet art is exported from Figma.
export const flowers = [
  { id: 'sunflower', label: 'Sunflower', emoji: '🌻' },
  { id: 'tulip', label: 'Tulip', emoji: '🌷' },
  { id: 'lavender', label: 'Lavender', emoji: '🪻' },
  { id: 'cactus', label: 'Cactus', emoji: '🌵' },
]

export const flowerById = (id) => flowers.find((f) => f.id === id) || flowers[0]

export const PLOT_COUNT = 8 // garden spots, numbered 0-7 (matches seeds.plot in setup.sql)

export const DRAG_TYPE = 'application/x-memory-garden-seed' // packet -> garden spot drag data
