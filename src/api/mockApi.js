// localStorage-backed fake backend. Same method names/shapes as supabaseApi.js.
const read = (k, fallback) => JSON.parse(localStorage.getItem(`sproutly:${k}`) ?? 'null') ?? fallback
const write = (k, v) => localStorage.setItem(`sproutly:${k}`, JSON.stringify(v))
const uid = () => {
  const cryptoObj = globalThis.crypto

  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return cryptoObj.randomUUID()
  }

  const bytes = new Uint8Array(16)
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    cryptoObj.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256)
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

const newProfile = (id, email) => ({
  id, email, display_name: email.split('@')[0],
  onboarded: false, onboarding_answers: {}, avatar: null,
  coins: 50, exp: 0, streak: 0, last_tended: null,
})

export const mockApi = {
  // ---- auth ----
  async getSession() { return read('session', null) },
  async signUp(email, password) {
    const users = read('users', [])
    if (users.some(u => u.email === email)) throw new Error('Email already registered')
    const user = { id: uid(), email, password }
    write('users', [...users, user])
    write('profiles', { ...read('profiles', {}), [user.id]: newProfile(user.id, email) })
    write('session', { id: user.id, email })
    return { id: user.id, email }
  },
  async signIn(email, password) {
    const user = read('users', []).find(u => u.email === email && u.password === password)
    if (!user) throw new Error('Wrong email or password')
    write('session', { id: user.id, email })
    return { id: user.id, email }
  },
  async signOut() { write('session', null) },

  // ---- profile ----
  async getProfile(userId) { return read('profiles', {})[userId] ?? null },
  async updateProfile(userId, patch) {
    const all = read('profiles', {})
    all[userId] = { ...all[userId], ...patch }
    write('profiles', all)
    return all[userId]
  },

  // ---- seeds (a seed = one topic = one plant) ----
  async listSeeds(userId) { return read(`seeds:${userId}`, []) },
  async createSeed(userId, seed) {
    // Same rule as the Supabase table: one plant per garden spot
    if (read(`seeds:${userId}`, []).some(s => s.plot === seed.plot)) throw new Error('That spot already has a plant')
    const row = {
      id: uid(), user_id: userId, title: seed.title, subject: seed.subject ?? 'General',
      tags: seed.tags ?? [], cards: seed.cards ?? [], plot: seed.plot, flower: seed.flower,
      mastery: 0, last_reviewed: null, exam_date: seed.exam_date ?? null,
      created_at: new Date().toISOString(),
    }
    write(`seeds:${userId}`, [...read(`seeds:${userId}`, []), row])
    return row
  },
  async updateSeed(userId, seedId, patch) {
    const list = read(`seeds:${userId}`, []).map(s => (s.id === seedId ? { ...s, ...patch } : s))
    write(`seeds:${userId}`, list)
    return list.find(s => s.id === seedId)
  },
  async deleteSeed(userId, seedId) {
    write(`seeds:${userId}`, read(`seeds:${userId}`, []).filter(s => s.id !== seedId))
  },
}
