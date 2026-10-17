// Model: data access for the `seeds` table (a seed = one topic = one plant).
// Schema (supabase/setup.sql): subjects -> seeds -> cards. Mastery lives on cards only,
// so a seed's mastery is the average card_mastery, calculated here.
import { supabase, check } from '../lib/supabase.js'

const SEED_WITH_RELATIONS = '*, subjects(name, exam_date), cards(id, question, answer, card_mastery, next_review)'

// seed row + joined subject/cards -> the flat shape the client uses
// exam_date belongs to the subject (shared by all its seeds); stage: 0 sprout, 1 seedling, 2 bloom
function shape({ subjects, cards = [], ...seed }) {
  const mastery = cards.length ? Math.round(cards.reduce((n, c) => n + c.card_mastery, 0) / cards.length) : 0
  return {
    ...seed, subject: subjects?.name ?? '', exam_date: subjects?.exam_date ?? null,
    cards, mastery, stage: mastery < 34 ? 0 : mastery < 67 ? 1 : 2,
  }
}

async function getOne(userId, seedId) {
  return shape(check(await supabase.from('seeds').select(SEED_WITH_RELATIONS).eq('id', seedId).eq('user_id', userId).single()))
}

// Find the user's subject by name, or create it. A given exam_date (YYYY-MM-DD) is saved on the subject;
// leaving it out never clears a saved one.
async function subjectIdFor(userId, name, exam_date) {
  const found = check(await supabase.from('subjects').select('id, exam_date').eq('user_id', userId).eq('name', name).maybeSingle())
  if (!found) return check(await supabase.from('subjects').insert({ user_id: userId, name, exam_date }).select('id').single()).id
  if (exam_date && exam_date !== found.exam_date) {
    check(await supabase.from('subjects').update({ exam_date }).eq('id', found.id).eq('user_id', userId))
  }
  return found.id
}

export const SeedModel = {
  async list(userId) {
    const rows = check(await supabase.from('seeds').select(SEED_WITH_RELATIONS).eq('user_id', userId).order('created_at'))
    return rows.map(shape)
  },

  // seed: { title, subject, exam_date?, tags, cards: [{ question, answer }], col, row, flower }
  async create(userId, { title, subject, exam_date, tags, cards, col, row, flower }) {
    const subject_id = await subjectIdFor(userId, subject, exam_date)
    const seed = check(await supabase.from('seeds')
      .insert({ user_id: userId, subject_id, title, tags, col, row, flower })
      .select('id').single())

    const { error } = await supabase.from('cards')
      .insert(cards.map(c => ({ user_id: userId, seed_id: seed.id, question: c.question, answer: c.answer })))
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

  async delete(userId, seedId) {
    const deleted = check(await supabase.from('seeds')
      .delete()
      .eq('id', seedId)
      .eq('user_id', userId)
      .select('id'))
    return deleted.length > 0
  },
}
