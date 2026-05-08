# QueMeFalta

Tracker del album del Mundial 2026. Vue 3 + TypeScript + Vite + Supabase.

## Setup

```bash
npm install
```

## Desarrollo local (mock, sin tocar prod)

```bash
npm run dev:mock
```

Abre [http://localhost:5173](http://localhost:5173). Usa un usuario fake ya logueado (`dev@quemefalta.local`). Todos los cambios se guardan en `mock-data.json` (gitignored). Puedes borrar ese archivo para resetear la data.

## Desarrollo con Supabase real

Necesitas un archivo `.env.local` con tus credenciales:

```
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
```

```bash
npm run dev
```

## Build de produccion

```bash
npm run build
npm run preview
```

## Tests

```bash
npm run test:run      # Unit tests (vitest)
npm run test:e2e      # E2E tests (playwright)
```

## Deploy

Push a `main` triggerea deploy automatico en Vercel. El `vercel.json` tiene el SPA fallback configurado.

## Stack

- **Frontend**: Vue 3, Vue Router, TypeScript
- **Backend**: Supabase (auth, PostgreSQL, RLS)
- **Deploy**: Vercel
- **Tests**: Vitest + Playwright
