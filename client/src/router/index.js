import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes = [
  { path: '/', name: 'landing', component: () => import('@/views/LandingView.vue') },
  { path: '/auth', name: 'auth', component: () => import('@/views/AuthView.vue') },
  { path: '/onboarding', name: 'onboarding', component: () => import('@/views/OnboardingView.vue'), meta: { requiresAuth: true } },
  {
    path: '/garden',
    name: 'garden',
    component: () => import('@/views/GardenView.vue'),
    meta: { requiresAuth: true, showNav: true },
    children: [
      { path: 'seeds/new/:col/:row', name: 'seed-create', component: () => import('@/views/SeedCreateView.vue'), meta: { showNav: false } },
      { path: 'seeds/:id/edit', name: 'seed-edit', component: () => import('@/views/SeedEditView.vue'), meta: { showNav: false } },
      { path: 'seeds/:id', name: 'seed-review', component: () => import('@/views/SeedReviewView.vue'), meta: { showNav: false } },
    ],
  },
  { path: '/review/:id/multiple-choice-quiz', name: 'multiple-choice-quiz', component: () => import('@/views/MultipleChoiceQuizView.vue'), meta: { requiresAuth: true } },
  { path: '/review/:id/short-structured', name: 'short-structured', component: () => import('@/views/ShortStructuredView.vue'), meta: { requiresAuth: true } },
  { path: '/review/:id/flashcard', name: 'flashcard', component: () => import('@/views/FlashcardView.vue'), meta: { requiresAuth: true } },
  // Planner: to-do list (left page) + month calendar with exams and reviews due (right page).
  { path: '/planner', name: 'planner', component: () => import('@/views/PlannerView.vue'), meta: { requiresAuth: true, showNav: true } },
  { path: '/journal', redirect: '/planner' },
  { path: '/profile', name: 'profile', component: () => import('@/views/ProfileView.vue'), meta: { requiresAuth: true, showNav: true } },
  { path: '/pomodoro', name: 'pomodoro', component: () => import('@/views/PomodoroView.vue'), meta: { requiresAuth: true, showNav: true } },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({ history: createWebHistory(), routes })

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  await auth.init() // restores session once; no-op afterwards

  if (to.meta.requiresAuth && !auth.user) return { name: 'auth', query: { next: to.fullPath } } // back to that page after logging in

  if (auth.user) {
    // Onboarding is only shown straight after sign-up (AuthView sends new accounts there).
    // Logging in never shows it again, and anyone who has finished it can't reopen it.
    if (to.name === 'onboarding' && auth.profile?.onboarded) return { name: 'garden' }
    // Signed-in users skip the landing and login pages
    if (['landing', 'auth'].includes(to.name)) return { name: 'garden' }
  }
})

export default router
