// Generates flashcards from document text with OpenRouter (OPENROUTER_API_KEY / OPENROUTER_MODEL in .env).
// Short documents go in one request so the model sees everything before choosing. Long ones are split
// into parts that each suggest candidates, then one final request picks a non-overlapping, mixed set.
const API_URL = 'https://openrouter.ai/api/v1/chat/completions'
const SINGLE_LIMIT = 400_000 // characters sent in one request (~100k tokens)
const PART_SIZE = 200_000
const MAX_TEXT = 2_000_000 // anything past this is ignored
const PARALLEL = 3
const TIMEOUT_MS = 180_000

const CARD_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['cards'],
  properties: {
    cards: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['question', 'answer', 'topic', 'difficulty'],
        properties: {
          question: { type: 'string' },
          answer: { type: 'string' },
          topic: { type: 'string' },
          difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
        },
      },
    },
  },
}

const PICK_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['picked'],
  properties: { picked: { type: 'array', items: { type: 'integer' } } },
}

const RULES = `Rules:
- Every question must test a DIFFERENT fact or idea. Never ask the same thing twice in different words.
- Spread the questions across the whole document, not just the beginning.
- Mix difficulty: roughly a third easy (recall), a third medium (explain), a third hard (apply or compare).
- Use only information in the document. Skip admin details like URLs, emails, names of staff and page numbers.
- Keep questions short and answers concise (under 400 characters each).
- "topic" is a short label (2-6 words) naming exactly what the question tests.
- If the document has less content, write fewer pairs. Never pad or repeat to reach the maximum.`

const norm = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

async function chat(messages, schema, signal) {
  if (!process.env.OPENROUTER_API_KEY) throw new Error('The AI service is not set up on the server (missing OPENROUTER_API_KEY).')
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || 'openai/gpt-4.1',
      messages,
      temperature: 0.3,
      response_format: { type: 'json_schema', json_schema: { name: 'result', strict: true, schema } },
    }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)].filter(Boolean)),
  })
  const json = await res.json().catch(() => null)
  if (!res.ok) {
    console.error('OpenRouter error', res.status, json?.error)
    throw new Error(res.status === 429 ? 'The AI service is busy. Try again in a minute.' : 'The AI service could not generate cards. Try again.')
  }
  const content = json?.choices?.[0]?.message?.content ?? ''
  try {
    return JSON.parse(content.slice(content.indexOf('{'), content.lastIndexOf('}') + 1))
  } catch {
    throw new Error('The AI returned an unreadable answer. Try again.')
  }
}

const avoidList = (questions) =>
  questions.length ? `\n\nThese questions already exist in the set. Do not repeat or rephrase any of them:\n${questions.map((q) => `- ${q}`).join('\n')}` : ''

function askForCards(text, max, existing, signal, part) {
  const where = part ? ` This is part ${part.n} of ${part.total} of a longer document.` : ''
  return chat([
    { role: 'system', content: `You write study flashcards from a student's document.${where}\nWrite at most ${max} question/answer pairs.\n${RULES}` },
    { role: 'user', content: `Document:\n"""\n${text}\n"""${avoidList(existing)}` },
  ], CARD_SCHEMA, signal)
}

// Drops blanks, caps lengths, and removes repeats (same wording, same topic, or already in the set)
function clean(cards, existing) {
  const seenQ = new Set(existing.map(norm))
  const seenTopic = new Set()
  const out = []
  for (const c of cards ?? []) {
    const question = String(c?.question ?? '').trim().slice(0, 500)
    const answer = String(c?.answer ?? '').trim().slice(0, 500)
    const q = norm(question)
    const topic = norm(String(c?.topic ?? ''))
    if (!question || !answer || seenQ.has(q) || (topic && seenTopic.has(topic))) continue
    seenQ.add(q)
    if (topic) seenTopic.add(topic)
    out.push({ question, answer, topic: c.topic, difficulty: c.difficulty })
  }
  return out
}

async function inBatches(items, size, fn) {
  const results = []
  for (let i = 0; i < items.length; i += size) results.push(...(await Promise.all(items.slice(i, i + size).map(fn))))
  return results
}

// Returns up to `max` cleaned { question, answer } pairs
export async function generateCards(fullText, { max = 50, existing = [], signal } = {}) {
  const text = fullText.slice(0, MAX_TEXT)

  if (text.length <= SINGLE_LIMIT) {
    const { cards } = await askForCards(text, max, existing, signal)
    return clean(cards, existing).slice(0, max).map(({ question, answer }) => ({ question, answer }))
  }

  const parts = []
  for (let i = 0; i < text.length; i += PART_SIZE) parts.push(text.slice(i, i + PART_SIZE))
  const perPart = Math.min(max, Math.ceil((max * 2) / parts.length) + 5) // enough candidates to choose from
  const results = await inBatches(parts, PARALLEL, (p, i) =>
    askForCards(p, perPart, existing, signal, { n: i + 1, total: parts.length }))
  const candidates = clean(results.flatMap((r) => r.cards), existing)
  if (candidates.length <= max) return candidates.map(({ question, answer }) => ({ question, answer }))

  const { picked } = await chat([
    { role: 'system', content: `From these flashcard candidates, pick at most ${max} by index. Choose ones that test different ideas (no overlap), cover the whole document, and mix easy, medium and hard.` },
    { role: 'user', content: candidates.map((c, i) => `${i}. [${c.difficulty}] (${c.topic}) ${c.question}`).join('\n') },
  ], PICK_SCHEMA, signal)
  const chosen = [...new Set(picked)].filter((i) => Number.isInteger(i) && candidates[i]).map((i) => candidates[i])
  return (chosen.length ? chosen : candidates).slice(0, max).map(({ question, answer }) => ({ question, answer }))
}
