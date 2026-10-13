// Routes: maps /api/auth URLs to the auth controller. Public: nobody is logged in yet.
import { Router } from 'express'
import { authController } from '../controllers/authController.js'

const router = Router()

router.post('/register', authController.register)

export default router
