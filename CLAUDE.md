# QueMeFalta — Álbum del Mundial 2026

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Dev server con Supabase real (necesita `.env.local`) |
| `npm run dev:mock` | Dev server con mock local (datos en `mock-data.json`) |
| `npm run build` | Build producción (`vue-tsc` + `vite build`) |
| `npm run test:run` | Unit tests (vitest, ~400 tests) |
| `npm run test:e2e` | E2E tests (playwright, 29 tests) |
| `npm run lint` | ESLint fix |
| `npm run format` | Prettier |

### Tests

**Unit tests (vitest)**
```bash
npm run test:run          # Correr todos una vez
npx vitest                # Watch mode (re-corre al guardar)
npx vitest run --coverage # Con reporte de cobertura
npx vitest run src/__tests__/composables/useStickers.test.ts  # Un archivo específico
npx vitest run -t "cycleSticker"  # Un test por nombre
```

**E2E tests (playwright)**
```bash
npm run test:e2e                                      # Todos (paralelo, ~12s)
npx playwright test --workers=1                       # Secuencial (debug)
npx playwright test tests/e2e/error-resilience.spec.ts  # Un archivo
npx playwright test -g "500 on sticker"               # Por nombre
npx playwright test --ui                              # UI interactivo
npx playwright test --debug                           # Step-by-step debugger
```
> **Nota**: Los E2E corren en puerto 5174 para no chocar con `dev:mock` en 5173. Usan el Supabase client real con interceptación de rutas (no mock mode).

## Arquitectura

- **Vue 3 + Composition API** — `<script setup>` en todo
- **Supabase** — Auth (Google OAuth) + PostgreSQL + RLS
- **Mock mode** — `VITE_MOCK=true` reemplaza Supabase con mock local (`mock-data.json` via Vite plugin)
- **PWA** — Manifest, iconos, meta tags dinámicos (`useMeta`)
- **OCR** — tesseract.js para escanear códigos de láminas desde cámara
- **CI** — GitHub Actions: lint + build + vitest (con coverage) + playwright E2E

## Mapa de componentes

```
AlbumView.vue ─── Vista principal, orquesta todo
├── AlbumAccordion.vue ← Grupos A-L → equipos → stickers inline
│   └── SectionView.vue ← Grilla de 20 stickers por equipo
│       └── StickerCard.vue ← Card individual (tap=marcar, long=detalle)
│           ├── variant: crest (lámina 1, escudo con ball-crest.jpg)
│           ├── variant: squad (lámina 13, horizontal con field-squad.jpg)
│           └── variant: normal (resto, ball-stadium.png)
├── MissingView.vue ← Tab "Faltan" con filtros, agrupado, copiar
├── DupesView.vue ← Tab "Repetidas" con copiar
├── CalculadoraView.vue ← Tab "Calculadora" de sobres con modelo de cambio
├── StickerDetailModal.vue ← Editar cantidad, notas, quitar
├── BatchInput.vue ← Ingreso masivo por código (MEX5, ARG 1 5 8)
├── StickerScanner.vue ← OCR con cámara (tesseract.js + fuzzy matching)
├── ShareModal.vue ← Compartir perfil público
├── OnboardingGuide.vue ← Tutorial de 11 pasos con spotlight
├── ConfirmDialog.vue ← Diálogo de confirmación genérico
└── UndoToast.vue ← Toast con undo

PublicProfileView.vue ← Perfil público /u/:username (read-only)
AuthView.vue ← Login con Google
AuthCallbackView.vue ← Callback OAuth
OnboardingView.vue ← Elegir username
```

## Flujos clave

### Marcar una lámina
`StickerCard tap` → `cycleSticker()` → optimistic update → `withAuthRetry(upsert)` → si falla, revert

### Sesión Supabase
- Refresh proactivo cada 10 min (`supabase.ts`)
- Refresh al volver al tab si >2 min idle
- `withAuthRetry` reintenta 2x con refresh entre cada intento
- Lecturas (`loadStickers`) también usan retry
- Si todo falla → `sessionDead=true` → popup "Recargar página"

### URL Hash routing
- `#team-mex` → abre Grupo A → México con scroll automático al equipo
- `#missing` → abre tab Faltan
- `#dupes` → abre tab Repetidas
- Al tocar equipo/tab → actualiza hash
- Al recargar con hash → scroll instantáneo a la posición correcta

### Láminas especiales
- Lámina 1 de cada equipo → variant `crest` (escudo, borde dorado, imagen pelota)
- Lámina 13 de cada equipo → variant `squad` (selección, 2 columnas, imagen campo)
- Solo aplica a secciones de equipo (`isTeam`), no a FWC intro

## Archivos de datos y utilidades

| Archivo | Qué es |
|---|---|
| `src/lib/albumData.ts` | 49 secciones (intro + 48 equipos), 980 stickers, `codeForSticker`, `sectionForSticker`, `stickerNumberFromCode` |
| `src/lib/progressColors.ts` | Escala de 7 colores por porcentaje: rojo → ámbar → naranja → amarillo → lima → mint → verde brillante |
| `src/lib/teamFlagEmoji.ts` | FIFA code → emoji de bandera (con overrides para ENG/SCO) |
| `src/lib/supabase.ts` | Cliente Supabase + session resilience + `withAuthRetry` + `ensureFreshSession` |
| `src/lib/ocrUtils.ts` | Fuzzy matching, OCR char fixes, `extractCodes()` — lógica pura, sin DOM |
| `src/lib/canvasUtils.ts` | `preprocessImage()` — grayscale, Otsu binarize, scale 2x para OCR |
| `src/lib/fwcConfig.ts` | Config de layout FWC intro (variantes h/v, imágenes por sticker) |
| `src/lib/calcUtils.ts` | Calculadora de sobres: expectedNew, simulateWithTrade, projectionTable, projectionCurves |
| `src/lib/csvUtils.ts` | Export/import CSV grilla 49×20: generateCsv, parseCsv |
| `src/lib/mockClient.ts` | Mock Supabase para `dev:mock` (query builder chainable, auth fake, persistence JSON) |

## Composables

| Composable | Responsabilidad |
|---|---|
| `useAuth` | Singleton global — session, profile, login/logout, init con timeout |
| `useStickers` | CRUD stickers — load (con retry), cycle, batch, section complete/clear, stats |
| `useShare` | Generar link de perfil público |
| `useMeta` | Meta tags dinámicos (title, OG, Twitter) — reactivo con refs |
| `useUndo` | Stack de undo con timeout auto-dismiss |

## Convenciones

- **Stickers**: número (1-980) y código (`FWC1`, `MEX1`, `ARG5`). Siempre usar `codeForSticker(n)` para mostrar.
- **Commits**: Gitmoji. **No agregar `Co-Authored-By` de Claude.**
- **Escrituras DB**: Siempre `ensureFreshSession()` + `withAuthRetry()`
- **Colores de progreso**: Importar de `progressColors.ts`, nunca hardcodear hex de la escala.
- **Iconos**: SVG inline (no emojis como iconos estructurales). Los emojis de banderas son OK.
- **A11y**: `aria-label` en botones icon-only, `role="alert"` en errores, `@keydown.escape` en modales.
- **Tipografía**: Barlow Condensed (display) + Barlow (body) + JetBrains Mono (mono).
- **CSS**: Variables custom (`--gold`, `--pitch`, `--chalk`, `--coral`, `--mint`, etc.) definidas en `main.css`.
- **Mobile**: `touch-action: manipulation`, `100dvh`, `overscroll-behavior: contain`, `prefers-reduced-motion`.
- **Archivos pequeños**: Al agregar features nuevas, extraer lógica a archivos separados (composables, lib utils, componentes) en vez de inflar los existentes. Target: ningún archivo supera ~500 líneas.
- **Post-feature**: Al terminar una feature, revisar si CLAUDE.md necesita actualización (mapa de componentes, archivos de datos, convenciones, deuda técnica).

## Archivos eliminados (no reimportar)

- `GroupPicker.vue` — reemplazado por `AlbumAccordion.vue`
- `NoteModal.vue` — reemplazado por inline en `StickerDetailModal.vue`

## Deuda técnica

- `AlbumView.vue` tiene ~1250 líneas — header/progress podrían extraerse (~200 líneas más)
- `StickerScanner.vue` tiene ~800 líneas — la lógica de cámara/live-preview podría ir a un composable
