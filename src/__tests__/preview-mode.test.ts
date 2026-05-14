import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref, computed, readonly, nextTick } from 'vue';
import { createRouter, createMemoryHistory } from 'vue-router';
import type { StickerState } from '@/composables/useStickers';

// ── Mock setup ──

const mockUser = ref<Record<string, unknown> | null>(null);
const mockProfile = ref<Record<string, unknown> | null>(null);

vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({
    user: readonly(mockUser),
    profile: readonly(mockProfile),
    loading: ref(false),
    isAuthenticated: computed(() => !!mockUser.value),
    needsOnboarding: computed(
      () =>
        !!mockUser.value &&
        !!mockProfile.value &&
        !(mockProfile.value as Record<string, unknown>).onboarded,
    ),
    init: vi.fn().mockResolvedValue(undefined),
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
    updateProfile: vi.fn(),
  }),
}));

vi.mock('@/composables/useStickers', () => ({
  useStickers: () => ({
    stickers: computed(() => ({})),
    loading: ref(false),
    loaded: ref(true),
    syncError: ref(null),
    sessionDead: ref(false),
    pendingOps: ref(new Map()),
    pendingCount: computed(() => 0),
    failedCount: computed(() => 0),
    stats: computed(() => ({ owned: 0, missing: 980, dupes: 0, pct: 0, withNotes: 0 })),
    getSticker: (_n: number): StickerState => ({ owned: false, dupes: 0, note: '' }),
    getStickerSyncStatus: () => null,
    retryAllPending: vi.fn(),
    discardAllPending: vi.fn(),
    discardOne: vi.fn(),
    cycleSticker: vi.fn(),
    decrementSticker: vi.fn(),
    markSectionComplete: vi.fn(),
    clearSection: vi.fn(),
    adjustDupes: vi.fn(),
    removeSticker: vi.fn(),
    setNote: vi.fn(),
    addBatch: vi.fn(),
    setSticker: vi.fn(),
  }),
}));

vi.mock('@/composables/useShare', () => ({
  useShare: () => ({
    shareUrl: ref(''),
    sharing: ref(false),
    share: vi.fn(),
  }),
}));

vi.mock('@/composables/useMeta', () => ({
  useMeta: vi.fn(),
}));

vi.mock('@/composables/useUndo', () => ({
  useUndo: () => ({
    pushUndo: vi.fn(),
  }),
}));

vi.mock('@/assets/ball-stadium.png', () => ({ default: 'ball.png' }));
vi.mock('@/assets/ball-crest.jpg', () => ({ default: 'crest.jpg' }));
vi.mock('@/assets/field-squad.jpg', () => ({ default: 'squad.jpg' }));

beforeEach(() => {
  mockUser.value = null;
  mockProfile.value = null;
});

// ── Router tests ──

describe('Preview mode: Router', () => {
  function createTestRouter() {
    return createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', redirect: '/album' },
        {
          path: '/auth',
          name: 'auth',
          component: { template: '<div>Auth</div>' },
          meta: { requiresGuest: true },
        },
        {
          path: '/onboarding',
          name: 'onboarding',
          component: { template: '<div>Onboarding</div>' },
          meta: { requiresAuth: true },
        },
        {
          path: '/album',
          name: 'album',
          component: { template: '<div>Album</div>' },
          meta: { requiresOnboarded: true },
        },
      ],
    });
  }

  async function setupRouterGuard(router: ReturnType<typeof createTestRouter>) {
    const { useAuth } = await import('@/composables/useAuth');

    router.beforeEach(async (to) => {
      const { user, profile, init } = useAuth();
      await init();

      const isAuth = !!user.value;
      const isOnboarded = !!(profile.value as Record<string, unknown> | null)?.onboarded;

      if (to.meta.isPublic) return true;
      if (to.meta.requiresAuth && !isAuth) return { name: 'auth' };
      if (to.meta.requiresOnboarded && isAuth && !isOnboarded) return { name: 'onboarding' };
      if (to.meta.requiresGuest && isAuth) return { name: 'album' };
      if (to.name === 'onboarding' && isOnboarded) return { name: 'album' };
    });
  }

  it('unauthenticated user can access /album (not redirected to /auth)', async () => {
    mockUser.value = null;
    mockProfile.value = null;

    const router = createTestRouter();
    await setupRouterGuard(router);
    await router.push('/album');
    await router.isReady();

    expect(router.currentRoute.value.path).toBe('/album');
  });

  it('unauthenticated user accessing /album does not get redirected to onboarding', async () => {
    mockUser.value = null;
    mockProfile.value = null;

    const router = createTestRouter();
    await setupRouterGuard(router);
    await router.push('/album');
    await router.isReady();

    expect(router.currentRoute.value.path).toBe('/album');
    expect(router.currentRoute.value.name).toBe('album');
  });

  it('authenticated user without onboarding is redirected to /onboarding', async () => {
    mockUser.value = { id: 'user-1' };
    mockProfile.value = { id: 'user-1', onboarded: false };

    const router = createTestRouter();
    await setupRouterGuard(router);
    await router.push('/album');
    await router.isReady();

    expect(router.currentRoute.value.name).toBe('onboarding');
  });

  it('authenticated onboarded user stays on /album', async () => {
    mockUser.value = { id: 'user-1' };
    mockProfile.value = { id: 'user-1', onboarded: true };

    const router = createTestRouter();
    await setupRouterGuard(router);
    await router.push('/album');
    await router.isReady();

    expect(router.currentRoute.value.path).toBe('/album');
  });
});

// ── AuthView preview button ──

describe('Preview mode: AuthView', () => {
  it('renders "Explorar el album sin cuenta" link pointing to /album', async () => {
    const AuthView = (await import('@/views/AuthView.vue')).default;
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/auth', component: AuthView },
        { path: '/album', component: { template: '<div/>' } },
      ],
    });
    await router.push('/auth');
    await router.isReady();

    const w = mount(AuthView, {
      global: { plugins: [router] },
    });

    const previewBtn = w.find('.preview-btn');
    expect(previewBtn.exists()).toBe(true);
    expect(previewBtn.text()).toContain('Explorar el álbum sin cuenta');
    expect(previewBtn.attributes('href')).toBe('/album');
  });
});

// ── CalculadoraView preview mode ──

describe('Preview mode: CalculadoraView', () => {
  it('ownedInput and dupesInput start at 0 when no user (preview)', async () => {
    const CalculadoraView = (await import('@/components/CalculadoraView.vue')).default;

    const w = mount(CalculadoraView, {
      global: {
        provide: {
          isPreview: computed(() => true),
        },
      },
    });

    const inputs = w.findAll('.calc-estado-num');
    expect(inputs).toHaveLength(2);

    // "Laminas que tengo" input
    const ownedInput = inputs[0].element as HTMLInputElement;
    expect(Number(ownedInput.value)).toBe(0);

    // "Repetidas" input
    const dupesInput = inputs[1].element as HTMLInputElement;
    expect(Number(dupesInput.value)).toBe(0);
  });

  it('inputs are editable and calculations update', async () => {
    const CalculadoraView = (await import('@/components/CalculadoraView.vue')).default;

    const w = mount(CalculadoraView, {
      global: {
        provide: {
          isPreview: computed(() => true),
        },
      },
    });

    const inputs = w.findAll('.calc-estado-num');
    const ownedInput = inputs[0];
    const dupesInput = inputs[1];

    await ownedInput.setValue(200);
    await nextTick();

    // Status should reflect the new value
    expect(w.find('.calc-status-num').text()).toBe('200');
    expect(w.text()).toContain('780'); // 980 - 200 = 780 missing

    await dupesInput.setValue(50);
    await nextTick();

    // The component should use the new dupes value in calculations
    // (we just confirm it accepted the input without errors)
    expect((dupesInput.element as HTMLInputElement).value).toBe('50');
  });
});

// ── SectionView preview mode ──

describe('Preview mode: SectionView', () => {
  it('emits openDetail instead of cycling when isPreview is true', async () => {
    const SectionView = (await import('@/components/SectionView.vue')).default;
    const { ALBUM_SECTIONS } = await import('@/lib/albumData');
    const section = ALBUM_SECTIONS.find((s) => s.isTeam)!;

    const w = mount(SectionView, {
      props: { section },
      global: {
        provide: {
          isPreview: computed(() => true),
        },
      },
    });

    // StickerCard emits 'cycle' -> SectionView redirects to 'openDetail' in preview
    const firstCard = w.findAllComponents({ name: 'StickerCard' })[0];
    firstCard.vm.$emit('cycle');

    expect(w.emitted('openDetail')).toHaveLength(1);
    expect(w.emitted('openDetail')![0]).toEqual([section.startsAt]);
  });

  it('hides section action buttons (Complete/Clear) when isPreview is true', async () => {
    const SectionView = (await import('@/components/SectionView.vue')).default;
    const { ALBUM_SECTIONS } = await import('@/lib/albumData');
    const section = ALBUM_SECTIONS.find((s) => s.isTeam)!;

    const w = mount(SectionView, {
      props: { section },
      global: {
        provide: {
          isPreview: computed(() => true),
        },
      },
    });

    expect(w.find('.sect-actions').exists()).toBe(false);
    expect(w.find('.complete-btn').exists()).toBe(false);
  });
});
