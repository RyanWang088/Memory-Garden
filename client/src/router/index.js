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
      { path: 'seeds/:id', name: 'seed-review', component: () => import('@/views/SeedReviewView.vue'), meta: { showNav: false } },
    ],
  },
  { path: '/review/:id/structured-quiz', name: 'structured-quiz', component: () => import('@/views/StructuredQuizView.vue'), meta: { requiresAuth: true } },
  { path: '/review/:id/flexible-deck', name: 'flexible-deck', component: () => import('@/views/FlexibleDeckView.vue'), meta: { requiresAuth: true } },
  { path: '/planner', name: 'planner', component: () => import('@/views/PlannerView.vue'), meta: { requiresAuth: true, showNav: true } },
  { path: '/profile', name: 'profile', component: () => import('@/views/ProfileView.vue'), meta: { requiresAuth: true, showNav: true } },
  { path: '/pomodoro', name: 'pomodoro', component: () => import('@/views/PomodoroView.vue'), meta: { requiresAuth: true, showNav: true } },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({ history: createWebHistory(), routes })

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  await auth.init() // restores session once; no-op afterwards

  if (to.meta.requiresAuth && !auth.user) return { name: 'auth' }

  if (auth.user) {
    // New users must finish onboarding first
    if (!auth.profile?.onboarded && to.name !== 'onboarding') return { name: 'onboarding' }
    // Returning users skip landing / auth / onboarding
    if (auth.profile?.onboarded && ['landing', 'auth', 'onboarding'].includes(to.name)) return { name: 'garden' }
  }
})

export default router
