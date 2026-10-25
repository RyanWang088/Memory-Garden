<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useGardenStore } from '@/stores/garden'
import FlowerShelf from '@/components/FlowerShelf.vue'

const auth = useAuthStore()
const garden = useGardenStore()
const route = useRoute()
const router = useRouter()

const loadError = ref('')
const unlocking = ref(false)
const unlockError = ref('')

// 0 -> "0h", 9000 -> "2.5h"
const hoursStudied = computed(() => `${Number(((auth.profile?.study_seconds ?? 0) / 3600).toFixed(1))}h`)
const stats = computed(() => [
  { value: auth.profile?.streak ?? 0, label: 'sunny streak', id: 'streak' },
  { value: auth.profile?.best_streak ?? 0, label: 'best streak', id: 'best-streak' },
  { value: hoursStudied.value, label: 'studied', id: 'studied' },
  { value: 0, label: 'blooms kept', id: 'blooms-kept' }, // placeholder for now
])
const newId = computed(() => (typeof route.query.new === 'string' ? route.query.new : ''))

onMounted(async () => {
  try {
    if (!garden.loaded) await garden.fetchSeeds()
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
  }
})

async function unlockShelf() {
  if (unlocking.value) return
  unlocking.value = true
  unlockError.value = ''
  try {
    await garden.unlockShelf()
  } catch (e) {
    unlockError.value = e instanceof Error ? e.message : String(e)
  } finally {
    unlocking.value = false
  }
}

async function logout() {
  await auth.signOut()
  await router.replace({ name: 'landing' })
  window.location.reload() // reload so the next user doesn't see this user's data
}

/* ---------- account settings: change password, log out, delete account ---------- */
const pw = ref({ open: false, current: '', next: '', confirm: '', busy: false, error: '', done: false })
async function changePassword() {
  const f = pw.value
  f.error = ''; f.done = false
  if (!f.current) { f.error = 'Enter your current password.'; return }
  if (f.next.length < 8) { f.error = 'Use at least 8 characters for the new password.'; return }
  if (f.next !== f.confirm) { f.error = "The new passwords don't match."; return }
  if (f.next === f.current) { f.error = 'Pick a password different from the current one.'; return }
  f.busy = true
  try {
    await auth.changePassword(f.current, f.next)
    pw.value = { open: false, current: '', next: '', confirm: '', busy: false, error: '', done: true }
  } catch (e) {
    f.error = e instanceof Error ? e.message : String(e)
  } finally {
    f.busy = false
  }
}

const del = ref({ open: false, password: '', typed: '', busy: false, error: '' })
const canDelete = computed(() => del.value.password && del.value.typed.trim().toUpperCase() === 'DELETE')
async function deleteAccount() {
  if (!canDelete.value || del.value.busy) return
  del.value.busy = true; del.value.error = ''
  try {
    await auth.deleteAccount(del.value.password)
    await router.replace({ name: 'landing' })
    window.location.reload()
  } catch (e) {
    del.value.error = e instanceof Error ? e.message : String(e)
    del.value.busy = false
  }
}
</script>

<template>
  <main class="profile-page" data-testid="profile">
    <aside class="profile-side d-flex flex-column gap-3">
      <div>
        <p class="text-label-caption m-0 eyebrow">Profile</p>
        <h1 class="m-0">Your flower house</h1>
      </div>
      <ul class="stats list-unstyled m-0">
        <li v-for="stat in stats" :key="stat.id" class="stat" :data-testid="`stat-${stat.id}`">
          <span class="text-stat">{{ stat.value }}</span>
          <span class="text-body-small">{{ stat.label }}</span>
        </li>
      </ul>

      <!-- Account & settings: the three account actions, always visible here -->
      <section id="settings" class="settings" aria-labelledby="settings-title" data-testid="settings">
        <h2 id="settings-title" class="settings-title">Account &amp; settings</h2>
        <p class="text-body-small m-0">Signed in as <b>{{ auth.user?.email }}</b></p>

        <div class="setting">
          <div class="setting-row">
            <span class="setting-ic" aria-hidden="true">🔑</span>
            <span class="flex-fill"><b>Change password</b><small>Use at least 8 characters.</small></span>
            <button type="button" class="sp-btn sp-btn-ghost sp-btn-sm" :aria-expanded="pw.open" data-testid="settings-password" @click="pw.open = !pw.open; pw.error = ''; pw.done = false">
              {{ pw.open ? 'Cancel' : 'Change' }}
            </button>
          </div>
          <p v-if="pw.done" class="setting-ok" role="status">Password changed.</p>
          <form v-if="pw.open" class="setting-form" novalidate @submit.prevent="changePassword">
            <label class="sp-field"><span>Current password</span><input v-model="pw.current" class="sp-input" type="password" autocomplete="current-password" data-testid="pw-current" /></label>
            <label class="sp-field"><span>New password</span><input v-model="pw.next" class="sp-input" type="password" autocomplete="new-password" minlength="8" data-testid="pw-new" /></label>
            <label class="sp-field"><span>Repeat new password</span><input v-model="pw.confirm" class="sp-input" type="password" autocomplete="new-password" data-testid="pw-confirm" /></label>
            <p v-if="pw.error" class="sp-field-msg" role="alert">{{ pw.error }}</p>
            <button class="sp-btn sp-btn-leaf sp-btn-sm" type="submit" :disabled="pw.busy" data-testid="pw-save">{{ pw.busy ? 'Saving…' : 'Save new password' }}</button>
          </form>
        </div>

        <div class="setting">
          <div class="setting-row">
            <span class="setting-ic" aria-hidden="true">👋</span>
            <span class="flex-fill"><b>Log out</b><small>You can log back in any time.</small></span>
            <button type="button" class="sp-btn sp-btn-ghost sp-btn-sm" data-testid="logout" @click="logout">Log out</button>
          </div>
        </div>

        <div class="setting danger">
          <div class="setting-row">
            <span class="setting-ic" aria-hidden="true">🗑️</span>
            <span class="flex-fill"><b>Delete account</b><small>Removes your garden, seeds and progress for good.</small></span>
            <button type="button" class="sp-btn sp-btn-sm" data-testid="settings-delete" @click="del = { open: true, password: '', typed: '', busy: false, error: '' }">Delete</button>
          </div>
        </div>
      </section>
    </aside>

    <Teleport to="body">
      <div v-if="del.open" class="del-backdrop" role="presentation" @click.self="!del.busy && (del.open = false)" @keydown.esc="!del.busy && (del.open = false)">
        <form class="del-sheet" role="dialog" aria-modal="true" aria-labelledby="del-title" data-testid="delete-dialog" @submit.prevent="deleteAccount">
          <span class="sp-tape" aria-hidden="true"></span>
          <h2 id="del-title">Delete your account?</h2>
          <p class="text-body-small">This permanently deletes your garden, every seed and flashcard, your coins, streak and flower shelf. It can't be undone.</p>
          <label class="sp-field"><span>Your password</span><input v-model="del.password" class="sp-input" type="password" autocomplete="current-password" data-testid="delete-password" /></label>
          <label class="sp-field"><span>Type DELETE to confirm</span><input v-model="del.typed" class="sp-input" autocomplete="off" data-testid="delete-typed" /></label>
          <p v-if="del.error" class="sp-field-msg" role="alert">{{ del.error }}</p>
          <div class="d-flex gap-2 justify-content-end flex-wrap">
            <button type="button" class="sp-btn sp-btn-ghost" :disabled="del.busy" @click="del.open = false">Keep my account</button>
            <button type="submit" class="sp-btn" :disabled="!canDelete || del.busy" data-testid="delete-confirm">{{ del.busy ? 'Deleting…' : 'Delete forever' }}</button>
          </div>
        </form>
      </div>
    </Teleport>

    <div class="profile-main d-flex flex-column gap-2">
      <p v-if="loadError" class="text-danger m-0" role="alert">{{ loadError }}</p>
      <FlowerShelf :subjects="garden.housedSubjects" :unlocked="!!auth.profile?.shelf_unlocked" :coins="auth.profile?.coins ?? 0"
        :unlocking="unlocking" :new-id="newId" @unlock="unlockShelf" />
      <p v-if="unlockError" class="text-danger m-0" role="alert">{{ unlockError }}</p>
    </div>
  </main>
</template>

<style scoped>
.profile-page {
  padding-bottom: calc(var(--dock-h) + 48px) !important;
  display: grid; grid-template-columns: minmax(260px, 340px) minmax(0, 1fr); gap: 24px; align-items: start;
  max-width: 1400px; margin: 0 auto; padding: 24px 16px 40px;
}
.eyebrow { color: var(--bark-muted); }
.stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.stat {
  display: flex; flex-direction: column; gap: 2px; padding: 14px 16px;
  background: var(--paper); border: 2px solid var(--linen); border-radius: 14px; box-shadow: 0 4px 0 var(--bark);
}
/* account & settings */
.settings { display: grid; gap: 10px; padding: 18px; border-radius: 22px; background: var(--sheet); box-shadow: var(--shadow-2); }
.settings-title { font-size: 1.3rem; margin: 0; }
.setting { border-radius: 14px; background: #fff; border: 1.5px solid var(--line); padding: 10px 12px; }
.setting-row { display: flex; align-items: center; gap: 10px; }
.setting-row b { display: block; font-weight: 800; font-size: .95rem; }
.setting-row small { display: block; color: var(--ink-soft); font-size: .78rem; line-height: 1.3; }
.setting-ic { width: 34px; height: 34px; flex: none; display: grid; place-items: center; border-radius: 10px; background: var(--sheet-2); font-size: 1.05rem; }
.setting.danger { border-color: color-mix(in srgb, var(--berry) 45%, var(--line)); background: color-mix(in srgb, var(--berry-soft) 45%, #fff); }
.setting.danger b { color: var(--berry-deep); }
.setting-form { display: grid; gap: 10px; margin-top: 12px; padding-top: 12px; border-top: 1.5px dashed var(--line); }
.setting-form .sp-field span, .del-sheet .sp-field span { font-weight: 800; font-size: .78rem; color: var(--ink-soft); }
.setting-ok { margin: 8px 0 0; font-weight: 700; font-size: .85rem; color: var(--leaf-deep); }
.del-backdrop { position: fixed; inset: 0; z-index: 1080; display: grid; place-items: center; padding: 16px; background: rgba(46, 34, 28, .42); backdrop-filter: blur(4px); }
.del-sheet { position: relative; width: min(460px, 100%); display: grid; gap: 12px; padding: 30px 24px 22px; border-radius: 24px; background: var(--sheet); box-shadow: var(--shadow-2); animation: sheet-in .45s var(--spring); }
.del-sheet h2 { font-size: 1.6rem; margin: 0; }
.del-sheet .sp-tape { top: -10px; left: calc(50% - 46px); transform: rotate(-3deg); }
@keyframes sheet-in { from { transform: translateY(24px) scale(.96); opacity: 0; } }

@media (max-width: 767.98px) {
  .profile-page { grid-template-columns: 1fr; }
}
</style>
