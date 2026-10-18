// Routes: maps /api/weather URLs to the weather controller. Public: the sky shows before login too.
import { Router } from 'express'
import { weatherController } from '../controllers/weatherController.js'

const router = Router()

router.get('/', weatherController.current)

export default router
