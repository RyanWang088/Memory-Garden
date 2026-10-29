// Picture URL for a plant: stages 1-8 (see lib/plantStage.js), per flower type and colour.
import { SEED_COLORS } from './tagColors'

const sprites = import.meta.glob('../assets/foliage/*.svg', { eager: true, query: '?url', import: 'default' })
const url = name => sprites[`../assets/foliage/${name}.svg`]

export const BLOOM_STAGE = 4

// Shared by every plant type: 1 seed, 2 sprout, 8 stub. Flower sprites cover stages 3-7.
const SHARED = { 1: 'seed', 2: 'sprout', 8: 'stub' }
const flowerSpriteUrl = (flower, color, stage) =>
  url(`${flower}-${color}-${stage}`) ??
  url(`${flower}-pink-${stage}`) ??
  url(`tulip-pink-${stage}`) ??
  url('seed')

export const plantSpriteUrl = (stage, flower = 'tulip', color = 'pink') => {
  if (SHARED[stage]) return url(SHARED[stage]) ?? url('seed')
  const plantColor = SEED_COLORS.includes(color) ? color : 'pink'
  return flowerSpriteUrl(flower, plantColor, stage)
}

// Any foliage picture by file name, for illustrations outside the garden.
export const foliageUrl = (name) => {
  const directUrl = url(name)
  if (directUrl) return directUrl

  const flowerStage = /^(tulip|hyacinth|lily|wind)(?:-(pink|red|purple|yellow))?-(3|4|5|6|7)$/.exec(name)
  return flowerStage
    ? flowerSpriteUrl(flowerStage[1], flowerStage[2] ?? 'pink', flowerStage[3])
    : url('seed')
}
