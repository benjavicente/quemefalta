# QueMeFalta - Tracker del Album del Mundial 2026

## Comandos

- `npm run dev` — Dev server con Supabase real (necesita `.env.local`)
- `npm run dev:mock` — Dev server con mock local (datos en `mock-data.json`)
- `npm run build` — Build de produccion (vue-tsc + vite build)
- `npm run test:run` — Unit tests (vitest)
- `npm run test:e2e` — E2E tests (playwright)
- `npm run lint` — ESLint fix
- `npm run format` — Prettier

## Arquitectura

- **Vue 3 + Composition API** con `<script setup>` en todos los componentes
- **Supabase** para auth (Google OAuth) y base de datos (PostgreSQL + RLS)
- **Mock mode**: `VITE_MOCK=true` reemplaza Supabase con un mock client local que persiste en `mock-data.json` via Vite dev server plugin
- **Commits**: Usar gitmoji. No agregar `Co-Authored-By` de Claude.

## Estructura clave

- `src/lib/supabase.ts` — Cliente Supabase + session resilience (keep-alive, retry, sessionDead)
- `src/lib/mockClient.ts` — Mock client para desarrollo local
- `src/lib/albumData.ts` — Datos estaticos del album (secciones, equipos, 980 stickers)
- `src/composables/useAuth.ts` — Auth global singleton (init, login, logout, profile)
- `src/composables/useStickers.ts` — CRUD de stickers con optimistic updates y retry
- `src/views/AlbumView.vue` — Vista principal del album
- `src/views/PublicProfileView.vue` — Perfil publico (/u/:username)

## Convenciones

- Stickers se identifican por numero (1-980) y codigo (FWC1, MEX1, ARG5, etc.)
- `codeForSticker(n)` convierte numero a codigo, `sectionForSticker(n)` a seccion
- Las operaciones de escritura usan `withAuthRetry()` y `ensureFreshSession()`
- UI usa variables CSS custom (--gold, --pitch, --chalk, --coral, --mint, etc.)
