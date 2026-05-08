import type { Profile } from '@/types/app';
import type { StickerState } from '@/composables/useStickers';

// Supabase User type (simplified for tests)
export interface MockUser {
  id: string;
  email: string;
  app_metadata: Record<string, any>;
  user_metadata: Record<string, any>;
  aud: string;
  created_at: string;
}

export interface MockSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  user: MockUser;
}

export function createUser(overrides?: Partial<MockUser>): MockUser {
  return {
    id: 'user-123',
    email: 'test@example.com',
    app_metadata: {},
    user_metadata: {
      full_name: 'Test User',
      avatar_url: 'https://example.com/avatar.jpg',
    },
    aud: 'authenticated',
    created_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

export function createSession(overrides?: Partial<MockSession>): MockSession {
  const user = overrides?.user ?? createUser();
  return {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    expires_in: 3600,
    token_type: 'bearer',
    user,
    ...overrides,
  };
}

export function createProfile(overrides?: Partial<Profile>): Profile {
  return {
    id: 'user-123',
    username: 'testuser',
    display_name: 'Test User',
    avatar_url: 'https://example.com/avatar.jpg',
    is_public: true,
    onboarded: true,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

export function createStickerState(overrides?: Partial<StickerState>): StickerState {
  return {
    owned: false,
    dupes: 0,
    note: '',
    ...overrides,
  };
}

export function createStickerDbRow(stickerNumber: number, overrides?: Record<string, any>) {
  return {
    sticker_number: stickerNumber,
    owned: true,
    dupes: 0,
    note: null,
    ...overrides,
  };
}
