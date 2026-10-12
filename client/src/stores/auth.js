import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase, check } from '@/lib/supabase'

// Login and profiles talk to Supabase directly (Supabase Auth is meant to run in the browser).
const getProfile = async (userId) =>
  check(await supabase.from('profiles').select('*').eq('id', userId).single())

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
      if (user.value) profile.value = await getProfile(user.value.id)
      ready.value = true
    })()
    return initPromise
  }

  async function signUp(email, password) {
    const { user: u } = check(await supabase.auth.signUp({ email, password }))
    user.value = { id: u.id, email: u.email } // a DB trigger creates the profiles row
    profile.value = await getProfile(user.value.id)
  }
  async function signIn(email, password) {
    const { user: u } = check(await supabase.auth.signInWithPassword({ email, password }))
    user.value = { id: u.id, email: u.email }
    profile.value = await getProfile(user.value.id)
  }
  async function signOut() {
    await supabase.auth.signOut()
    user.value = null
    profile.value = null
  }

  async function updateProfile(patch) {
    profile.value = check(await supabase.from('profiles').update(patch).eq('id', user.value.id).select().single())
  }
  // Saves onboarding answers + avatar choice and flips `onboarded` so returning users skip it.
  const completeOnboarding = (answers, avatar = null) =>
    updateProfile({ onboarding_answers: answers, avatar, onboarded: true })

  return { user, profile, ready, init, signUp, signIn, signOut, updateProfile, completeOnboarding }
})
