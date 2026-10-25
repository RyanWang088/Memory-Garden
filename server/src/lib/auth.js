// Verifies the Supabase access token sent by the client ("Authorization: Bearer <token>")
// and puts the logged-in user on req.user for the controllers.
import { supabase } from './supabase.js'

export async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer /, '')
  if (!token) return res.status(401).json({ error: 'Missing access token' })

  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return res.status(401).json({ error: 'Invalid access token' })

  req.user = { id: data.user.id, email: data.user.email }
  next()
}
