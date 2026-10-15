// Calls the Express server in server/. Vite forwards /api to localhost:3000 (see vite.config.js).
// Sends the logged-in user's Supabase access token so the server knows who is calling.
import { supabase } from './supabase'

// body can be a plain object (sent as JSON) or FormData (for file uploads; the browser sets its own Content-Type).
// signal: an AbortSignal to cancel the request.
export async function apiFetch(path, { method = 'GET', body, signal } = {}) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  const isForm = body instanceof FormData

  const res = await fetch(path, {
    method,
    headers: {
      ...(!isForm && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: isForm ? body : body && JSON.stringify(body),
    signal,
  })

  const json = await res.json().catch(() => null)
  if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`)
  return json
}
