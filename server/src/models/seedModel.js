import { supabase, check } from '../lib/supabase.js'
import { markTopPriority } from '../lib/priority.js'

const SEED_WITH_RELATIONS = '*, subjects(name, shelf_slot), exams!seeds_exam_fkey(name, exam_date, exam_choice), '
  + 'cards(id, question, answer, wrong_options, card_mastery, next_review)'
const DAY = 86_400_000


// Flashcards send only a card's first rating. A forgotten card is requeued in the session, but its retry earns
// nothing and is never saved, so it always ends up due in 1 day.
export const RATING_RULES = {
  forgot: { points: -5, days: 1 },
  hard: { points: 2, days: 1 },
  easy: { points: 5, days: 3 },
  correct: { points: 5, days: 1 },
  wrong: { points: -5, days: 0 },
  short_correct: { points: 15, days: 5 },
  short_partial: { points: 6, days: 3 },
  short_wrong: { points: -5, days: 0 },
}

export function shortAnswerRating(score) {
  return score >= 80 ? 'short_correct' : score >= 50 ? 'short_partial' : 'short_wrong'
}

function shape({ subjects, exams, cards = [], ...seed }) {
  const mastery = cards.length ? Math.round(cards.reduce((n, c) => n + c.card_mastery, 0) / cards.length) : 0
  return {
    ...seed, subject: subjects?.name ?? '', shelf_slot: subjects?.shelf_slot ?? null,
    exam_name: exams?.name ?? null, exam_date: exams?.exam_date ?? null, exam_choice: exams?.exam_choice ?? null,
    cards, mastery,
  }
}

async function getOne(userId, seedId) {
  return shape(check(await supabase.from('seeds').select(SEED_WITH_RELATIONS).eq('id', seedId).eq('user_id', userId).single()))
}

// Find the user's subject by name, or create it
async function subjectIdFor(userId, name) {
  const found = check(await supabase.from('subjects').select('id').eq('user_id', userId).eq('name', name).maybeSingle())
  if (found) return found.id
  return check(await supabase.from('subjects').insert({ user_id: userId, name }).select('id').single()).id
}


async function examIdFor(userId, subject_id, { name, exam_date }) {
  const exams = check(await supabase.from('exams').select('id, name, exam_date').eq('user_id', userId).eq('subject_id', subject_id))
  const found = exams.find(e => e.name.toLowerCase() === name.toLowerCase())
  if (!found) {
    return check(await supabase.from('exams').insert({ user_id: userId, subject_id, name, exam_date }).select('id').single()).id
  }
  if (exam_date && exam_date !== found.exam_date) {
    check(await supabase.from('exams').update({ exam_date, exam_choice: null }).eq('id', found.id).eq('user_id', userId))
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

  // seed: { title, subject, exam?: { name, exam_date? }, tags, cards: [{ question, answer, wrong_options }], col, row, flower, color }
  async create(userId, { title, subject, exam, tags, cards, col, row, flower, color }) {
    const subject_id = await subjectIdFor(userId, subject)
    const exam_id = exam ? await examIdFor(userId, subject_id, exam) : null
    const seed = check(await supabase.from('seeds')
      .insert({ user_id: userId, subject_id, exam_id, title, tags, col, row, flower, color })
      .select('id').single())

    const { error } = await supabase.from('cards')
      .insert(cards.map(c => ({ user_id: userId, seed_id: seed.id, question: c.question, answer: c.answer, wrong_options: c.wrong_options })))
    if (error) {
      // no transactions over the REST API: undo the seed so no empty plant is left behind
      // .eq('id', seed.id) =>  Only the row whose id equals this seed's id
      await supabase.from('seeds').delete().eq('id', seed.id)
      throw error
    }
    return getOne(userId, seed.id)
  },

  // Edits a seed's details and cards  
  async edit(userId, seedId, { title, subject, exam, tags, cards }) {
    const found = check(await supabase.from('seeds').select('id').eq('id', seedId).eq('user_id', userId).maybeSingle())
    if (!found) return null

    const subject_id = await subjectIdFor(userId, subject)
    const exam_id = exam ? await examIdFor(userId, subject_id, exam) : null
    // subject_id and exam_id change together: the exam must belong to the seed's subject
    check(await supabase.from('seeds').update({ title, tags, subject_id, exam_id }).eq('id', seedId).eq('user_id', userId))

    const existing = new Set(check(await supabase.from('cards').select('id').eq('seed_id', seedId).eq('user_id', userId)).map(c => c.id))
    const kept = cards.filter(c => c.id && existing.has(c.id))
    const added = cards.filter(c => !c.id || !existing.has(c.id))
    const removed = [...existing].filter(id => !kept.some(c => c.id === id))

    // added first and removed last, so a failure part-way never leaves the seed with no cards
    if (added.length) {
      check(await supabase.from('cards').insert(added.map(c => ({
        user_id: userId, seed_id: seedId, question: c.question, answer: c.answer, wrong_options: c.wrong_options,
      }))))
    }
    for (const c of kept) {
      check(await supabase.from('cards').update({ question: c.question, answer: c.answer, wrong_options: c.wrong_options })
        .eq('id', c.id).eq('seed_id', seedId).eq('user_id', userId))
    }
    if (removed.length) {
      check(await supabase.from('cards').delete().in('id', removed).eq('seed_id', seedId).eq('user_id', userId))
    }
    return getOne(userId, seedId)
  },

  
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

  // Saves one review session.
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
