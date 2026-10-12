// Server-side Supabase client. Uses the secret key, so it bypasses RLS:
// every model query must filter by user_id itself.
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

export const check = ({ data, error }) => { if (error) throw error; return data }
