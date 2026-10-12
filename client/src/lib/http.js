// Calls the Express server in server/. Vite forwards /api to localhost:3000 (see vite.config.js).
// Sends the logged-in user's Supabase access token so the server knows who is calling.
import { supabase } from './supabase'

export async function apiFetch(path, { method = 'GET', body } = {}) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token

  const res = await fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body && JSON.stringify(body),
  })

  const json = await res.json().catch(() => null)
  if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`)
  return json
}
