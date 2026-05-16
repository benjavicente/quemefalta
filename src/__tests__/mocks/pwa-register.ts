// Stub para vitest: vite-plugin-pwa expone "virtual:pwa-register" en runtime
// pero los tests no corren el plugin. Este alias del vitest config apunta acá.
import { vi } from 'vitest';
export const registerSW = vi.fn();
