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
const success = ref('')
const busy = ref(false)

// The browser checks the basics (valid email, 8+ characters) before this runs; the server checks again.
async function submit() {
  error.value = ''
  busy.value = true
  try {
    await (mode.value === 'signup' ? auth.signUp(email.value, password.value) : auth.signIn(email.value, password.value))
    success.value = mode.value === 'signup' ? 'Account created! Taking you to your garden…' : 'Logged in! Taking you to your garden…'
    setTimeout(() => router.push({ name: 'garden' }), 800) // the router guard redirects new users to onboarding
  } catch (e) {
    error.value = e.code === 'invalid_credentials' ? 'Wrong email or password.' : e.message
    busy.value = false
  }
}
</script>

<template>
  <main class="auth py-5 px-3">
    <div class="card-box mx-auto">
      <h2 class="text-center mb-3">{{ mode === 'signup' ? 'Create your garden' : 'Welcome back' }}</h2>

      <div v-if="success" class="alert alert-success" role="status" data-testid="auth-success">{{ success }}</div>
      <div v-if="error" class="alert alert-danger" role="alert" data-testid="auth-error">{{ error }}</div>

      <form @submit.prevent="submit">
        <input v-model="email" type="email" class="form-control mb-2" placeholder="Email" autocomplete="email" required data-testid="auth-email" />
        <input v-model="password" type="password" class="form-control mb-2" placeholder="Password" :minlength="mode === 'signup' ? 8 : null" :autocomplete="mode === 'signup' ? 'new-password' : 'current-password'" required data-testid="auth-password" />
        <p v-if="mode === 'signup'" class="text-body-small">At least 8 characters.</p>
        <button type="submit" class="btn btn-success w-100" :disabled="busy" data-testid="auth-submit">
          {{ mode === 'signup' ? 'Sign up' : 'Log in' }}
        </button>
      </form>

      <button type="button" class="btn btn-link w-100 mt-2" @click="mode = mode === 'signup' ? 'login' : 'signup'; error = ''" data-testid="auth-toggle">
        {{ mode === 'signup' ? 'I already have an account' : 'Create an account' }}
      </button>
    </div>
  </main>
</template>

<style scoped>
.auth { background: var(--cream); color: var(--bark); min-height: 100vh; }
.card-box { max-width: 400px; background: var(--paper); border: 3px solid var(--linen); border-radius: 24px; padding: 28px; }
.btn-success { background: var(--mint); border-color: var(--mint); color: var(--bark); }
.btn-link { color: var(--bark); }
</style>
