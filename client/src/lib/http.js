// Calls the Express server in server/. Vite forwards /api to localhost:3000 (see vite.config.js).
// Sends the logged-in user's Supabase access token so the server knows who is calling.
import { supabase } from './supabase'

// body can be a plain object (sent as JSON) or FormData (for file uploads; the browser sets its own Content-Type).
// signal: an AbortSignal to cancel the request.
export async function apiFetch(path, { method = 'GET', body, signal } = {}) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  const isForm = body instanceof FormData

  const send = () => fetch(path, {
    method,
    headers: {
      ...(!isForm && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: isForm ? body : body && JSON.stringify(body),
    signal,
  })

  let res = await send()
  let text = await res.text()
  // An empty 500 comes from Vite's proxy when the server can't be reached (e.g. it is restarting after a save);
  // the server's own errors always have a JSON body. The request never got to the server, so it is safe to resend once.
  if (res.status === 500 && !text) {
    await wait(RETRY_MS, signal)
    res = await send()
    text = await res.text()
  }

  let json = null
  try { json = JSON.parse(text) } catch { /* empty or not JSON */ }
  if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`)
  return json
}

const RETRY_MS = 1000

// resolves after ms, or rejects straight away if the request is cancelled meanwhile
function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason)
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason) }, { once: true })
  })
}
