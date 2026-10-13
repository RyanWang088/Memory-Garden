<script setup>
import { useAuthStore } from '@/stores/auth'
const auth = useAuthStore()

async function logout() {
  await auth.signOut()
  window.location.assign('/') // reload so the next user doesn't see this user's data
}
</script>

<template>
  <h1>profile edit page?</h1>
  <button class="btn btn-outline-dark" @click="logout" data-testid="logout">Log out</button>
</template>
