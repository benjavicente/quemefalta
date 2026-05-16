import { fileURLToPath, URL } from 'node:url';
import { defineConfig, type PluginOption } from 'vite';
import vue from '@vitejs/plugin-vue';
import { mockDbPlugin } from './vite-plugin-mock-db';

const BUILD_ID = Date.now().toString();

function versionJsonPlugin(): PluginOption {
  return {
    name: 'quemefalta-version-json',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ build: BUILD_ID }) + '\n',
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [vue(), ...(mode === 'mock' ? [mockDbPlugin()] : []), versionJsonPlugin()],
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
}));
