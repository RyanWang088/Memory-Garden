// Controller: handles seed requests, calls the model, sends the JSON response.
import { SeedModel, RATING_RULES } from '../models/seedModel.js'
import { ACCEPTED_TYPES, extOf, extractText } from '../lib/extractText.js'
import { generateCards } from '../lib/ai.js'

const MAX_AI_CARDS = 50 // per uploaded file

const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const same = (a, b) => a.toLowerCase() === b.toLowerCase()
// A card's trap answers for the quiz: strings only, trimmed to 500, no blanks, none equal to the answer,
// no repeats (case-insensitive), at most 3. Missing or invalid -> [].
function cleanTraps(list, answer) {
  const kept = []
  for (const t of (Array.isArray(list) ? list : []).map(v => text(v, 500))) {
    if (t && !same(t, answer) && !kept.some(k => same(k, t))) kept.push(t)
  }
  return kept.slice(0, 3)
}
const isUuid = (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
const isCell = (v) => Number.isInteger(v) && v >= 0 && v < 1000
// A real YYYY-MM-DD date, today or later. Compared with yesterday in UTC so a user ahead of UTC can still pick their today.
const isUpcomingDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))
  && new Date(v).toISOString().slice(0, 10) === v && v >= new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)

// Keeps only the fields a new seed may set. Returns an error message string if the body is invalid.
function cleanSeed(body = {}) {
  const title = text(body.title, 80)
  const subject = text(body.subject, 60)
  const exam_date = text(body.exam_date, 10) // optional
  const cards = (Array.isArray(body.cards) ? body.cards : [])
    .map(c => {
      const answer = text(c?.answer, 500)
      return { question: text(c?.question, 500), answer, wrong_options: cleanTraps(c?.wrong_options, answer) }
    })
    .filter(c => c.question && c.answer)
  const tags = (Array.isArray(body.tags) ? body.tags : []).slice(0, 8)
    .map(t => ({ name: text(t?.name, 20), color: text(t?.color, 20) }))
    .filter(t => t.name)

  if (!title) return 'Give your study set a name.'
  if (!subject) return 'Pick a subject.'
  if (exam_date && !isUpcomingDate(exam_date)) return 'Pick an exam date from today onwards.'
  if (!cards.length) return 'Add at least one flashcard.'
  if (cards.length > 200) return 'A study set can have at most 200 cards.'
  if (!isCell(body.col) || !isCell(body.row)) return 'Pick a spot in the garden.'

  return { title, subject, exam_date: exam_date || undefined, tags, cards, col: body.col, row: body.row, flower: 'tulip' }
}

export const seedsController = {
  // GET /api/seeds
  async list(req, res, next) {
    try {
      res.json(await SeedModel.list(req.user.id))
    } catch (err) { next(err) }
  },

  // POST /api/seeds  body: { title, subject, exam_date?, tags, cards: [{ question, answer, wrong_options? }], col, row }
  async create(req, res, next) {
    try {
      const seed = cleanSeed(req.body)
      if (typeof seed === 'string') return res.status(400).json({ error: seed })
      res.status(201).json(await SeedModel.create(req.user.id, seed))
    } catch (err) { next(err) }
  },

  // POST /api/seeds/generate  multipart: file, maxCards?, existingQuestions? (JSON array of strings)
  // Reads the document and returns AI-written { cards: [{ question, answer }] }. Nothing is saved.
  async generate(req, res, next) {
    if (!req.file) return res.status(400).json({ error: 'Choose a file to upload.' })
    const filename = Buffer.from(req.file.originalname, 'latin1').toString('utf8') // multer reads names as latin1
    const ext = extOf(filename)
    if (ext === 'ppt') return res.status(400).json({ error: 'Please save it as PPTX and upload again.' })
    if (!ACCEPTED_TYPES.includes(ext)) return res.status(400).json({ error: `${filename} isn't a TXT, PDF, PPTX or DOCX file.` })

    const max = Math.min(MAX_AI_CARDS, Math.max(1, Number.parseInt(req.body.maxCards, 10) || MAX_AI_CARDS))
    let existing = []
    try { existing = JSON.parse(req.body.existingQuestions || '[]') } catch {}
    existing = (Array.isArray(existing) ? existing : []).slice(0, 200).map((q) => text(q, 500)).filter(Boolean)

    // stop the AI calls if the user removes the file (the browser cancels the request)
    const abort = new AbortController()
    res.on('close', () => { if (!res.writableEnded) abort.abort() })

    try {
      const content = await extractText(req.file.buffer, filename)
      if (content.length < 40) {
        return res.status(422).json({ error: "We couldn't find any text in this file. Scanned PDFs and image-only slides aren't supported." })
      }
      const cards = await generateCards(content, { max, existing, signal: abort.signal })
      if (!cards.length) return res.status(422).json({ error: "There isn't enough new study content in this file to make flashcards." })
      res.json({ cards })
    } catch (err) {
      if (!abort.signal.aborted) next(err)
    }
  },

  // PATCH /api/seeds/:id  body: { mastery?, last_reviewed? }
  async update(req, res, next) {
    try {
      const { mastery, last_reviewed } = req.body ?? {}
      if (mastery !== undefined && !(Number.isInteger(mastery) && mastery >= 0 && mastery <= 100)) {
        return res.status(400).json({ error: 'mastery must be a whole number from 0 to 100.' })
      }
      if (last_reviewed !== undefined && Number.isNaN(Date.parse(last_reviewed))) {
        return res.status(400).json({ error: 'last_reviewed must be a date.' })
      }
      res.json(await SeedModel.update(req.user.id, req.params.id, { mastery, last_reviewed }))
    } catch (err) { next(err) }
  },

  // POST /api/seeds/:id/reviews  body: { ratings: [{ card_id, rating }] }
  // rating: forgot | hard | easy (Flexible Deck) or correct | wrong (Structured Quiz)
  async review(req, res, next) {
    try {
      const ratings = req.body?.ratings
      if (!Array.isArray(ratings) || ratings.length === 0 || ratings.length > 200) {
        return res.status(400).json({ error: 'Send between 1 and 200 card ratings.' })
      }
      const allowed = Object.keys(RATING_RULES)
      for (const r of ratings) {
        if (!isUuid(r?.card_id) || !allowed.includes(r.rating)) {
          return res.status(400).json({ error: `Each rating needs a card_id and one of: ${allowed.join(', ')}.` })
        }
      }
      const seed = await SeedModel.review(req.user.id, req.params.id, ratings)
      if (!seed) return res.status(404).json({ error: 'Study set not found.' })
      res.json(seed)
    } catch (err) { next(err) }
  },

  // DELETE /api/seeds/:id
  async remove(req, res, next) {
    try {
      const deleted = await SeedModel.delete(req.user.id, req.params.id)
      if (!deleted) return res.status(404).json({ error: 'Study set not found.' })
      res.status(204).end()
    } catch (err) { next(err) }
  },
}
