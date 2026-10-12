// Model: data access for the `seeds` table (a seed = one topic = one plant).
// Same queries as client/src/api/supabaseApi.js.
import { supabase, check } from '../lib/supabase.js'

export const SeedModel = {
  async list(userId) {
    return check(await supabase.from('seeds').select('*').eq('user_id', userId).order('created_at'))
  },
  async create(userId, seed) {
    return check(await supabase.from('seeds').insert({ ...seed, user_id: userId }).select().single())
  },
  async update(userId, seedId, patch) {
    return check(await supabase.from('seeds').update(patch).eq('id', seedId).eq('user_id', userId).select().single())
  },
}
