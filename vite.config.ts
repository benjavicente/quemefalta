import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { mockDbPlugin } from './vite-plugin-mock-db';

export default defineConfig(({ mode }) => ({
  plugins: [vue(), ...(mode === 'mock' ? [mockDbPlugin()] : [])],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
}));
