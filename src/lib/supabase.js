import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

// True when no keys are present -> the app uses src/api/mockApi.js instead.
export const USE_MOCK = !url || !key
export const supabase = USE_MOCK ? null : createClient(url, key)
