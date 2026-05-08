import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import OnboardingView from '@/views/OnboardingView.vue';
import { createProfile } from '../mocks/factories';

const mockUpdateProfile = vi.fn();
const mockPush = vi.fn();
const mockReplace = vi.fn();

vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({
    profile: { value: createProfile({ display_name: 'Pedro Gómez' }) },
    updateProfile: mockUpdateProfile,
    user: { value: { id: 'user-123' } },
    loading: { value: false },
    isAuthenticated: { value: true },
    needsOnboarding: { value: true },
    init: vi.fn(),
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useRoute: () => ({ params: {}, meta: {} }),
}));

beforeEach(() => {
  mockUpdateProfile.mockClear();
  mockUpdateProfile.mockResolvedValue({});
  mockPush.mockClear();
  mockReplace.mockClear();
});

describe('OnboardingView', () => {
  it('renders greeting with first name', () => {
    const w = mount(OnboardingView);
    expect(w.text()).toContain('PEDRO');
  });

  it('shows URL preview with typed username', async () => {
    const w = mount(OnboardingView);
    const input = w.find('input');

    await input.setValue('miuser');

    expect(w.find('.url-preview').text()).toContain('miuser');
  });

  it('shows placeholder when no username typed', () => {
    const w = mount(OnboardingView);
    expect(w.find('.url-preview').text()).toContain('tu_username');
  });

  describe('validation', () => {
    it('rejects username shorter than 3 chars', async () => {
      const w = mount(OnboardingView);
      await w.find('input').setValue('ab');
      await w.find('.btn-solid').trigger('click');
      await flushPromises();

      expect(w.find('.error').exists()).toBe(true);
      expect(mockUpdateProfile).not.toHaveBeenCalled();
    });

    it('accepts uppercase by lowercasing automatically', async () => {
      const w = mount(OnboardingView);
      await w.find('input').setValue('MyUser');
      await w.find('.btn-solid').trigger('click');
      await flushPromises();

      // Uppercase is normalized to lowercase before validation
      expect(mockUpdateProfile).toHaveBeenCalledWith({
        username: 'myuser',
        onboarded: true,
      });
    });

    it('rejects username with special chars', async () => {
      const w = mount(OnboardingView);
      await w.find('input').setValue('user@name');
      await w.find('.btn-solid').trigger('click');
      await flushPromises();

      expect(w.find('.error').exists()).toBe(true);
    });

    it('accepts valid username', async () => {
      const w = mount(OnboardingView);
      await w.find('input').setValue('pedro_42');
      await w.find('.btn-solid').trigger('click');
      await flushPromises();

      expect(mockUpdateProfile).toHaveBeenCalledWith({
        username: 'pedro_42',
        onboarded: true,
      });
    });
  });

  describe('submission', () => {
    it('navigates to /album on success', async () => {
      const w = mount(OnboardingView);
      await w.find('input').setValue('validuser');
      await w.find('.btn-solid').trigger('click');
      await flushPromises();

      expect(mockReplace).toHaveBeenCalledWith('/album');
    });

    it('shows duplicate error on code 23505', async () => {
      mockUpdateProfile.mockRejectedValue({
        code: '23505',
        message: 'duplicate',
      });

      const w = mount(OnboardingView);
      await w.find('input').setValue('takenuser');
      await w.find('.btn-solid').trigger('click');
      await flushPromises();

      expect(w.find('.error').text()).toContain('ya está tomado');
    });

    it('shows generic error for other failures', async () => {
      mockUpdateProfile.mockRejectedValue({
        message: 'Server error',
      });

      const w = mount(OnboardingView);
      await w.find('input').setValue('validuser');
      await w.find('.btn-solid').trigger('click');
      await flushPromises();

      expect(w.find('.error').text()).toBe('Server error');
    });

    it('shows button as disabled while saving', async () => {
      // Make updateProfile hang
      mockUpdateProfile.mockReturnValue(new Promise(() => {}));

      const w = mount(OnboardingView);
      await w.find('input').setValue('validuser');
      await w.find('.btn-solid').trigger('click');
      await flushPromises();

      expect(w.find('.btn-solid').attributes('disabled')).toBeDefined();
      expect(w.find('.btn-solid').text()).toContain('GUARDANDO');
    });
  });
});
