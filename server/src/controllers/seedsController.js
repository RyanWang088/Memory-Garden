// Controller: handles seed requests, calls the model, sends the JSON response.
import { SeedModel } from '../models/seedModel.js'

const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const isCell = (v) => Number.isInteger(v) && v >= 0 && v < 1000

// Keeps only the fields a new seed may set. Returns an error message string if the body is invalid.
function cleanSeed(body = {}) {
  const title = text(body.title, 80)
  const subject = text(body.subject, 60)
  const cards = (Array.isArray(body.cards) ? body.cards : [])
    .map(c => ({ question: text(c?.question, 500), answer: text(c?.answer, 500) }))
    .filter(c => c.question && c.answer)
  const tags = (Array.isArray(body.tags) ? body.tags : []).slice(0, 8)
    .map(t => ({ name: text(t?.name, 20), color: text(t?.color, 20) }))
    .filter(t => t.name)

  if (!title) return 'Give your study set a name.'
  if (!subject) return 'Pick a subject.'
  if (!cards.length) return 'Add at least one flashcard.'
  if (cards.length > 200) return 'A study set can have at most 200 cards.'
  if (!isCell(body.col) || !isCell(body.row)) return 'Pick a spot in the garden.'

  return { title, subject, tags, cards, col: body.col, row: body.row, flower: 'tulip' }
}

export const seedsController = {
  // GET /api/seeds
  async list(req, res, next) {
    try {
      res.json(await SeedModel.list(req.user.id))
    } catch (err) { next(err) }
  },

  // POST /api/seeds  body: { title, subject, tags, cards: [{ question, answer }], col, row }
  async create(req, res, next) {
    try {
      const seed = cleanSeed(req.body)
      if (typeof seed === 'string') return res.status(400).json({ error: seed })
      res.status(201).json(await SeedModel.create(req.user.id, seed))
    } catch (err) { next(err) }
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

  // DELETE /api/seeds/:id
  async remove(req, res, next) {
    try {
      const deleted = await SeedModel.delete(req.user.id, req.params.id)
      if (!deleted) return res.status(404).json({ error: 'Study set not found.' })
      res.status(204).end()
    } catch (err) { next(err) }
  },
}
