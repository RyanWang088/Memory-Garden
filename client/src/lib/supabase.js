import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !key) throw new Error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY in client/.env.local')

// Used for login and profiles. Seeds go through the Express server (see lib/http.js).
export const supabase = createClient(url, key)

export const check = ({ data, error }) => { if (error) throw error; return data }
