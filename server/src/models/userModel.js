// Model: creates accounts with Supabase Auth's admin API (needs the secret key, so it runs on the server).
import { supabase, check } from '../lib/supabase.js'

export const UserModel = {
  async create(email, password) {
    // email_confirm: true = no confirmation email, the account works right away
    return check(await supabase.auth.admin.createUser({ email, password, email_confirm: true }))
  },
}
