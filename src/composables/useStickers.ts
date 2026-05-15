import { ref, computed, readonly, watch } from 'vue';
import { supabase, ensureFreshSession, withAuthRetry, sessionDead } from '@/lib/supabase';
import { useAuth } from '@/composables/useAuth';
import { useUndo } from '@/composables/useUndo';
import { TOTAL_STICKERS } from '@/lib/albumData';

export interface StickerState {
  owned: boolean;
  dupes: number;
  note: string;
}

// === SYNC QUEUE ===
// Cuando un write falla (timeout, red, server), NO revertimos el optimistic.
// Lo agregamos a esta cola y reintentamos en background con backoff. Asi el
// usuario nunca pierde un cambio por un blip transitorio, y solo se le pide
// accion (Reintentar/Descartar) cuando ya agotamos los retries automaticos.

export interface PendingOp {
  stickerNumber: number;
  targetState: StickerState;
  prevState: StickerState | undefined; // para discard
  attempts: number;
  lastAttemptAt: number;
  lastError: string | null;
  status: 'pending' | 'failed';
}

// Backoff: 2s → 5s → 10s → 30s → 60s. Despues de 5 intentos, status='failed'.
const RETRY_DELAYS = [2000, 5000, 10000, 30000, 60000];
const MAX_ATTEMPTS = RETRY_DELAYS.length;

const stickers = ref<Record<number, StickerState>>({});
const loading = ref(false);
const loaded = ref(false);
const syncError = ref<string | null>(null);
const pendingOps = ref<Map<number, PendingOp>>(new Map());
let currentUserId: string | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

// Mutex por sticker. Mapeamos a la Promise de la operacion en vuelo para que
// los undos (force=true) puedan esperar a que termine la operacion original
// antes de aplicar el revert — sin esto, undo y original corren en paralelo y
// el orden de respuesta del servidor decide quien gana, dejando DB y UI
// desincronizadas.
const inFlight = new Map<number, Promise<void>>();
let sectionInFlight = false;

function defaultState(): StickerState {
  return { owned: false, dupes: 0, note: '' };
}

// Traduce errores de Supabase/red a mensajes legibles para el usuario.
// El mensaje tecnico queda en console (desarrollador) — el banner muestra
// algo que el usuario puede entender. Una sola fuente de mensajes amables.
function friendlyErrorMessage(err: { message?: string; code?: string } | null): string {
  if (!err) return 'Error al guardar';
  const msg = (err.message ?? '').toLowerCase();
  const code = (err.code ?? '').toLowerCase();
  if (code === 'timeout' || msg.includes('tardando') || msg.includes('timeout')) {
    return 'Tardando en sincronizar';
  }
  if (msg.includes('sin conexión') || msg.includes('fetch') || msg.includes('network')) {
    return 'Sin conexión';
  }
  if (msg.includes('conexión lenta') || msg.includes('lenta')) {
    return 'Conexión lenta';
  }
  if (msg.includes('row-level security') || msg.includes('permission')) {
    return 'Sin permisos para esta acción';
  }
  if (code === 'session_dead' || msg.includes('sesión expirada')) {
    return 'Sesión expirada. Recarga la página.';
  }
  if (code.startsWith('5')) return 'Error del servidor';
  return 'Error al guardar';
}

// === DB WRITE HELPER ===
// Realiza el upsert/delete real al servidor. Usado tanto por setSticker (primer
// intento) como por la queue de retry.
async function writeStickerToDb(
  userId: string,
  stickerNumber: number,
  targetState: StickerState,
): Promise<{ message: string; code?: string } | null> {
  // Si el state es default (todo vacio), borrar la fila.
  if (!targetState.owned && targetState.dupes === 0 && !targetState.note) {
    const { error } = await withAuthRetry(() =>
      supabase.from('stickers').delete().eq('user_id', userId).eq('sticker_number', stickerNumber),
    );
    return error;
  }
  const { error } = await withAuthRetry(() =>
    supabase.from('stickers').upsert(
      {
        user_id: userId,
        sticker_number: stickerNumber,
        owned: targetState.owned,
        dupes: targetState.dupes,
        note: targetState.note || null,
      },
      { onConflict: 'user_id,sticker_number' },
    ),
  );
  return error;
}

// === SYNC QUEUE MANAGEMENT ===

// Verifica TODOS los ops de la queue (pending + failed) contra el server en
// una sola query. Los que ya estan guardados se limpian silenciosamente.
// Caso comun: red lenta → server procesa write pero cliente recibe timeout.
// Sin esto, la queue sigue reintentando ops que ya estan en DB.
async function reconcilePendingOps() {
  const { user } = useAuth();
  if (!user.value) return;

  const ops = [...pendingOps.value.values()];
  if (ops.length === 0) return;

  const stickerNumbers = ops.map((op) => op.stickerNumber);
  const { data, error } = await withAuthRetry(() =>
    supabase
      .from('stickers')
      .select('sticker_number, owned, dupes, note')
      .eq('user_id', user.value!.id)
      .in('sticker_number', stickerNumbers),
  );
  if (error || !Array.isArray(data)) return;

  // Indexar server state por sticker_number. Los que no aparezcan en data
  // significa que en el server NO hay row (estado default).
  const serverByNum = new Map<number, StickerState>();
  for (const row of data as {
    sticker_number: number;
    owned: boolean;
    dupes: number | null;
    note: string | null;
  }[]) {
    serverByNum.set(row.sticker_number, {
      owned: row.owned,
      dupes: row.dupes ?? 0,
      note: row.note ?? '',
    });
  }

  let anyChanged = false;
  for (const op of ops) {
    const serverState = serverByNum.get(op.stickerNumber) ?? defaultState();
    if (isSameState(serverState, op.targetState)) {
      console.log(`[SyncQueue] ${op.stickerNumber} verified on server — cleaning`);
      pendingOps.value.delete(op.stickerNumber);
      anyChanged = true;
    }
  }

  if (anyChanged) {
    pendingOps.value = new Map(pendingOps.value);
    persistQueue();
    scheduleNextRetry();
  }
}

function queueStorageKey(userId: string): string {
  return `quemefalta_sync_${userId}`;
}

function persistQueue() {
  if (!currentUserId) return;
  try {
    const arr = [...pendingOps.value.values()];
    if (arr.length === 0) {
      localStorage.removeItem(queueStorageKey(currentUserId));
    } else {
      localStorage.setItem(queueStorageKey(currentUserId), JSON.stringify(arr));
    }
  } catch (e) {
    console.warn('[SyncQueue] persist failed:', e);
  }
}

function loadQueue(userId: string) {
  try {
    const raw = localStorage.getItem(queueStorageKey(userId));
    if (!raw) return;
    const arr = JSON.parse(raw) as PendingOp[];
    const map = new Map<number, PendingOp>();
    for (const op of arr) map.set(op.stickerNumber, op);
    pendingOps.value = map;
    console.log(`[SyncQueue] loaded ${arr.length} pending ops`);
    scheduleNextRetry();
  } catch (e) {
    console.warn('[SyncQueue] load failed:', e);
  }
}

function applyOptimisticFromQueue(map: Record<number, StickerState>) {
  for (const op of pendingOps.value.values()) {
    const t = op.targetState;
    if (!t.owned && t.dupes === 0 && !t.note) {
      // target = default → no debe estar en el map (sticker "vacio")
      delete map[op.stickerNumber];
    } else {
      map[op.stickerNumber] = t;
    }
  }
}

function scheduleNextRetry() {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }

  // Encontrar el proximo op que esta due (no failed).
  const now = Date.now();
  let earliest = Infinity;
  for (const op of pendingOps.value.values()) {
    if (op.status !== 'pending') continue;
    if (op.attempts >= MAX_ATTEMPTS) continue;
    const delay = RETRY_DELAYS[Math.max(0, op.attempts - 1)];
    const dueAt = op.lastAttemptAt + delay;
    if (dueAt < earliest) earliest = dueAt;
  }

  if (earliest === Infinity) return;
  const wait = Math.max(100, earliest - now);
  retryTimer = setTimeout(() => {
    void runDueRetries();
  }, wait);
}

async function runDueRetries() {
  const { user } = useAuth();
  if (!user.value) return;

  const now = Date.now();
  const due: PendingOp[] = [];
  for (const op of pendingOps.value.values()) {
    if (op.status !== 'pending') continue;
    if (op.attempts >= MAX_ATTEMPTS) continue;
    const delay = RETRY_DELAYS[Math.max(0, op.attempts - 1)];
    if (op.lastAttemptAt + delay <= now) due.push(op);
  }

  if (due.length === 0) {
    scheduleNextRetry();
    return;
  }

  // ANTES de gastar tiempo reintentando 1 por 1 (cada uno potencialmente 8s
  // de timeout), verificar 1 vez en batch contra el server. Caso comun:
  // server proceso el write pero el cliente recibio timeout — la data YA
  // esta guardada. Sin esto, retries timeoutean innecesariamente.
  await reconcilePendingOps();

  // Re-filtrar despues del reconcile — algunos ops pueden haber sido limpiados.
  const stillDue = due.filter((op) => pendingOps.value.has(op.stickerNumber));
  if (stillDue.length === 0) {
    scheduleNextRetry();
    return;
  }

  console.log(`[SyncQueue] retrying ${stillDue.length} ops`);

  let anyChanged = false;
  for (const op of stillDue) {
    // Snapshot del target ANTES del write — si el usuario lo cambia durante el
    // await (via setSticker), op.targetState ya tendra el nuevo valor cuando
    // volvamos. Necesitamos comparar para no perder la actualizacion.
    const targetSnapshot: StickerState = { ...op.targetState };
    const error = await writeStickerToDb(user.value.id, op.stickerNumber, targetSnapshot);
    if (!error) {
      // Re-leer el op del map (puede haber sido reemplazado en pendingOps por enqueueOp).
      const current = pendingOps.value.get(op.stickerNumber);
      if (current && !isSameState(current.targetState, targetSnapshot)) {
        // El usuario actualizo el target DURANTE el write. No borrar — dejar
        // que el proximo retry escriba el target nuevo.
        console.log(
          `[SyncQueue] ${op.stickerNumber} success but target changed; keeping for retry`,
        );
        current.attempts = 0;
        current.lastAttemptAt = Date.now();
        current.lastError = null;
        current.status = 'pending';
      } else {
        console.log(`[SyncQueue] ✓ ${op.stickerNumber} after ${op.attempts} attempts`);
        pendingOps.value.delete(op.stickerNumber);
      }
      anyChanged = true;
    } else {
      op.attempts++;
      op.lastAttemptAt = Date.now();
      op.lastError = error.message;
      if (op.attempts >= MAX_ATTEMPTS) {
        op.status = 'failed';
        console.warn(`[SyncQueue] ✗ gave up on ${op.stickerNumber} after ${op.attempts} attempts`);
      } else {
        console.log(`[SyncQueue] retry ${op.stickerNumber} failed (attempt ${op.attempts})`);
      }
      anyChanged = true;
    }
  }

  if (anyChanged) {
    // Forzar reactividad (Map mutation no la dispara solo).
    pendingOps.value = new Map(pendingOps.value);
    persistQueue();
  }

  // Si algun op transito a failed (agotaron retries), verificar 1 vez mas —
  // puede que el server lo tenga aunque hayamos recibido timeouts. Al inicio
  // de runDueRetries ya reconcilamos, pero los failed son finales y vale el
  // doble-check antes de mostrar "X cambios sin guardar" al usuario.
  const justFailed = stillDue.some((op) => op.status === 'failed');
  if (justFailed && pendingOps.value.size > 0) {
    void reconcilePendingOps();
  }

  scheduleNextRetry();
}

function enqueueOp(
  stickerNumber: number,
  targetState: StickerState,
  prevState: StickerState | undefined,
  errMsg: string,
) {
  // La queue se hace cargo de este sticker → no mostrar el banner generico de
  // "Error guardando" porque seria redundante con el banner de sync queue.
  syncError.value = null;
  const existing = pendingOps.value.get(stickerNumber);
  if (existing) {
    // Ya estaba en queue → solo actualizar target. prevState ORIGINAL se mantiene
    // para que discard revierta al estado real previo a TODAS las ediciones pendientes.
    existing.targetState = targetState;
    existing.attempts = 1;
    existing.lastAttemptAt = Date.now();
    existing.lastError = errMsg;
    existing.status = 'pending';
  } else {
    pendingOps.value.set(stickerNumber, {
      stickerNumber,
      targetState,
      prevState,
      attempts: 1,
      lastAttemptAt: Date.now(),
      lastError: errMsg,
      status: 'pending',
    });
  }
  pendingOps.value = new Map(pendingOps.value);
  persistQueue();
  scheduleNextRetry();
}

function discardOne(stickerNumber: number) {
  const op = pendingOps.value.get(stickerNumber);
  if (!op) return;

  // Revertir optimistic al prevState original.
  if (op.prevState) {
    stickers.value = { ...stickers.value, [stickerNumber]: op.prevState };
  } else {
    const m = { ...stickers.value };
    delete m[stickerNumber];
    stickers.value = m;
  }

  pendingOps.value.delete(stickerNumber);
  pendingOps.value = new Map(pendingOps.value);
  persistQueue();
}

function discardAllPending() {
  const newStickers = { ...stickers.value };
  for (const op of pendingOps.value.values()) {
    if (op.prevState) {
      newStickers[op.stickerNumber] = op.prevState;
    } else {
      delete newStickers[op.stickerNumber];
    }
  }
  stickers.value = newStickers;
  pendingOps.value = new Map();
  persistQueue();
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
}

async function retryAllPending() {
  // Verificar primero contra el server: si alguno ya esta guardado, limpiarlo
  // antes de marcar para retry. Asi evitamos disparar writes innecesarios.
  await reconcilePendingOps();
  for (const op of pendingOps.value.values()) {
    op.status = 'pending';
    op.lastAttemptAt = 0; // due now
    // Reset attempts to 1 si estaba failed, asi vuelven a tener 5 reintentos.
    if (op.attempts >= MAX_ATTEMPTS) op.attempts = 1;
  }
  pendingOps.value = new Map(pendingOps.value);
  scheduleNextRetry();
}

const pendingCount = computed(() => {
  let n = 0;
  for (const op of pendingOps.value.values()) if (op.status === 'pending') n++;
  return n;
});

const failedCount = computed(() => {
  let n = 0;
  for (const op of pendingOps.value.values()) if (op.status === 'failed') n++;
  return n;
});

function getStickerSyncStatus(n: number): 'pending' | 'failed' | null {
  const op = pendingOps.value.get(n);
  return op ? op.status : null;
}

async function loadStickers(userId: string, force = false) {
  if (!force && currentUserId === userId && loaded.value) return;

  loading.value = true;
  syncError.value = null;

  // Ensure session is fresh before reading
  await ensureFreshSession();

  const { data, error } = await withAuthRetry(() =>
    supabase.from('stickers').select('sticker_number, owned, dupes, note').eq('user_id', userId),
  );

  if (error) {
    console.error('[useStickers] Load error:', error);
    syncError.value = friendlyErrorMessage(error);
    loading.value = false;
    return;
  }

  const map: Record<number, StickerState> = {};
  const rows =
    (data as
      | { sticker_number: number; owned: boolean; dupes: number; note: string | null }[]
      | null) ?? [];
  for (const row of rows) {
    map[row.sticker_number] = {
      owned: row.owned,
      dupes: row.dupes ?? 0,
      note: row.note ?? '',
    };
  }

  // Aplicar optimistic states de la sync queue ENCIMA del estado del servidor.
  // Si recargaste con cambios pendientes (queue persistida), esas laminas se ven
  // con el target del usuario, no con lo que esta en DB.
  applyOptimisticFromQueue(map);

  stickers.value = map;
  currentUserId = userId;
  loaded.value = true;
  loading.value = false;
}

function isSameState(a: StickerState, b: StickerState): boolean {
  return a.owned === b.owned && a.dupes === b.dupes && a.note === b.note;
}

function applyOptimistic(stickerNumber: number, target: StickerState) {
  // Si el state es default, borramos la entrada del map (asi
  // stickers.value[n] === undefined y stats lo cuenta como no-owned).
  if (!target.owned && target.dupes === 0 && !target.note) {
    const m = { ...stickers.value };
    delete m[stickerNumber];
    stickers.value = m;
  } else {
    stickers.value = { ...stickers.value, [stickerNumber]: target };
  }
}

// Upsert con optimistic update + sync queue.
//
// SEMANTICA CLAVE: cada tap actualiza la UI inmediatamente, incluso si hay un
// write en vuelo para la misma lamina. El write en vuelo se reconcilia al
// terminar — si el optimistic cambió mientras tanto, dispara un write nuevo
// con el estado final. Asi multiples taps rapidos no se pierden.
//
// Si el write falla por error transitorio, NO revertimos: encolamos para
// retry en background con el estado FINAL (no el inicial), asi la queue
// siempre tiene el target que el usuario realmente quiere.
async function setSticker(stickerNumber: number, newState: StickerState, _force = false) {
  const { user } = useAuth();
  if (!user.value) return;

  // Capturar prev ANTES del optimistic, para revert o para discard de la queue.
  const previousState = stickers.value[stickerNumber];

  // Optimistic siempre se aplica de inmediato — la UI refleja el ultimo tap.
  applyOptimistic(stickerNumber, newState);

  // Si la lamina ya esta en la sync queue, solo actualizamos el target.
  // prevState ORIGINAL se preserva para que discard revierta al estado real
  // previo a TODAS las ediciones pendientes sobre esta lamina.
  const queued = pendingOps.value.get(stickerNumber);
  if (queued) {
    queued.targetState = newState;
    queued.attempts = 0; // proximo retry con backoff 2s
    queued.lastAttemptAt = Date.now();
    queued.lastError = null;
    queued.status = 'pending';
    pendingOps.value = new Map(pendingOps.value);
    persistQueue();
    scheduleNextRetry();
    return;
  }

  // Si hay un write en vuelo, NO empezamos uno nuevo. Cuando el actual termine,
  // se reconciliara comparando con stickers.value (que ya tiene el optimistic
  // de este tap). El usuario ve la UI actualizada en todos los taps.
  if (inFlight.has(stickerNumber)) return;

  // Claim el slot
  let opResolve: () => void = () => {};
  const opPromise = new Promise<void>((r) => {
    opResolve = r;
  });
  inFlight.set(stickerNumber, opPromise);

  try {
    const fresh = await ensureFreshSession();
    if (!fresh) {
      // sessionDead: revertir optimistic — la dead-modal bloquea el flujo
      // y queremos UI consistente con DB.
      if (previousState) {
        stickers.value = { ...stickers.value, [stickerNumber]: previousState };
      } else {
        const m = { ...stickers.value };
        delete m[stickerNumber];
        stickers.value = m;
      }
      syncError.value = 'Sesión expirada. Recarga la página.';
      return;
    }

    const error = await writeStickerToDb(user.value.id, stickerNumber, newState);

    if (!error) {
      syncError.value = null;
      // Reconciliacion: si el usuario cambio el estado durante el write,
      // disparar otro write con el estado actual.
      const current = stickers.value[stickerNumber] ?? defaultState();
      if (!isSameState(current, newState)) {
        // Re-fire despues del finally (asi inFlight ya esta limpio).
        queueMicrotask(() => {
          void setSticker(stickerNumber, current, true);
        });
      }
      return;
    }

    if (error.code === 'session_dead') {
      // Revertir optimistic — el modal sessionDead bloquea writes.
      if (previousState) {
        stickers.value = { ...stickers.value, [stickerNumber]: previousState };
      } else {
        const m = { ...stickers.value };
        delete m[stickerNumber];
        stickers.value = m;
      }
      return;
    }

    // Error transitorio (timeout, red, server) → encolar con el estado FINAL
    // (puede haber cambiado durante el write por taps adicionales).
    const finalTarget = stickers.value[stickerNumber] ?? defaultState();
    console.warn(`[setSticker] ${stickerNumber} write failed, enqueuing:`, error.message);
    enqueueOp(stickerNumber, finalTarget, previousState, error.message);
  } finally {
    inFlight.delete(stickerNumber);
    opResolve();
  }
}

// Tap: vacio → owned → ×2 → ×3 (se queda en ×3, para quitar usar modal)
function cycleSticker(stickerNumber: number, _skipUndo = false) {
  // Sin check de inFlight: setSticker maneja la reconciliacion si hay un
  // write en vuelo. Cada tap actualiza la UI inmediatamente.
  const current = stickers.value[stickerNumber] ?? defaultState();
  const prevState = { ...current };

  if (!current.owned) {
    setSticker(stickerNumber, { ...current, owned: true, dupes: 0 });
    if (!_skipUndo) {
      const { pushUndo } = useUndo();
      pushUndo('1 lamina marcada', () => {
        setSticker(stickerNumber, prevState, true);
      });
    }
  } else {
    setSticker(stickerNumber, { ...current, dupes: current.dupes + 1 });
    if (!_skipUndo) {
      const { pushUndo } = useUndo();
      pushUndo('1 repetida agregada', () => {
        setSticker(stickerNumber, prevState, true);
      });
    }
  }
}

// Agregar múltiples stickers de golpe (ingreso por lotes)
// Duplicates in the array are treated as extra copies (dupes).
async function addBatch(stickerNumbers: number[]) {
  const { user } = useAuth();
  if (!user.value || sectionInFlight) return;
  sectionInFlight = true;

  try {
    if (!(await ensureFreshSession())) {
      syncError.value = 'Sesión expirada. Recarga la página.';
      return;
    }

    // Count occurrences of each sticker number
    const counts = new Map<number, number>();
    for (const num of stickerNumbers) {
      if (num < 1 || num > TOTAL_STICKERS) continue;
      counts.set(num, (counts.get(num) || 0) + 1);
    }

    const toUpsert: { num: number; prev: StickerState | undefined; newState: StickerState }[] = [];
    for (const [num, count] of counts) {
      const existing = stickers.value[num];
      if (!existing?.owned) {
        // No la tenía: 1 instancia llena el slot "owned", el resto son dupes.
        toUpsert.push({
          num,
          prev: existing,
          newState: { owned: true, dupes: count - 1, note: existing?.note ?? '' },
        });
      } else {
        // Ya la tenía: cada instancia del input suma como repetida nueva.
        toUpsert.push({
          num,
          prev: existing,
          newState: { ...existing, dupes: existing.dupes + count },
        });
      }
    }

    if (toUpsert.length === 0) return 0;

    // Optimistic
    const newMap = { ...stickers.value };
    for (const { num, newState } of toUpsert) {
      newMap[num] = newState;
    }
    stickers.value = newMap;

    const rows = toUpsert.map(({ num, newState }) => ({
      user_id: user.value!.id,
      sticker_number: num,
      owned: newState.owned,
      dupes: newState.dupes,
      note: newState.note || null,
    }));

    const { error } = await withAuthRetry(() =>
      supabase.from('stickers').upsert(rows, { onConflict: 'user_id,sticker_number' }),
    );

    if (error) {
      console.error('[useStickers] Batch add error, enqueuing individually:', error);
      // Bulk fallo (probable timeout por payload grande). NO revertimos — encolamos
      // cada sticker individualmente para que la queue los retry uno por uno.
      // Writes individuales suelen pasar aunque el bulk timeoutee.
      for (const { num, prev, newState } of toUpsert) {
        enqueueOp(num, newState, prev, error.message);
      }
      syncError.value = null; // queue toma el control
      return toUpsert.length;
    }

    syncError.value = null;
    return toUpsert.length;
  } finally {
    sectionInFlight = false;
  }
}

// Quitar sticker completamente
function removeSticker(stickerNumber: number) {
  setSticker(stickerNumber, { owned: false, dupes: 0, note: '' });
}

/**
 * Bulk inverso de addBatch: cada aparición de un sticker en el array resta 1
 * copia. Si la lámina no estaba marcada, la aparición se ignora. Cuando se
 * quitan todas las copias, queda owned=false con dupes=0.
 */
async function removeBatch(stickerNumbers: number[]) {
  const { user } = useAuth();
  if (!user.value || sectionInFlight) return 0;
  sectionInFlight = true;

  try {
    if (!(await ensureFreshSession())) {
      syncError.value = 'Sesión expirada. Recarga la página.';
      return 0;
    }

    // Apariciones por sticker en el input
    const counts = new Map<number, number>();
    for (const num of stickerNumbers) {
      if (num < 1 || num > TOTAL_STICKERS) continue;
      counts.set(num, (counts.get(num) || 0) + 1);
    }

    const toUpsert: { num: number; prev: StickerState | undefined; newState: StickerState }[] = [];
    const toDelete: { num: number; prev: StickerState }[] = [];

    for (const [num, count] of counts) {
      const existing = stickers.value[num];
      if (!existing?.owned) continue; // no tenía nada → nada que quitar

      const totalCopies = 1 + existing.dupes;
      const removed = Math.min(count, totalCopies);
      const remaining = totalCopies - removed;

      if (remaining <= 0) {
        // Se va a 0 copias → borrar la fila (igual que removeSticker)
        toDelete.push({ num, prev: existing });
      } else {
        toUpsert.push({
          num,
          prev: existing,
          newState: { ...existing, dupes: remaining - 1 },
        });
      }
    }

    if (toUpsert.length === 0 && toDelete.length === 0) return 0;

    // Optimistic
    const newMap = { ...stickers.value };
    for (const { num, newState } of toUpsert) newMap[num] = newState;
    for (const { num } of toDelete) delete newMap[num];
    stickers.value = newMap;

    // Upsert los que siguen owned, delete los que llegan a 0
    if (toUpsert.length > 0) {
      const rows = toUpsert.map(({ num, newState }) => ({
        user_id: user.value!.id,
        sticker_number: num,
        owned: newState.owned,
        dupes: newState.dupes,
        note: newState.note || null,
      }));
      const { error } = await withAuthRetry(() =>
        supabase.from('stickers').upsert(rows, { onConflict: 'user_id,sticker_number' }),
      );
      if (error) {
        console.error('[useStickers] removeBatch upsert error, enqueuing:', error);
        for (const { num, prev, newState } of toUpsert) {
          enqueueOp(num, newState, prev, error.message);
        }
        syncError.value = null;
      }
    }

    if (toDelete.length > 0) {
      const nums = toDelete.map((r) => r.num);
      const { error } = await withAuthRetry(() =>
        supabase.from('stickers').delete().eq('user_id', user.value!.id).in('sticker_number', nums),
      );
      if (error) {
        console.error('[useStickers] removeBatch delete error, enqueuing:', error);
        for (const { num, prev } of toDelete) {
          enqueueOp(num, { owned: false, dupes: 0, note: '' }, prev, error.message);
        }
        syncError.value = null;
      }
    }

    return toUpsert.length + toDelete.length;
  } finally {
    sectionInFlight = false;
  }
}

// Marcar toda una seccion como owned — 1 bulk upsert
async function markSectionComplete(startsAt: number, count: number) {
  const { user } = useAuth();
  if (!user.value || sectionInFlight) return;
  sectionInFlight = true;

  try {
    if (!(await ensureFreshSession())) {
      syncError.value = 'Sesión expirada. Recarga la página.';
      return;
    }

    const toInsert: { num: number; prev: StickerState | undefined; note: string }[] = [];
    for (let i = 0; i < count; i++) {
      const num = startsAt + i;
      if (!stickers.value[num]?.owned) {
        toInsert.push({
          num,
          prev: stickers.value[num],
          note: stickers.value[num]?.note ?? '',
        });
      }
    }
    if (toInsert.length === 0) return;

    // Optimistic
    const newMap = { ...stickers.value };
    for (const { num, note } of toInsert) {
      newMap[num] = { owned: true, dupes: 0, note };
    }
    stickers.value = newMap;

    const rows = toInsert.map(({ num, note }) => ({
      user_id: user.value!.id,
      sticker_number: num,
      owned: true,
      dupes: 0,
      note: note || null,
    }));

    const { error } = await withAuthRetry(() =>
      supabase.from('stickers').upsert(rows, { onConflict: 'user_id,sticker_number' }),
    );

    if (error) {
      console.error('[useStickers] Bulk upsert error, enqueuing individually:', error);
      // Bulk fallo (probable timeout). NO revertimos — encolamos cada sticker
      // individualmente. Writes individuales pasan aunque el bulk timeoutee.
      for (const { num, prev, note } of toInsert) {
        enqueueOp(num, { owned: true, dupes: 0, note }, prev, error.message);
      }
      syncError.value = null;
      return;
    }

    syncError.value = null;
    // Push undo for section complete
    const { pushUndo } = useUndo();
    const snapshot = toInsert.map(({ num, prev }) => ({
      num,
      prev: prev ? { ...prev } : undefined,
    }));
    pushUndo(`${toInsert.length} laminas marcadas`, async () => {
      const revertMap = { ...stickers.value };
      for (const { num, prev } of snapshot) {
        if (prev) {
          revertMap[num] = prev;
        } else {
          delete revertMap[num];
        }
      }
      stickers.value = revertMap;
      // Persist the revert al servidor con retry + manejo de errores.
      const { user: userInner } = useAuth();
      if (!userInner.value) return;
      const toDelete = snapshot.filter((s) => !s.prev || !s.prev.owned);
      const toRestore = snapshot.filter((s) => s.prev && s.prev.owned);
      if (toDelete.length > 0) {
        const nums = toDelete.map((s) => s.num);
        const { error: delErr } = await withAuthRetry(() =>
          supabase
            .from('stickers')
            .delete()
            .eq('user_id', userInner.value!.id)
            .in('sticker_number', nums),
        );
        if (delErr) {
          console.error('[useStickers] Undo delete error:', delErr);
          syncError.value = friendlyErrorMessage(delErr);
        }
      }
      if (toRestore.length > 0) {
        const restoreRows = toRestore.map((s) => ({
          user_id: userInner.value!.id,
          sticker_number: s.num,
          owned: s.prev!.owned,
          dupes: s.prev!.dupes,
          note: s.prev!.note || null,
        }));
        const { error: upErr } = await withAuthRetry(() =>
          supabase.from('stickers').upsert(restoreRows, { onConflict: 'user_id,sticker_number' }),
        );
        if (upErr) {
          console.error('[useStickers] Undo upsert error:', upErr);
          syncError.value = friendlyErrorMessage(upErr);
        }
      }
    });
  } finally {
    sectionInFlight = false;
  }
}

// Borrar toda una seccion — 1 bulk delete
async function clearSection(startsAt: number, count: number) {
  const { user } = useAuth();
  if (!user.value || sectionInFlight) return;
  sectionInFlight = true;

  try {
    if (!(await ensureFreshSession())) {
      syncError.value = 'Sesión expirada. Recarga la página.';
      return;
    }

    const toRemove: { num: number; prev: StickerState }[] = [];
    for (let i = 0; i < count; i++) {
      const num = startsAt + i;
      const s = stickers.value[num];
      if (s) {
        toRemove.push({ num, prev: s });
      }
    }
    if (toRemove.length === 0) return;

    // Optimistic
    const newMap = { ...stickers.value };
    for (const { num } of toRemove) {
      delete newMap[num];
    }
    stickers.value = newMap;

    const nums = toRemove.map((r) => r.num);
    const { error } = await withAuthRetry(() =>
      supabase.from('stickers').delete().eq('user_id', user.value!.id).in('sticker_number', nums),
    );

    if (error) {
      console.error('[useStickers] Bulk delete error, enqueuing individually:', error);
      // Bulk fallo. NO revertimos — encolamos cada sticker con target=default
      // (que writeStickerToDb traduce a DELETE individual).
      for (const { num, prev } of toRemove) {
        enqueueOp(num, defaultState(), prev, error.message);
      }
      syncError.value = null;
    } else {
      syncError.value = null;
    }
  } finally {
    sectionInFlight = false;
  }
}

/**
 * Bulk import from CSV data.
 * @param data Map<stickerNumber, quantity> where 0=missing, 1=owned, 2+=owned+dupes
 * @param mode 'replace' wipes everything; 'merge' only updates diffs (preserves notes)
 * @returns number of stickers changed
 */
async function importBulk(data: Map<number, number>, mode: 'replace' | 'merge'): Promise<number> {
  const { user } = useAuth();
  if (!user.value || sectionInFlight) return 0;
  sectionInFlight = true;

  if (!(await ensureFreshSession())) {
    syncError.value = 'Sesión expirada. Recarga la página.';
    sectionInFlight = false;
    return 0;
  }

  const snapshot = { ...stickers.value };
  const newMap: Record<number, StickerState> = mode === 'replace' ? {} : { ...stickers.value };
  const upsertRows: {
    user_id: string;
    sticker_number: number;
    owned: boolean;
    dupes: number;
    note: string | null;
  }[] = [];
  const deleteNums: number[] = [];
  let changed = 0;

  for (const [num, qty] of data) {
    if (num < 1 || num > TOTAL_STICKERS) continue;
    const current = snapshot[num];
    const currentQty = current?.owned ? 1 + current.dupes : 0;

    if (qty > 0) {
      if (qty !== currentQty) {
        const note = mode === 'merge' ? (current?.note ?? '') : '';
        newMap[num] = { owned: true, dupes: qty - 1, note };
        upsertRows.push({
          user_id: user.value.id,
          sticker_number: num,
          owned: true,
          dupes: qty - 1,
          note: note || null,
        });
        changed++;
      } else if (mode === 'replace') {
        // Same qty but replace mode needs to keep it
        newMap[num] = current!;
      }
    } else if (currentQty > 0) {
      // CSV says 0 but we have it → delete
      delete newMap[num];
      deleteNums.push(num);
      changed++;
    }
  }

  // Replace mode: also delete stickers not in CSV
  if (mode === 'replace') {
    for (const numStr in snapshot) {
      const num = Number(numStr);
      if (!data.has(num) && snapshot[num]?.owned) {
        delete newMap[num];
        deleteNums.push(num);
        changed++;
      }
    }
  }

  if (changed === 0) {
    sectionInFlight = false;
    return 0;
  }

  // Optimistic update
  stickers.value = newMap;

  // En caso de fallo: en lugar de revertir TODO el import, encolamos cada
  // cambio individualmente — la queue los reintenta y el optimistic se mantiene.
  function enqueueAllFromImport(errMsg: string) {
    for (const row of upsertRows) {
      enqueueOp(
        row.sticker_number,
        { owned: row.owned, dupes: row.dupes, note: row.note ?? '' },
        snapshot[row.sticker_number],
        errMsg,
      );
    }
    for (const num of deleteNums) {
      enqueueOp(num, defaultState(), snapshot[num], errMsg);
    }
  }

  try {
    if (upsertRows.length > 0) {
      const { error } = await withAuthRetry(() =>
        supabase.from('stickers').upsert(upsertRows, { onConflict: 'user_id,sticker_number' }),
      );
      if (error) {
        console.error('[useStickers] importBulk upsert error, enqueuing individually:', error);
        enqueueAllFromImport(error.message);
        syncError.value = null;
        return changed;
      }
    }

    if (deleteNums.length > 0) {
      const { error } = await withAuthRetry(() =>
        supabase
          .from('stickers')
          .delete()
          .eq('user_id', user.value!.id)
          .in('sticker_number', deleteNums),
      );
      if (error) {
        console.error('[useStickers] importBulk delete error, enqueuing individually:', error);
        // Solo encolamos los deletes (los upserts ya pasaron si llegamos aca).
        for (const num of deleteNums) {
          enqueueOp(num, defaultState(), snapshot[num], error.message);
        }
        syncError.value = null;
        return changed;
      }
    }

    syncError.value = null;
    return changed;
  } finally {
    sectionInFlight = false;
  }
}

// Botón "−": baja dupes de a 1, si es ×1 quita la lámina
function decrementSticker(stickerNumber: number) {
  // Sin check de inFlight: setSticker reconcilia si hay un write en vuelo.
  const current = stickers.value[stickerNumber] ?? defaultState();
  if (!current.owned) return;
  const prevState = { ...current };
  const { pushUndo } = useUndo();

  if (current.dupes > 0) {
    setSticker(stickerNumber, { ...current, dupes: current.dupes - 1 });
    pushUndo('1 repetida quitada', () => {
      setSticker(stickerNumber, prevState, true);
    });
  } else {
    setSticker(stickerNumber, { owned: false, dupes: 0, note: '' });
    pushUndo('1 lamina quitada', () => {
      setSticker(stickerNumber, prevState, true);
    });
  }
}

function adjustDupes(stickerNumber: number, delta: number) {
  const current = stickers.value[stickerNumber] ?? defaultState();
  if (!current.owned) return;
  const newDupes = Math.max(0, current.dupes + delta);
  setSticker(stickerNumber, { ...current, dupes: newDupes });
}

function setNote(stickerNumber: number, note: string) {
  const current = stickers.value[stickerNumber] ?? defaultState();
  setSticker(stickerNumber, { ...current, note: note.trim() });
}

// Watcher singleton — se registra una sola vez a nivel de modulo
let watcherSetUp = false;

// Re-cargar stickers cuando el usuario vuelve al tab
function setupVisibilityReload() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && currentUserId && loaded.value) {
      loadStickers(currentUserId, true);
    }
  });
}

const stats = computed(() => {
  let owned = 0;
  let dupes = 0;
  let withNotes = 0;
  for (const key in stickers.value) {
    const s = stickers.value[key];
    if (s.owned) owned++;
    if (s.owned && s.dupes > 0) dupes += s.dupes;
    if (s.note) withNotes++;
  }
  return {
    owned,
    missing: TOTAL_STICKERS - owned,
    dupes,
    withNotes,
    pct: Math.round((owned / TOTAL_STICKERS) * 100 * 10) / 10,
  };
});

export function useStickers() {
  // Registrar watcher solo una vez
  if (!watcherSetUp) {
    watcherSetUp = true;
    const { user } = useAuth();

    // Auto-load cuando el user cambia
    watch(
      user,
      (newUser) => {
        if (newUser) {
          // Cargar primero la queue persistida (sync ops pendientes del session anterior),
          // luego los stickers — loadStickers aplica el optimistic encima.
          currentUserId = newUser.id;
          loadQueue(newUser.id);
          loadStickers(newUser.id);
        } else {
          stickers.value = {};
          loaded.value = false;
          currentUserId = null;
          pendingOps.value = new Map();
          if (retryTimer) {
            clearTimeout(retryTimer);
            retryTimer = null;
          }
        }
      },
      { immediate: true },
    );

    setupVisibilityReload();
  }

  return {
    stickers: readonly(stickers),
    loading: readonly(loading),
    loaded: readonly(loaded),
    syncError: readonly(syncError),
    sessionDead,
    stats,
    // Sync queue API
    pendingOps: readonly(pendingOps),
    pendingCount,
    failedCount,
    getStickerSyncStatus,
    retryAllPending,
    discardAllPending,
    discardOne,
    getSticker: (n: number): StickerState => stickers.value[n] ?? defaultState(),
    cycleSticker: cycleSticker as (n: number, skipUndo?: boolean) => void,
    setSticker,
    adjustDupes,
    removeSticker,
    markSectionComplete,
    clearSection,
    addBatch,
    removeBatch,
    setNote,
    importBulk,
    decrementSticker,
  };
}
