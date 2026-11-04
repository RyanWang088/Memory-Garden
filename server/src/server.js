import express from 'express'
import cors from 'cors'
import authRouter from './routes/auth.js'
import seedsRouter from './routes/seeds.js'
import weatherRouter from './routes/weather.js'

const app = express()
const PORT = process.env.PORT || 3000

// browsers may only call this API from these sites
const ALLOWED_ORIGINS = ['https://memory-garden-gold.vercel.app', 'http://localhost:5173']
app.use(cors({ origin: ALLOWED_ORIGINS }))
app.use(express.json())

app.get('/api/health', (req, res) => res.json({ ok: true }))

app.use('/api/auth', authRouter)
app.use('/api/seeds', seedsRouter)
app.use('/api/weather', weatherRouter)
// TODO: mount more routers here, e.g. app.use('/api/cards', cardsRouter)

// Errors from controllers (next(err)) are sent back as JSON for the client to show
app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: err.message })
})

app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`))
