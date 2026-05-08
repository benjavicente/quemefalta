import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as mockSupabase from '../mocks/supabase';
import { createUser, createSession, createProfile } from '../mocks/factories';

const { supabase, ensureFreshSession, setQueryResult, resetSupabaseMock } = mockSupabase;

// Because useAuth is a singleton with module-level refs, we must
// reset modules before each test to get fresh state.
let useAuth: typeof import('@/composables/useAuth').useAuth;

beforeEach(async () => {
  vi.resetModules();
  resetSupabaseMock();

  // Re-register the supabase mock after resetModules clears it
  vi.doMock('@/lib/supabase', () => mockSupabase);

  // Re-import to get fresh singleton state
  const mod = await import('@/composables/useAuth');
  useAuth = mod.useAuth;
});

describe('useAuth', () => {
  describe('init()', () => {
    it('loads user and profile when session exists', async () => {
      const mockUser = createUser();
      const mockSession = createSession({ user: mockUser });
      const mockProfile = createProfile();

      supabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      setQueryResult({ data: mockProfile, error: null });

      const { init, user, profile, loading } = useAuth();
      await init();

      expect(user.value).toEqual(mockUser);
      expect(profile.value).toEqual(mockProfile);
      expect(loading.value).toBe(false);
    });

    it('stays null when no session exists', async () => {
      supabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const { init, user, profile, loading } = useAuth();
      await init();

      expect(user.value).toBeNull();
      expect(profile.value).toBeNull();
      expect(loading.value).toBe(false);
    });

    it('is idempotent — calling twice returns same promise', async () => {
      supabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const { init } = useAuth();
      const p1 = init();
      const p2 = init();

      expect(p1).toBe(p2);
      await p1;
      expect(supabase.auth.getSession).toHaveBeenCalledTimes(1);
    });
  });

  describe('signInWithGoogle()', () => {
    it('calls signInWithOAuth with google provider', async () => {
      const { signInWithGoogle } = useAuth();
      await signInWithGoogle();

      expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: {
          redirectTo: expect.stringContaining('/auth/callback'),
        },
      });
    });

    it('throws when supabase returns an error', async () => {
      const authError = { message: 'OAuth failed', status: 500 };
      supabase.auth.signInWithOAuth.mockResolvedValue({ error: authError });

      const { signInWithGoogle } = useAuth();
      await expect(signInWithGoogle()).rejects.toEqual(authError);
    });
  });

  describe('signOut()', () => {
    it('clears user and profile', async () => {
      // Set up an authenticated state first
      const mockUser = createUser();
      const mockSession = createSession({ user: mockUser });
      supabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });
      setQueryResult({ data: createProfile(), error: null });

      const { init, signOut, user, profile } = useAuth();
      await init();
      expect(user.value).not.toBeNull();

      await signOut();

      expect(user.value).toBeNull();
      expect(profile.value).toBeNull();
      expect(supabase.auth.signOut).toHaveBeenCalled();
    });

    it('clears state even when signOut throws', async () => {
      supabase.auth.signOut.mockRejectedValue(new Error('Network error'));

      const { signOut, user, profile } = useAuth();
      await signOut();

      expect(user.value).toBeNull();
      expect(profile.value).toBeNull();
    });
  });

  describe('updateProfile()', () => {
    it('calls ensureFreshSession and updates profile', async () => {
      // Set up authenticated state
      const mockUser = createUser();
      const mockSession = createSession({ user: mockUser });
      supabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });
      setQueryResult({ data: createProfile(), error: null });

      const { init, updateProfile, profile } = useAuth();
      await init();

      // Now mock the update response
      const updatedProfile = createProfile({ username: 'newname' });
      setQueryResult({ data: updatedProfile, error: null });

      await updateProfile({ username: 'newname' });

      expect(ensureFreshSession).toHaveBeenCalled();
      expect(profile.value?.username).toBe('newname');
    });

    it('throws when not authenticated', async () => {
      const { updateProfile } = useAuth();
      await expect(updateProfile({ username: 'test' })).rejects.toThrow('Not authenticated');
    });

    it('throws when supabase returns an error', async () => {
      // Set up authenticated state
      const mockUser = createUser();
      const mockSession = createSession({ user: mockUser });
      supabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });
      setQueryResult({ data: createProfile(), error: null });

      const { init, updateProfile } = useAuth();
      await init();

      // Mock error on update
      setQueryResult({
        data: null,
        error: { code: '23505', message: 'duplicate' },
      });

      await expect(updateProfile({ username: 'taken' })).rejects.toEqual({
        code: '23505',
        message: 'duplicate',
      });
    });
  });

  describe('computed properties', () => {
    it('isAuthenticated reflects user state', async () => {
      const { init, isAuthenticated } = useAuth();

      supabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });
      await init();

      expect(isAuthenticated.value).toBe(false);
    });

    it('isAuthenticated is true when user exists', async () => {
      const mockSession = createSession();
      supabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });
      setQueryResult({ data: createProfile(), error: null });

      const { init, isAuthenticated } = useAuth();
      await init();

      expect(isAuthenticated.value).toBe(true);
    });

    it('needsOnboarding is true when user exists but not onboarded', async () => {
      const mockSession = createSession();
      supabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });
      setQueryResult({
        data: createProfile({ onboarded: false }),
        error: null,
      });

      const { init, needsOnboarding } = useAuth();
      await init();

      expect(needsOnboarding.value).toBe(true);
    });

    it('needsOnboarding is false when onboarded', async () => {
      const mockSession = createSession();
      supabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });
      setQueryResult({
        data: createProfile({ onboarded: true }),
        error: null,
      });

      const { init, needsOnboarding } = useAuth();
      await init();

      expect(needsOnboarding.value).toBe(false);
    });
  });

  describe('onAuthStateChange', () => {
    it('ignores INITIAL_SESSION events', async () => {
      supabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const { init, user } = useAuth();
      await init();

      // Get the callback registered with onAuthStateChange
      const callback = supabase.auth.onAuthStateChange.mock.calls[0][0];

      // Fire INITIAL_SESSION — should be ignored
      await callback('INITIAL_SESSION', createSession());
      expect(user.value).toBeNull();
    });

    it('sets user on SIGNED_IN event', async () => {
      supabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const { init, user } = useAuth();
      await init();

      const callback = supabase.auth.onAuthStateChange.mock.calls[0][0];
      const mockSession = createSession();
      setQueryResult({ data: createProfile(), error: null });

      await callback('SIGNED_IN', mockSession);

      expect(user.value).toEqual(mockSession.user);
    });

    it('clears user on SIGNED_OUT event', async () => {
      // Start authenticated
      const mockSession = createSession();
      supabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });
      setQueryResult({ data: createProfile(), error: null });

      const { init, user, profile } = useAuth();
      await init();
      expect(user.value).not.toBeNull();

      const callback = supabase.auth.onAuthStateChange.mock.calls[0][0];
      await callback('SIGNED_OUT', null);

      expect(user.value).toBeNull();
      expect(profile.value).toBeNull();
    });
  });

  describe('loadProfile error handling', () => {
    it('sets profile to null on query error', async () => {
      const mockSession = createSession();
      supabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });
      setQueryResult({
        data: null,
        error: { message: 'Not found' },
      });

      const { init, profile, user } = useAuth();
      await init();

      expect(user.value).not.toBeNull();
      expect(profile.value).toBeNull();
    });
  });
});
