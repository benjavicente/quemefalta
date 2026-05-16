import { ref } from 'vue';
import { vi } from 'vitest';

export const updateServiceWorker = vi.fn().mockResolvedValue(undefined);

export const useRegisterSW = vi.fn(() => ({
  needRefresh: ref(false),
  offlineReady: ref(false),
  updateServiceWorker,
}));
