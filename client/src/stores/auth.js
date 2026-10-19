import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase, check } from '@/lib/supabase'
import { apiFetch } from '@/lib/http'
import { usePomodoroStore } from './pomodoro' // pomodoro imports this store too; fine, as both are only used inside functions
import { useMusicStore } from './music'

// Login and profiles talk to Supabase directly (Supabase Auth is meant to run in the browser).
// Registration goes through the Express server (POST /api/auth/register), which validates and creates the account.
const getProfile = async (userId) =>
  check(await supabase.from('profiles').select('*').eq('id', userId).single())

const dayOf = (d) => new Date(d).toLocaleDateString('en-SG')

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)     // { id, email }
  const profile = ref(null)  // row from `profiles`
  const ready = ref(false)
  let initPromise = null

  // Called by the router guard on every navigation; only does real work once.
  function init() {
    initPromise ??= (async () => {
      const { data } = await supabase.auth.getSession()
      const u = data.session?.user
      user.value = u ? { id: u.id, email: u.email } : null
      if (user.value) {
        profile.value = await getProfile(user.value.id)
        await tendStreak()
      }
      ready.value = true
    })()
    return initPromise
  }

  async function signUp(email, password) {
    await apiFetch('/api/auth/register', { method: 'POST', body: { email, password } })
    await signIn(email, password) // a DB trigger already created the profiles row
  }
  async function signIn(email, password) {
    const { user: u } = check(await supabase.auth.signInWithPassword({ email, password }))
    user.value = { id: u.id, email: u.email }
    profile.value = await getProfile(user.value.id)
    await tendStreak()
  }
  async function signOut() {
    usePomodoroStore().endSession() // stops the timer and clears the saved session, so the next user doesn't get it
    useMusicStore().pause()         // the login page has no music button to stop it with
    await supabase.auth.signOut()
    user.value = null
    profile.value = null
  }

  async function updateProfile(patch) {
    profile.value = check(await supabase.from('profiles').update(patch).eq('id', user.value.id).select().single())
  }
  
  // Daily streak per calendar day: visited yesterday -> +1, missed a day -> 1, already visited today -> no change.
  // best_streak keeps the highest streak ever.
  async function tendStreak() {
    const { streak, best_streak = 0, last_tended } = profile.value
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1)
    if (last_tended && dayOf(last_tended) === dayOf(Date.now())) return
    const newStreak = last_tended && dayOf(last_tended) === dayOf(yesterday) ? streak + 1 : 1
    await updateProfile({ streak: newStreak, best_streak: Math.max(best_streak, newStreak), last_tended: new Date().toISOString() })
      .catch(console.error)
  }

  // Study time (Pomodoro focus blocks, Flexible Deck, Structured Quiz). The database adds it, so two tabs
  // adding at once can't overwrite each other.
  async function addStudyTime(seconds) {
    const total = check(await supabase.rpc('add_study_time', { p_seconds: Math.round(seconds) }))
    profile.value = { ...profile.value, study_seconds: total }
  }

  // Saves onboarding answers + avatar choice and flips `onboarded` so returning users skip it.
  const completeOnboarding = (answers, avatar = null) =>
    updateProfile({ onboarding_answers: answers, avatar, onboarded: true })

  return { user, profile, ready, init, signUp, signIn, signOut, updateProfile, addStudyTime, completeOnboarding }
})
