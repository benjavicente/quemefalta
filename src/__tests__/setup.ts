import { vi } from 'vitest';

// Stub env vars needed by src/lib/supabase.ts
vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');

// Mock supabase module globally — actual mock is in mocks/supabase.ts
vi.mock('@/lib/supabase');

// Stub DOM APIs not available in jsdom
if (typeof navigator !== 'undefined') {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    writable: true,
    configurable: true,
  });
}

// Stub window.location.origin for share URLs
Object.defineProperty(window, 'location', {
  value: {
    ...window.location,
    origin: 'https://quemefalta.app',
    href: 'https://quemefalta.app',
  },
  writable: true,
  configurable: true,
});
