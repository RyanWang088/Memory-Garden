<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const mode = ref('signup') // 'signup' | 'login'
const email = ref('')
const password = ref('')
const error = ref('')
const busy = ref(false)

async function submit() {
  error.value = ''
  busy.value = true
  try {
    await (mode.value === 'signup' ? auth.signUp(email.value, password.value) : auth.signIn(email.value, password.value))
    router.push({ name: 'garden' }) // the router guard redirects new users to onboarding
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <main class="container py-5" style="max-width: 420px">
    <h2>{{ mode === 'signup' ? 'Create your garden' : 'Welcome back' }}</h2>
    <form @submit.prevent="submit">
    <div class="mb-2"><input v-model="email" type="email" class="form-control" placeholder="Email" autocomplete="email" required data-testid="auth-email" /></div>
    <div class="mb-2"><input v-model="password" type="password" class="form-control" placeholder="Password" :autocomplete="mode === 'signup' ? 'new-password' : 'current-password'" required data-testid="auth-password" /></div>
    <div v-if="error" class="text-danger small mb-2" data-testid="auth-error">{{ error }}</div>
    <button type="submit" class="btn btn-success w-100" :disabled="busy" data-testid="auth-submit">
      {{ mode === 'signup' ? 'Sign up' : 'Log in' }}
    </button>
    <button type="button" class="btn btn-link" @click="mode = mode === 'signup' ? 'login' : 'signup'" data-testid="auth-toggle">
      {{ mode === 'signup' ? 'I already have an account' : 'Create an account' }}
    </button>
    </form>
  </main>
</template>
