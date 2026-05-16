# QueMeFalta — Álbum del Mundial 2026

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Dev server con Supabase real (necesita `.env.local`) |
| `npm run dev:mock` | Dev server con mock local (datos en `mock-data.json`) |
| `npm run build` | Build producción (`vue-tsc` + `vite build`) |
| `npm run test:run` | Unit tests (vitest, 552 tests) |
| `npm run test:e2e` | E2E tests (playwright, 39 tests) |
| `npm run lint` | ESLint con autofix |
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

Cobertura: thresholds globales en `vitest.config.ts` — `statements: 65%`, `functions: 60%`. `mockClient.ts` y `__tests__/mocks/**` están excluidos del reporte (son dev/test only).

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
- **Supabase** — Auth (Google OAuth) + PostgreSQL + RLS + RPCs con `SECURITY DEFINER`
- **Mock mode** — `VITE_MOCK=true` reemplaza Supabase con mock local (`mock-data.json` via Vite plugin)
- **PWA** — `vite-plugin-pwa` con `registerType: 'prompt'`. SW precachea assets buildeados (`globPatterns` JS/CSS/HTML/img/fonts), `navigateFallback: '/index.html'`, Supabase `NetworkOnly`. Update flow en `src/lib/pwaUpdate.ts`: `onNeedRefresh` → toast (`UpdateToast.vue`) o silent update vía router guard (`beforeEach` en `src/router/index.ts` hace `SKIP_WAITING` + nav full-page al destino si no hay modal/input ocupado). Manifest/iconos en `public/`. Headers no-cache en `vercel.json` para `/sw.js`, `/index.html`, manifests.
- **OCR** — tesseract.js para escanear códigos de láminas desde cámara
- **Vercel Web Analytics** — `<Analytics />` en `App.vue`, `track()` custom envuelto en `src/lib/analytics.ts` (no-op en mock mode)
- **CI** — GitHub Actions: lint + build + vitest (con coverage) + playwright E2E
- **Claude Code hook** — `.claude/settings.json` corre `npm run lint` antes de cada `git commit` y bloquea si quedan errores

## Mapa de componentes

```
AlbumView.vue ─── Vista principal, orquesta todo
├── AlbumAccordion.vue ← Grupos A-L → equipos → stickers inline
│                       (pill de páginas completas X/4 por grupo)
│   └── SectionView.vue ← Grilla de 20 stickers por equipo
│       └── StickerCard.vue ← Card individual (tap=detalle, +/− abajo para marcar)
│           ├── variant: crest (lámina 1, escudo con ball-crest.jpg)
│           ├── variant: squad (lámina 13, horizontal con field-squad.jpg)
│           └── variant: normal (resto, ball-stadium.png)
├── MissingView.vue ← Tab "Faltan" con búsqueda + filtros, agrupado, copiar
├── DupesView.vue ← Tab "Repetidas" con búsqueda + stepper inline +/− por lámina
├── CalculadoraView.vue ← Tab "Calculadora" de sobres con modelo de cambio
├── StickerDetailModal.vue ← Editar cantidad (label REPETIDAS), notas, quitar
├── BatchInput.vue ← Ingreso rápido por código (MEX5, ARG 1 5 8) — preview con desglose
├── BatchRemoveInput.vue ← Egreso rápido (espejo de BatchInput) — coral
├── SectionSearch.vue ← Input compartido con ícono lupa + clear ×
├── StickerScanner.vue ← OCR con cámara (tesseract.js + fuzzy matching)
├── ShareModal.vue ← Compartir perfil propio (Web Share + redes)
├── WhatsAppModal.vue ← Editar profile.phone (visible solo a authenticated)
├── CsvModal.vue ← Export/import CSV grilla 49×20
├── OnboardingGuide.vue ← Tutorial de 11 pasos con spotlight
├── ConfirmDialog.vue ← Diálogo de confirmación genérico
└── UndoToast.vue ← Toast con undo

PublicProfileView.vue   ← Perfil público /u/:username (read-only, entry point a intercambio)
ExchangeView.vue        ← Comparación /intercambio/:userA/:userB (público + CTA inline para WhatsApp)
TradeMatchesView.vue    ← /cambios — usuarios con potencial de canje (logged-in only)
AuthView.vue            ← Login con Google
AuthCallbackView.vue    ← Callback OAuth
OnboardingView.vue      ← Elegir username
```

## Flujos clave

### Marcar una lámina (sync queue)
`StickerCard tap` → `cycleSticker()` → optimistic update → write con `withAuthRetry`.

Si el write falla con **error transitorio** (red, 500, timeout) la op se encola en `pendingOps` (en `useStickers.ts`) con backoff **2s / 5s / 10s / 30s / 60s**. Tras 5 intentos pasa a `status: 'failed'`. La UI muestra:

- **StickerCard**: `.stk-sync-dot` con pulso mint cuando pending, coral cuando failed.
- **AlbumView**: banner `.sync-toast` con contadores y botones `Reintentar` / `Descartar`.

La queue persiste en `localStorage` (`quemefalta_sync_<user_id>`) — sobrevive recargas.

Si el error es **permanente** (refresh token revocado), `sessionDead = true` y aparece la dead-modal con `Reintentar` / `Recargar página`. `refreshInProgress()` evita que supabase-js auto-firme out al usuario y nos saque a preview mode antes de mostrar el modal.

### Bulk add / remove
- `BatchInput`: cada aparición de un código suma 1 copia (la primera marca `owned`, las siguientes suman `dupes`).
- `BatchRemoveInput`: cada aparición resta 1 copia. Si llega a 0, se borra la fila.
- Preview enumera códigos afectados ordenados por sticker_number, separados por categoría:
  - **Agregar**: `+N nuevas` (mint, 0 → 1) + `+M repetidas más` (gold, suma a las que ya tienes)
  - **Quitar**: `−N desmarcadas` (coral, 1 → 0) + `−M repetidas menos` (gold) + `K ignoradas` (gris, no las tenías)

### URL Hash routing
- `#team-mex` → abre Grupo A → México con scroll automático al equipo (`scroll-margin-top` evita header sticky)
- `#missing` → abre tab Faltan
- `#dupes` → abre tab Repetidas
- `#calc` → tab Calculadora
- Al tocar equipo/tab → actualiza hash
- Al recargar con hash → scroll instantáneo a la posición correcta

### Láminas especiales
- Lámina 1 de cada equipo → variant `crest` (escudo, borde dorado, imagen pelota)
- Lámina 13 de cada equipo → variant `squad` (selección, 2 columnas, imagen campo)
- Solo aplica a secciones de equipo (`isTeam`), no a FWC intro (que tiene su propio layout fwc-h / fwc-v)

### Convención de repetidas
Mostrar **`+N` con N = solo extras**, sin contar la propia (`dupes` en BD = "repetidas extra"). En textos de copy al portapapeles **se omite `(+1)`** porque `+1` es el mínimo y satura visualmente — solo se muestra `(+N)` cuando `dupes ≥ 2`.

### Trade matches
RPC `public.public_trade_matches()` en Supabase devuelve hasta 100 perfiles públicos ordenados por `their_dupes_for_me DESC` con `LIMIT 100`. Filtra `owned_count > 0` y exige overlap en al menos un sentido. `SECURITY DEFINER` para saltar RLS de forma controlada (solo perfiles `is_public = true`). Grant solo a `authenticated`.

Vista en `/cambios`: dos secciones — **Cambio mutuo** (su `their_dupes_for_me > 0`) y **Solo das tú** (su `their_dupes_for_me === 0`). Card clickeable lleva a `/intercambio/<yo>/<él>`.

### Contacto por WhatsApp
- Columna `profiles.phone` (genérico — sirve también para Telegram/SMS sin migrar).
- RPC `public.get_profile_phone(p_username)` devuelve `text` solo si `auth.uid() IS NOT NULL`. Grant solo a `authenticated`. Anon no puede leer el número.
- UI: link `https://wa.me/<digits>` en perfil ajeno y en cada mini-card de `/intercambio`. CTA inline "+ Agregar tu WhatsApp" si el usuario logueado mira su propio slot sin número.

## Archivos de datos y utilidades

| Archivo | Qué es |
|---|---|
| `src/lib/albumData.ts` | 49 secciones (intro + 48 equipos), 980 stickers, `codeForSticker`, `sectionForSticker`, `stickerNumberFromCode`. Helpers de páginas: `isSectionComplete`, `completedSectionsCount`, `completedTeamsInGroup`, const `TOTAL_SECTIONS` |
| `src/lib/progressColors.ts` | Escala de 7 colores por porcentaje: rojo → ámbar → naranja → amarillo → lima → mint → verde brillante |
| `src/lib/teamFlagEmoji.ts` | FIFA code → emoji de bandera (con overrides para ENG/SCO) |
| `src/lib/supabase.ts` | Cliente Supabase + session resilience: `withAuthRetry`, `ensureFreshSession`, `tryRescueSession`, `reestablishConnection`, `refreshInProgress` |
| `src/lib/ocrUtils.ts` | Fuzzy matching, OCR char fixes, `extractCodes()` — lógica pura, sin DOM |
| `src/lib/canvasUtils.ts` | `preprocessImage()` — grayscale, Otsu binarize, scale 2x para OCR |
| `src/lib/fwcConfig.ts` | Config de layout FWC intro (variantes h/v, imágenes por sticker) |
| `src/lib/calcUtils.ts` | Calculadora de sobres: `expectedNew`, `simulateWithTrade`, `projectionTable`, `projectionCurves` |
| `src/lib/csvUtils.ts` | Export/import CSV grilla 49×20: `generateCsv`, `parseCsv` |
| `src/lib/exchangeUtils.ts` | Algoritmo de intercambio: `computeExchange`, `formatExchangeList` — lógica pura, sin Vue |
| `src/lib/searchSections.ts` | `normalizeStr` (lowercase + sin acentos) + `matchesSection(section, query)` — match por nombre o código FIFA |
| `src/lib/analytics.ts` | Wrapper sobre `@vercel/analytics` con no-op en mock mode + try/catch defensivo |
| `src/lib/mockClient.ts` | Mock Supabase para `dev:mock` (query builder chainable, auth fake, persistence JSON) |

## Composables

| Composable | Responsabilidad |
|---|---|
| `useAuth` | Singleton global — session, profile, login/logout, init con timeout, `updateProfile` |
| `useStickers` | CRUD stickers — load (con retry), cycle, batch add/remove, section complete/clear, sync queue (`pendingOps`, `retryAllPending`, `discardAllPending`), stats |
| `useShare` | Web Share API + fallbacks (copy link, WhatsApp/LinkedIn/email URL builders) |
| `useMeta` | Meta tags dinámicos (title, OG, Twitter) — reactivo con refs |
| `useUndo` | Stack de undo con timeout auto-dismiss |
| `useExchange` | Fetch paralelo de 2 perfiles públicos + computar intercambio de láminas |
| `useTradeMatches` | RPC `public_trade_matches` con cache simple (loaded flag) + reload forzado |
| `useCamera` / `useOcrWorker` | Helpers de StickerScanner (cámara + tesseract.js worker) |

## Migraciones SQL (Supabase)

Los archivos en `supabase/migrations/` **no se aplican solos** — copiar el SQL en Supabase dashboard → SQL Editor → Run. Después: `notify pgrst, 'reload schema';` para refrescar el cache de PostgREST.

| Archivo | Qué define |
|---|---|
| `0001_trade_matches.sql` | RPC `public_trade_matches()` con CTEs (my_owned, my_dupes, candidates) + `LATERAL` joins. `SECURITY DEFINER`, grant solo a `authenticated`. |
| `0002_profile_phone.sql` | Columna `phone text` en `profiles` + RPC `get_profile_phone(p_username)` (devuelve `null` si `auth.uid()` es null). Grant solo a `authenticated`. |

## Convenciones

- **Stickers**: número (1-980) y código (`FWC1`, `MEX1`, `ARG5`). Siempre usar `codeForSticker(n)` para mostrar.
- **Repetidas**: `dupes` en BD = extras sin contar la propia. UI muestra `+N`. Copy text omite `(+1)`.
- **Commits**: Gitmoji. **No agregar `Co-Authored-By` de Claude.** El hook PreToolUse corre `npm run lint` antes y bloquea si quedan errores.
- **Escrituras DB**: Siempre `ensureFreshSession()` + `withAuthRetry()` para reads/writes single-row. Bulk usa `withAuthRetry` directo y cae a `enqueueOp` por fila si falla.
- **Colores de progreso**: Importar de `progressColors.ts`, nunca hardcodear hex de la escala.
- **Iconos**: SVG inline (no emojis como iconos estructurales). Los emojis de banderas son OK.
- **Búsqueda por sección**: Usar `<SectionSearch v-model="..." />` + `matchesSection` para consistencia entre Álbum/Faltan/Repetidas.
- **Analytics**: importar `track` de `@/lib/analytics`, no de `@vercel/analytics` directo. Eventos nombrados en `snake_case` (`view_trade_matches`, `save_phone`, `contact_whatsapp`).
- **A11y**: `aria-label` en botones icon-only, `role="alert"` en errores, `@keydown.escape` en modales, `aria-pressed` en toggles.
- **Tipografía**: Barlow Condensed (display) + Barlow (body) + JetBrains Mono (mono).
- **CSS**: Variables custom (`--gold`, `--pitch`, `--chalk`, `--coral`, `--mint`, etc.) definidas en `main.css`.
- **Mobile**: `touch-action: manipulation`, `100dvh`, `overscroll-behavior: contain`, `prefers-reduced-motion`.
- **PWA safe-area**: Vistas standalone (PublicProfile, Exchange, TradeMatches) deben usar `calc(N + env(safe-area-inset-top))` en el wrap. Elementos a los que apuntamos con `scrollIntoView` necesitan `scroll-margin-top` para no quedar debajo del header sticky.
- **Modales destructivos**: BatchInput y BatchRemoveInput **no cierran al clickear afuera** — solo con la × — para evitar perder el texto tipeado.
- **Archivos pequeños**: Al agregar features nuevas, extraer lógica a archivos separados (composables, lib utils, componentes) en vez de inflar los existentes. Target: ningún archivo supera ~500 líneas.
- **Post-feature**: Al terminar una feature, revisar si CLAUDE.md necesita actualización (mapa de componentes, archivos de datos, convenciones, deuda técnica).

## Deuda técnica

- `AlbumView.vue` tiene ~1920 líneas — el header con progress + stats + popovers + menú avatar podría extraerse a `AlbumHeader.vue` (~400 líneas). Los handlers de batch/scanner también podrían vivir en un composable `useAlbumModals`.
- `useStickers.ts` tiene ~1200 líneas — el sync queue (pendingOps, scheduleNextRetry, runDueRetries, enqueueOp) podría extraerse a `src/lib/syncQueue.ts`.
- Tests de coverage: thresholds bajos (statements 65%, functions 60%) — `mockClient.ts` y supabase.ts session-management quedan sin cubrir.
