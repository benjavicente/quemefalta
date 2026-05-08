export const SUPABASE_URL = 'https://zxtnogvmpjgqfoegajgu.supabase.co';

export const TEST_USER = {
  id: 'e2e-user-123',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'e2e@example.com',
  email_confirmed_at: '2025-01-01T00:00:00Z',
  app_metadata: { provider: 'google', providers: ['google'] },
  user_metadata: {
    full_name: 'E2E Test User',
    avatar_url: 'https://lh3.googleusercontent.com/a/default-user',
  },
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

export const TEST_SESSION = {
  access_token: 'fake-jwt-access-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: 'fake-refresh-token',
  user: TEST_USER,
};

export const TEST_PROFILE = {
  id: 'e2e-user-123',
  username: 'e2euser',
  display_name: 'E2E Test User',
  avatar_url: 'https://lh3.googleusercontent.com/a/default-user',
  is_public: true,
  onboarded: true,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

export const TEST_PROFILE_NOT_ONBOARDED = {
  ...TEST_PROFILE,
  username: '',
  onboarded: false,
};

export function generateStickerRows(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    sticker_number: i + 1,
    owned: true,
    dupes: i % 10 === 0 ? 1 : 0,
    note: i % 20 === 0 ? `note-${i + 1}` : null,
  }));
}

export const PUBLIC_PROFILE = {
  id: 'other-user-456',
  username: 'pedro42',
  display_name: 'Pedro Garcia',
  avatar_url: null,
  owned_count: 490,
  dupes_count: 25,
};
