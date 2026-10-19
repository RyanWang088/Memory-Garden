// Picture URL for a plant: stages 1-8 (see lib/plantStage.js), per flower type and colour.
const sprites = import.meta.glob('../assets/foliage/*.svg', { eager: true, query: '?url', import: 'default' })
const url = name => sprites[`../assets/foliage/${name}.svg`]

export const BLOOM_STAGE = 4

// shared by every plant type: 1 seed, 2 sprout, 8 stub.  Per flower: 3-7 (tulip-4, tulip-yellow-4 ...)
const SHARED = { 1: 'seed', 2: 'sprout', 8: 'stub' }
const spriteName = (stage, flower = 'tulip', color) =>
  SHARED[stage] ?? `${flower}${color ? `-${color}` : ''}-${stage}`

// falls back to a plain tulip of that stage, then to the seed
export const plantSpriteUrl = (stage, flower, color) =>
  url(spriteName(stage, flower, color)) ?? url(spriteName(stage, 'tulip')) ?? url('seed')
