import { createRouter, createWebHistory } from 'vue-router';
import { useAuth } from '@/composables/useAuth';

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
    {
      path: '/u/:username',
      name: 'public-profile',
      component: () => import('@/views/PublicProfileView.vue'),
      meta: { isPublic: true },
    },
  ],
});

router.beforeEach(async (to) => {
  const { user, profile, init } = useAuth();

  // Esperar a que init termine completamente (session + profile cargados)
  await init();

  const isAuth = !!user.value;
  const isOnboarded = !!profile.value?.onboarded;

  // Rutas públicas: pasar siempre, no importa si está logueado o no
  if (to.meta.isPublic) {
    return true;
  }

  if (to.meta.requiresAuth && !isAuth) {
    return { name: 'auth' };
  }

  if (to.meta.requiresOnboarded && isAuth && !isOnboarded) {
    return { name: 'onboarding' };
  }

  if (to.meta.requiresGuest && isAuth) {
    return { name: 'album' };
  }

  if (to.name === 'onboarding' && isOnboarded) {
    return { name: 'album' };
  }
});

export default router;
