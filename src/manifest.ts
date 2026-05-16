import type { ManifestOptions } from 'vite-plugin-pwa';

export const manifest: Partial<ManifestOptions> = {
  name: 'QueMeFalta — Álbum del Mundial 2026',
  short_name: 'QueMeFalta',
  description:
    'Marca tus láminas del Mundial 2026, identifica las que te faltan, comparte tu progreso.',
  start_url: '/',
  display: 'standalone',
  background_color: '#0c1220',
  theme_color: '#141c2b',
  orientation: 'portrait',
  lang: 'es-CL',
  categories: ['sports', 'entertainment', 'lifestyle'],
  icons: [
    {
      src: '/icon-192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: '/icon-192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'maskable',
    },
    {
      src: '/icon-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: '/icon-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ],
};
