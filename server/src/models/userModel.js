// Model: creates accounts with Supabase Auth's admin API (needs the secret key, so it runs on the server).
import { supabase, check } from '../lib/supabase.js'

export const UserModel = {
  async create(email, password) {
    // email_confirm: true = no confirmation email, the account works right away
    return check(await supabase.auth.admin.createUser({ email, password, email_confirm: true }))
  },

  // Deletes the user. Seeds go first because seeds -> subjects is ON DELETE RESTRICT;
  // profiles, subjects, cards and inventory then cascade from auth.users.
  async remove(userId) {
    check(await supabase.from('seeds').delete().eq('user_id', userId))
    return check(await supabase.auth.admin.deleteUser(userId))
  },
}
