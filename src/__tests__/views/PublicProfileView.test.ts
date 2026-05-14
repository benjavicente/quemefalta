/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { ref, computed } from 'vue';
import * as mockSupabase from '../mocks/supabase';
import { createUser } from '../mocks/factories';

const { setQueryResult, setQueryResultForTable, resetSupabaseMock } = mockSupabase;

// Helper: setea el resultado del fetch del profile (public_album_stats) y el
// de stickers (public_user_stickers) en una sola llamada. La vista hace ambas
// queries en serie y necesita shape distinto para cada una.
function setProfileAndStickers(profile: any, stickers: any[] = []) {
  setQueryResultForTable('public_album_stats', { data: profile, error: null });
  setQueryResultForTable('public_user_stickers', { data: stickers, error: null });
}

const mockPush = vi.fn();
const mockUserRef = ref<any>(null);

let PublicProfileView: any;

beforeEach(async () => {
  vi.resetModules();
  resetSupabaseMock();
  mockPush.mockClear();
  mockUserRef.value = null;

  vi.doMock('@/lib/supabase', () => mockSupabase);
  vi.doMock('@/composables/useAuth', () => ({
    useAuth: () => ({
      user: mockUserRef,
      profile: ref(null),
      loading: ref(false),
      isAuthenticated: computed(() => !!mockUserRef.value),
      needsOnboarding: computed(() => false),
      init: vi.fn(),
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
      updateProfile: vi.fn(),
    }),
  }));
  vi.doMock('vue-router', () => ({
    useRouter: () => ({ push: mockPush }),
    useRoute: () => ({ params: { username: 'pedro42' } }),
  }));

  const mod = await import('@/views/PublicProfileView.vue');
  PublicProfileView = mod.default;
});

describe('PublicProfileView', () => {
  it('shows loading state initially', () => {
    setQueryResult({ data: null, error: null });
    const w = mount(PublicProfileView);
    expect(w.text()).toContain('Cargando perfil');
  });

  it('renders profile card when data is found', async () => {
    setProfileAndStickers({
      id: 'other-user',
      username: 'pedro42',
      display_name: 'Pedro García',
      avatar_url: 'https://example.com/avatar.jpg',
      owned_count: 200,
      dupes_count: 15,
    });

    const w = mount(PublicProfileView);
    await flushPromises();

    expect(w.text()).toContain('PEDRO GARCÍA');
    expect(w.text()).toContain('@pedro42');
    expect(w.text()).toContain('200');
    expect(w.find('.loading-state').exists()).toBe(false);
  });

  it('shows "Perfil no encontrado" when data is null', async () => {
    setQueryResult({ data: null, error: null });

    const w = mount(PublicProfileView);
    await flushPromises();

    expect(w.text()).toContain('Perfil no encontrado');
  });

  it('shows "Perfil no encontrado" on error', async () => {
    setQueryResult({ data: null, error: { message: 'Server error' } });

    const w = mount(PublicProfileView);
    await flushPromises();

    expect(w.text()).toContain('Perfil no encontrado');
  });

  it('shows "Crear mi cuenta" CTA when not authenticated', async () => {
    mockUserRef.value = null;

    setProfileAndStickers({
      id: 'other-user',
      username: 'pedro42',
      display_name: 'Pedro',
      avatar_url: null,
      owned_count: 100,
      dupes_count: 5,
    });

    const w = mount(PublicProfileView);
    await flushPromises();

    const ctaBtn = w.find('.cta-btn');
    expect(ctaBtn.text()).toContain('Crear mi álbum');
  });

  it('shows "Ver mi álbum" CTA when authenticated but viewing other profile', async () => {
    mockUserRef.value = createUser({ id: 'my-user-id' });

    setProfileAndStickers({
      id: 'other-user',
      username: 'pedro42',
      display_name: 'Pedro',
      avatar_url: null,
      owned_count: 100,
      dupes_count: 5,
    });

    const w = mount(PublicProfileView);
    await flushPromises();

    const ctaBtn = w.find('.cta-btn');
    expect(ctaBtn.text()).toContain('Ver mi álbum');
  });

  it('computes stats correctly', async () => {
    setProfileAndStickers({
      id: 'other-user',
      username: 'pedro42',
      display_name: 'Pedro',
      avatar_url: null,
      owned_count: 490,
      dupes_count: 25,
    });

    const w = mount(PublicProfileView);
    await flushPromises();

    // 490/980 = 50%
    expect(w.find('.big-num').text()).toBe('50');
    expect(w.text()).toContain('490'); // owned
    expect(w.text()).toContain('490'); // missing = 980 - 490 = 490
    expect(w.text()).toContain('25'); // dupes
  });

  it('goToMyAlbum navigates to /auth when not authenticated', async () => {
    mockUserRef.value = null;
    setQueryResult({ data: null, error: null });

    const w = mount(PublicProfileView);
    await flushPromises();

    await w.find('.btn-back').trigger('click');
    expect(mockPush).toHaveBeenCalledWith('/auth');
  });
});
