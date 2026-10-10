// The ONE switch between mock and real backend.
// Stores import `api` from here and never touch Supabase or localStorage directly.
//delete ltr
import { USE_MOCK } from '@/lib/supabase'
import { mockApi } from './mockApi'
import { supabaseApi } from './supabaseApi'

export const api = USE_MOCK ? mockApi : supabaseApi
