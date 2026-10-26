// Routes: maps /api/seeds URLs to the seeds controller. Every route requires a logged-in user.
import { Router } from 'express'
import multer from 'multer'
import { requireAuth } from '../lib/auth.js'
import { seedsController } from '../controllers/seedsController.js'

const router = Router()

// one study document per request, kept in memory (never written to disk)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, files: 1 } }).single('file')
const uploadFile = (req, res, next) => upload(req, res, (err) => {
  if (!err) return next()
  res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'This file is over 25MB.' : 'The upload failed. Try again.' })
})

router.use(requireAuth)
router.get('/', seedsController.list)
router.post('/', seedsController.create)
router.post('/generate', uploadFile, seedsController.generate)
router.patch('/:id', seedsController.update)
router.post('/:id/grade', seedsController.grade)
router.post('/:id/reviews', seedsController.review)
router.delete('/:id', seedsController.remove)

export default router
