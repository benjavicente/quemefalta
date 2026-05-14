import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref, readonly, computed } from 'vue';
import * as mockSupabase from '../mocks/supabase';
import { createProfile } from '../mocks/factories';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let AlbumView: any;

const mockProfile = createProfile({ username: 'tony', onboarded: true });

beforeEach(async () => {
  vi.resetModules();
  mockSupabase.resetSupabaseMock();

  vi.doMock('@/lib/supabase', () => mockSupabase);

  vi.doMock('@/composables/useAuth', () => ({
    useAuth: () => ({
      user: ref({ id: 'user-1' }),
      profile: ref(mockProfile),
      loading: ref(false),
      isAuthenticated: computed(() => true),
      needsOnboarding: computed(() => false),
      init: vi.fn(),
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
      updateProfile: vi.fn(),
    }),
  }));

  vi.doMock('@/composables/useStickers', () => ({
    useStickers: () => ({
      stickers: readonly(ref({})),
      loading: ref(false),
      loaded: ref(true),
      syncError: ref(null),
      sessionDead: mockSupabase.sessionDead,
      pendingOps: ref(new Map()),
      pendingCount: computed(() => 0),
      failedCount: computed(() => 0),
      stats: computed(() => ({ owned: 0, missing: 980, dupes: 0, withNotes: 0, pct: 0 })),
      getSticker: () => ({ owned: false, dupes: 0, note: '' }),
      getStickerSyncStatus: () => null,
      retryAllPending: vi.fn(),
      discardAllPending: vi.fn(),
      discardOne: vi.fn(),
      cycleSticker: vi.fn(),
      adjustDupes: vi.fn(),
      removeSticker: vi.fn(),
      markSectionComplete: vi.fn(),
      clearSection: vi.fn(),
      setNote: vi.fn(),
      addBatch: vi.fn(),
      decrementSticker: vi.fn(),
    }),
  }));

  vi.doMock('vue-router', () => ({
    useRoute: () => ({ hash: '', params: {} }),
    useRouter: () => ({ replace: vi.fn() }),
  }));

  const mod = await import('@/views/AlbumView.vue');
  AlbumView = mod.default;
});

describe('Session Dead Modal', () => {
  it('does not show modal when session is alive', () => {
    const wrapper = mount(AlbumView, {
      global: {
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
          SectionView: true,
          StickerDetailModal: true,
          ShareModal: true,
        },
      },
    });

    expect(wrapper.find('.dead-bg').exists()).toBe(false);
  });

  it('shows modal when sessionDead becomes true', async () => {
    const wrapper = mount(AlbumView, {
      global: {
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
          SectionView: true,
          StickerDetailModal: true,
          ShareModal: true,
        },
      },
    });

    expect(wrapper.find('.dead-bg').exists()).toBe(false);

    // Simulate session dying
    mockSupabase.setSessionDead(true);
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.dead-bg').exists()).toBe(true);
    expect(wrapper.find('.dead-title').text()).toBe('SESIÓN EXPIRADA');
    const buttons = wrapper.findAll('.dead-btn');
    expect(buttons[0].text()).toBe('Reintentar');
    expect(buttons[buttons.length - 1].text()).toBe('Recargar página');
  });

  it('shows sync error banner for non-fatal errors when session is alive', async () => {
    // Re-mock with a syncError
    vi.resetModules();
    mockSupabase.resetSupabaseMock();

    vi.doMock('@/lib/supabase', () => mockSupabase);
    vi.doMock('@/composables/useAuth', () => ({
      useAuth: () => ({
        user: ref({ id: 'user-1' }),
        profile: ref(mockProfile),
        loading: ref(false),
        isAuthenticated: computed(() => true),
        needsOnboarding: computed(() => false),
        init: vi.fn(),
        signInWithGoogle: vi.fn(),
        signOut: vi.fn(),
        updateProfile: vi.fn(),
      }),
    }));
    vi.doMock('@/composables/useStickers', () => ({
      useStickers: () => ({
        stickers: readonly(ref({})),
        loading: ref(false),
        loaded: ref(true),
        syncError: ref('Network error'),
        sessionDead: mockSupabase.sessionDead,
        stats: computed(() => ({ owned: 0, missing: 980, dupes: 0, withNotes: 0, pct: 0 })),
        getSticker: () => ({ owned: false, dupes: 0, note: '' }),
        cycleSticker: vi.fn(),
        adjustDupes: vi.fn(),
        removeSticker: vi.fn(),
        markSectionComplete: vi.fn(),
        clearSection: vi.fn(),
        setNote: vi.fn(),
      }),
    }));
    vi.doMock('vue-router', () => ({
      useRoute: () => ({ hash: '', params: {} }),
      useRouter: () => ({ replace: vi.fn() }),
    }));

    const mod = await import('@/views/AlbumView.vue');
    const wrapper = mount(mod.default, {
      global: {
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
          SectionView: true,
          StickerDetailModal: true,
          ShareModal: true,
        },
      },
    });

    expect(wrapper.find('.sync-error').exists()).toBe(true);
    expect(wrapper.find('.sync-error').text()).toContain('Network error');
    expect(wrapper.find('.dead-bg').exists()).toBe(false);
  });
});
