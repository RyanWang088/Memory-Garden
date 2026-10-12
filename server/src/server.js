// Express API for Sproutly. Routes go in src/routes/ and are mounted under /api.
import express from 'express'
import cors from 'cors'

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

app.get('/api/health', (req, res) => res.json({ ok: true }))

// TODO: mount routers here, e.g. app.use('/api/cards', cardsRouter)

app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`))
