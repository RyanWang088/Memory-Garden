// Routes: maps /api/auth URLs to the auth controller.
// Register is public (nobody is logged in yet); deleting an account needs the logged-in user.
import { Router } from 'express'
import { requireAuth } from '../lib/auth.js'
import { authController } from '../controllers/authController.js'

const router = Router()

router.post('/register', authController.register)
router.delete('/account', requireAuth, authController.deleteAccount)

export default router
