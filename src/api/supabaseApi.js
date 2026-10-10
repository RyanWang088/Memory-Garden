// Real backend. Same method names/shapes as mockApi.js. See docs/BACKEND_WIRING.md for the schema.
import { supabase } from '@/lib/supabase'

const check = ({ data, error }) => { if (error) throw error; return data }

export const supabaseApi = {
  // ---- auth ----
  async getSession() {
    const { data } = await supabase.auth.getSession()
    const u = data.session?.user
    return u ? { id: u.id, email: u.email } : null
  },
  async signUp(email, password) {
    const { user } = check(await supabase.auth.signUp({ email, password }))
    return { id: user.id, email: user.email } // a DB trigger creates the profiles row
  },
  async signIn(email, password) {
    const { user } = check(await supabase.auth.signInWithPassword({ email, password }))
    return { id: user.id, email: user.email }
  },
  async signOut() { await supabase.auth.signOut() },

  // ---- profile ----
  async getProfile(userId) {
    return check(await supabase.from('profiles').select('*').eq('id', userId).single())
  },
  async updateProfile(userId, patch) {
    return check(await supabase.from('profiles').update(patch).eq('id', userId).select().single())
  },

  // ---- seeds ----
  async listSeeds(userId) {
    return check(await supabase.from('seeds').select('*').eq('user_id', userId).order('created_at'))
  },
  async createSeed(userId, seed) {
    return check(await supabase.from('seeds').insert({ ...seed, user_id: userId }).select().single())
  },
  async updateSeed(userId, seedId, patch) {
    return check(await supabase.from('seeds').update(patch).eq('id', seedId).eq('user_id', userId).select().single())
  },
}
