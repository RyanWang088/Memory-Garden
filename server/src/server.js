// Express API for Sproutly. Routes go in src/routes/ and are mounted under /api.
import express from 'express'
import cors from 'cors'
import seedsRouter from './routes/seeds.js'

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

app.get('/api/health', (req, res) => res.json({ ok: true }))

app.use('/api/seeds', seedsRouter)
// TODO: mount more routers here, e.g. app.use('/api/cards', cardsRouter)

// Errors from controllers (next(err)) are sent back as JSON for the client to show
app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: err.message })
})

app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`))
