import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import AuthView from '@/views/AuthView.vue';

const mockSignInWithGoogle = vi.fn();

vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({
    signInWithGoogle: mockSignInWithGoogle,
    user: { value: null },
    profile: { value: null },
    loading: { value: false },
    isAuthenticated: { value: false },
    needsOnboarding: { value: false },
    init: vi.fn(),
    signOut: vi.fn(),
    updateProfile: vi.fn(),
  }),
}));

beforeEach(() => {
  mockSignInWithGoogle.mockClear();
  mockSignInWithGoogle.mockResolvedValue(undefined);
});

describe('AuthView', () => {
  it('renders Google login button', () => {
    const w = mount(AuthView);
    const btn = w.find('.google-btn');
    expect(btn.exists()).toBe(true);
    expect(btn.text()).toContain('Continuar con Google');
  });

  it('calls signInWithGoogle on button click', async () => {
    const w = mount(AuthView);
    await w.find('.google-btn').trigger('click');
    await flushPromises();

    expect(mockSignInWithGoogle).toHaveBeenCalledOnce();
  });

  it('shows loading text while redirecting', async () => {
    // Make signInWithGoogle hang (simulate redirect pending)
    mockSignInWithGoogle.mockReturnValue(new Promise(() => {}));

    const w = mount(AuthView);
    await w.find('.google-btn').trigger('click');
    await flushPromises();

    expect(w.find('.google-btn').text()).toContain('Redirigiendo a Google...');
    expect(w.find('.google-btn').attributes('disabled')).toBeDefined();
  });

  it('shows error message when signInWithGoogle fails', async () => {
    mockSignInWithGoogle.mockRejectedValue(new Error('OAuth blocked'));

    const w = mount(AuthView);
    await w.find('.google-btn').trigger('click');
    await flushPromises();

    expect(w.find('.error').text()).toBe('OAuth blocked');
    // Button should be re-enabled after error
    expect(w.find('.google-btn').text()).toContain('Continuar con Google');
  });

  it('shows generic error for non-Error rejections', async () => {
    mockSignInWithGoogle.mockRejectedValue('unknown');

    const w = mount(AuthView);
    await w.find('.google-btn').trigger('click');
    await flushPromises();

    expect(w.find('.error').text()).toBe('Error al iniciar sesión');
  });
});
