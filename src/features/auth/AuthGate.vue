<script setup>
// Sign up and log in (Supabase auth). Mounted from App.vue before the map is playable.
// Ported from the `simplified` branch's AuthView. There is no router here, so once the
// auth store has a user, App.vue swaps this out for onboarding or the map.
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
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
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="screen" data-testid="auth-gate">
    <form class="card" @submit.prevent="submit">
      <h2>{{ mode === 'signup' ? 'Create your garden' : 'Welcome back' }}</h2>
      <input v-model="email" type="email" class="field" placeholder="Email" autocomplete="email" data-testid="auth-email" />
      <input
        v-model="password"
        type="password"
        class="field"
        placeholder="Password"
        :autocomplete="mode === 'signup' ? 'new-password' : 'current-password'"
        data-testid="auth-password"
      />
      <p v-if="error" class="error" data-testid="auth-error">{{ error }}</p>
      <button type="submit" class="primary" :disabled="busy" data-testid="auth-submit">
        {{ mode === 'signup' ? 'Sign up' : 'Log in' }}
      </button>
      <button type="button" class="link" data-testid="auth-toggle" @click="mode = mode === 'signup' ? 'login' : 'signup'">
        {{ mode === 'signup' ? 'I already have an account' : 'Create an account' }}
      </button>
    </form>
  </section>
</template>

<style scoped>
.screen {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 16px;
  overflow: auto;
  background: #fff;
}
.card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: min(420px, 100%);
  padding: 24px;
  border: 3px solid #fff;
  border-radius: 28px;
  background: var(--cream);
  box-shadow: var(--shadow);
}
h2 { margin: 0 0 6px; font: 800 26px/1.1 var(--font-display); }
.field {
  width: 100%;
  padding: 12px 14px;
  border: 2px solid var(--line);
  border-radius: 14px;
  background: #fff;
  font: 700 16px var(--font-body);
  color: var(--ink);
}
.field:focus { border-color: var(--leaf); outline: none; }
.error { margin: 0; font: 700 14px var(--font-body); color: var(--petal-deep); }
.primary {
  padding: 12px;
  border: 0;
  border-radius: 999px;
  background: var(--leaf);
  font: 800 16px var(--font-body);
  color: #fff;
  cursor: pointer;
}
.primary:hover { background: var(--leaf-deep); }
.primary:disabled { opacity: 0.6; cursor: default; }
.link {
  align-self: center;
  padding: 6px;
  border: 0;
  background: none;
  font: 700 14px var(--font-body);
  color: var(--ink-soft);
  text-decoration: underline;
  cursor: pointer;
}
</style>
