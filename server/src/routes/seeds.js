// Routes: maps /api/seeds URLs to the seeds controller. Every route requires a logged-in user.
import { Router } from 'express'
import { requireAuth } from '../lib/auth.js'
import { seedsController } from '../controllers/seedsController.js'

const router = Router()

router.use(requireAuth)
router.get('/', seedsController.list)
router.post('/', seedsController.create)
router.patch('/:id', seedsController.update)

export default router
