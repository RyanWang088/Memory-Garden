import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/api'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)     // { id, email }
  const profile = ref(null)  // row from `profiles`
  const ready = ref(false)
  let initPromise = null

  // Called by the router guard on every navigation; only does real work once.
  function init() {
    initPromise ??= (async () => {
      user.value = await api.getSession()
      if (user.value) profile.value = await api.getProfile(user.value.id)
      ready.value = true
    })()
    return initPromise
  }

  async function signUp(email, password) {
    user.value = await api.signUp(email, password)
    profile.value = await api.getProfile(user.value.id)
  }
  async function signIn(email, password) {
    user.value = await api.signIn(email, password)
    profile.value = await api.getProfile(user.value.id)
  }
  async function signOut() {
    await api.signOut()
    user.value = null
    profile.value = null
  }

  async function updateProfile(patch) {
    profile.value = await api.updateProfile(user.value.id, patch)
  }
  // Saves onboarding answers + avatar choice and flips `onboarded` so returning users skip it.
  const completeOnboarding = (answers, avatar = null) =>
    updateProfile({ onboarding_answers: answers, avatar, onboarded: true })

  return { user, profile, ready, init, signUp, signIn, signOut, updateProfile, completeOnboarding }
})
