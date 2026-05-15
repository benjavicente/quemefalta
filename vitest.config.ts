import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.test.ts'],
    mockReset: true,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      exclude: [
        'src/assets/**',
        // Dev-only helpers que no se cargan en producción
        'src/lib/mockClient.ts',
        // Setup y mocks de testing
        'src/__tests__/setup.ts',
        'src/__tests__/mocks/**',
      ],
      thresholds: {
        statements: 65,
        functions: 60,
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
