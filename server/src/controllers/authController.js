// Controller: checks the registration input, creates the user, sends the JSON response.
import { UserModel } from '../models/userModel.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const authController = {
  // POST /api/auth/register  body: { email, password }
  async register(req, res, next) {
    const email = String(req.body?.email ?? '').trim().toLowerCase()
    const password = String(req.body?.password ?? '')

    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' })
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' })

    try {
      await UserModel.create(email, password)
      res.status(201).json({ ok: true })
    } catch (err) {
      if (err.code === 'email_exists') {
        return res.status(409).json({ error: 'An account with this email already exists. Try logging in.' })
      }
      next(err)
    }
  },
}
