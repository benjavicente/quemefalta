import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';
import { mockDbPlugin } from './vite-plugin-mock-db';
import { manifest } from './src/manifest';

export default defineConfig(({ mode }) => ({
  plugins: [
    vue(),
    ...(mode === 'mock' ? [mockDbPlugin()] : []),
    VitePWA({
      manifestFilename: 'manifest.json',
      manifest,
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
}));
