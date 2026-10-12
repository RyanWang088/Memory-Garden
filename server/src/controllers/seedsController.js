// Controller: handles seed requests, calls the model, sends the JSON response.
import { SeedModel } from '../models/seedModel.js'

export const seedsController = {
  // GET /api/seeds
  async list(req, res, next) {
    try {
      res.json(await SeedModel.list(req.user.id))
    } catch (err) { next(err) }
  },

  // POST /api/seeds  body: { title, subject, cards, col, row }
  async create(req, res, next) {
    try {
      res.status(201).json(await SeedModel.create(req.user.id, req.body))
    } catch (err) { next(err) }
  },

  // PATCH /api/seeds/:id  body: fields to change, e.g. { mastery, last_reviewed }
  async update(req, res, next) {
    try {
      res.json(await SeedModel.update(req.user.id, req.params.id, req.body))
    } catch (err) { next(err) }
  },
}
