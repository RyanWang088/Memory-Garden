// Model: data access for the `seeds` table (a seed = one topic = one plant).
// Schema (supabase/schema.sql): subjects -> seeds -> cards. Mastery lives on cards only,
// so a seed's mastery is the average card_mastery, calculated here.
import { supabase, check } from '../lib/supabase.js'
import { markTopPriority } from '../lib/priority.js'

const SEED_WITH_RELATIONS = '*, subjects(name, exam_date, exam_choice, shelf_slot), cards(id, question, answer, wrong_options, card_mastery, next_review)'
const DAY = 86_400_000

// How each rating changes ONE card:
//   points = added to card_mastery (kept between 0 and 100)
//   days   = days until the card is due again; 0 = due again today
// forgot / hard / easy come from Flashcard Mode, correct / wrong from Multiple Choice Quiz,
// short_* from Short Structured Mode (typed answers, marked by AI; see shortAnswerRating).
// Typing the answer from memory is the strongest proof, so short_correct earns the most.
export const RATING_RULES = {
  forgot: { points: -5, days: 0 },
  hard: { points: 2, days: 1 },
  easy: { points: 5, days: 3 },
  correct: { points: 5, days: 1 },
  wrong: { points: -5, days: 0 },
  short_correct: { points: 15, days: 5 },
  short_partial: { points: 6, days: 3 },
  short_wrong: { points: -5, days: 0 },
}

// AI score (0-100) for a typed answer -> its rating: 80+ correct, 50-79 partial, below 50 wrong
export function shortAnswerRating(score) {
  return score >= 80 ? 'short_correct' : score >= 50 ? 'short_partial' : 'short_wrong'
}

// seed row + joined subject/cards -> the flat shape the client uses
// exam_date, exam_choice and shelf_slot belong to the subject (shared by all its seeds). The plant's stage is
// worked out on the client (client/src/lib/plantStage.js) because it changes with time since last_reviewed.
function shape({ subjects, cards = [], ...seed }) {
  const mastery = cards.length ? Math.round(cards.reduce((n, c) => n + c.card_mastery, 0) / cards.length) : 0
  return {
    ...seed, subject: subjects?.name ?? '', exam_date: subjects?.exam_date ?? null,
    exam_choice: subjects?.exam_choice ?? null, shelf_slot: subjects?.shelf_slot ?? null,
    cards, mastery,
  }
}

async function getOne(userId, seedId) {
  return shape(check(await supabase.from('seeds').select(SEED_WITH_RELATIONS).eq('id', seedId).eq('user_id', userId).single()))
}

// Find the user's subject by name, or create it. A given exam_date (YYYY-MM-DD) is saved on the subject;
// leaving it out never clears a saved one. A new exam date also clears exam_choice, so "exam is over" asks again
// after that exam (a subject already on the shelf keeps its shelf_slot).
async function subjectIdFor(userId, name, exam_date) {
  const found = check(await supabase.from('subjects').select('id, exam_date').eq('user_id', userId).eq('name', name).maybeSingle())
  if (!found) return check(await supabase.from('subjects').insert({ user_id: userId, name, exam_date }).select('id').single()).id
  if (exam_date && exam_date !== found.exam_date) {
    check(await supabase.from('subjects').update({ exam_date, exam_choice: null }).eq('id', found.id).eq('user_id', userId))
  }
  return found.id
}

export const SeedModel = {
  // Every seed also gets priority + alert (top 6 to revise next, see lib/priority.js). The ranking compares
  // all seeds, so it is only worked out here; single-seed responses don't carry it.
  async list(userId) {
    const rows = check(await supabase.from('seeds').select(SEED_WITH_RELATIONS).eq('user_id', userId))
    return markTopPriority(rows
      .sort((a, b) => Date.parse(b.last_reviewed ?? b.created_at) - Date.parse(a.last_reviewed ?? a.created_at)
        || Date.parse(b.created_at) - Date.parse(a.created_at))
      .map(shape))
  },

  // seed: { title, subject, exam_date?, tags, cards: [{ question, answer, wrong_options }], col, row, flower, color }
  async create(userId, { title, subject, exam_date, tags, cards, col, row, flower, color }) {
    const subject_id = await subjectIdFor(userId, subject, exam_date)
    const seed = check(await supabase.from('seeds')
      .insert({ user_id: userId, subject_id, title, tags, col, row, flower, color })
      .select('id').single())

    const { error } = await supabase.from('cards')
      .insert(cards.map(c => ({ user_id: userId, seed_id: seed.id, question: c.question, answer: c.answer, wrong_options: c.wrong_options })))
    if (error) {
      // no transactions over the REST API: undo the seed so no empty plant is left behind
      await supabase.from('seeds').delete().eq('id', seed.id)
      throw error
    }
    return getOne(userId, seed.id)
  },

  // patch: { mastery?, last_reviewed? }. Mastery is stored per card, so it is written to every card
  // of the seed (placeholder until real spaced-repetition scheduling per card).
  async update(userId, seedId, { mastery, last_reviewed }) {
    if (mastery !== undefined) {
      check(await supabase.from('cards').update({ card_mastery: mastery }).eq('seed_id', seedId).eq('user_id', userId))
    }
    if (last_reviewed !== undefined) {
      check(await supabase.from('seeds').update({ last_reviewed }).eq('id', seedId).eq('user_id', userId))
    }
    return getOne(userId, seedId)
  },

  // One card of one of the user's seeds, or null
  async getCard(userId, seedId, cardId) {
    return check(await supabase.from('cards').select('id, question, answer')
      .eq('id', cardId).eq('seed_id', seedId).eq('user_id', userId).maybeSingle())
  },

  // Saves one review session. ratings: [{ card_id, rating }], e.g. { card_id: '...', rating: 'easy' }.
  // Each card changes on its own (see RATING_RULES). Setting last_reviewed waters the plant.
  // Returns null if the seed doesn't exist for this user.
  async review(userId, seedId, ratings) {
    const cards = check(await supabase.from('cards').select('id, card_mastery').eq('seed_id', seedId).eq('user_id', userId))
    if (!cards.length) return null

    for (const { card_id, rating } of ratings) {
      const card = cards.find(c => c.id === card_id)
      if (!card) continue // not a card of this seed

      const rule = RATING_RULES[rating]
      const card_mastery = Math.max(0, Math.min(100, card.card_mastery + rule.points))
      const next_review = new Date(Date.now() + rule.days * DAY).toISOString()
      check(await supabase.from('cards').update({ card_mastery, next_review }).eq('id', card.id).eq('user_id', userId))
    }

    check(await supabase.from('seeds').update({ last_reviewed: new Date().toISOString() }).eq('id', seedId).eq('user_id', userId))
    return getOne(userId, seedId)
  },

  async delete(userId, seedId) {
    const deleted = check(await supabase.from('seeds')
      .delete()
      .eq('id', seedId)
      .eq('user_id', userId)
      .select('id'))
    return deleted.length > 0
  },
}
