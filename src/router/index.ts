import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/album',
    },
    {
      path: '/auth',
      name: 'auth',
      component: () => import('@/views/AuthView.vue'),
      meta: { requiresGuest: true },
    },
    {
      path: '/auth/callback',
      name: 'auth-callback',
      component: () => import('@/views/AuthCallbackView.vue'),
    },
    {
      path: '/onboarding',
      name: 'onboarding',
      component: () => import('@/views/OnboardingView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/album',
      name: 'album',
      component: () => import('@/views/AlbumView.vue'),
      meta: { requiresAuth: true, requiresOnboarded: true },
    },
  ],
})

// Guard global para proteger rutas
router.beforeEach(async (to) => {
  const { user, profile, loading, init } = useAuth()

  // Asegurar que useAuth esté inicializado
  await init()

  // Esperar a que termine de cargar la sesión
  if (loading.value) {
    // Pequeño retry mecanism (la sesión puede tardar unos ms en hidratarse)
    await new Promise((r) => setTimeout(r, 100))
  }

  const isAuth = !!user.value
  const isOnboarded = !!profile.value?.onboarded

  // Ruta requiere auth pero no hay sesión → mandar a login
  if (to.meta.requiresAuth && !isAuth) {
    return { name: 'auth' }
  }

  // Ruta requiere onboarding pero no está onboarded → mandar a onboarding
  if (to.meta.requiresOnboarded && isAuth && !isOnboarded) {
    return { name: 'onboarding' }
  }

  // Si está autenticado y onboarded, no debería ir a /auth ni /onboarding
  if (to.meta.requiresGuest && isAuth) {
    return { name: 'album' }
  }

  // Si está en onboarding pero ya está onboarded → mandar al álbum
  if (to.name === 'onboarding' && isOnboarded) {
    return { name: 'album' }
  }
})

export default router
