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

  console.log(`[SyncQueue] retrying ${due.length} ops`);

  let anyChanged = false;
  for (const op of due) {
    const error = await writeStickerToDb(user.value.id, op.stickerNumber, op.targetState);
    if (!error) {
      console.log(`[SyncQueue] ✓ ${op.stickerNumber} after ${op.attempts} attempts`);
      pendingOps.value.delete(op.stickerNumber);
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
  scheduleNextRetry();
}

function enqueueOp(
  stickerNumber: number,
  targetState: StickerState,
  prevState: StickerState | undefined,
  errMsg: string,
) {
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

function retryAllPending() {
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
    syncError.value = error.message;
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

// Upsert con optimistic update + sync queue.
// Si el primer write falla por error transitorio, NO revertimos: encolamos para
// retry en background. La lamina queda visualmente marcada con su estado nuevo
// y un indicador de "pendiente" (consumido por la UI via getStickerSyncStatus).
async function setSticker(stickerNumber: number, newState: StickerState, _force = false) {
  const { user } = useAuth();
  if (!user.value) return;

  // Si la lamina ya esta en la sync queue, no hacemos un write nuevo: solo
  // actualizamos el target de la queue. El background runner se encarga.
  // prevState ORIGINAL se preserva para que discard pueda revertir al estado
  // real previo a TODAS las ediciones pendientes sobre esta lamina.
  const queued = pendingOps.value.get(stickerNumber);
  if (queued) {
    // Aplicar optimistic — borrar entrada si default, sino set.
    if (!newState.owned && newState.dupes === 0 && !newState.note) {
      const m = { ...stickers.value };
      delete m[stickerNumber];
      stickers.value = m;
    } else {
      stickers.value = { ...stickers.value, [stickerNumber]: newState };
    }
    queued.targetState = newState;
    queued.attempts = 0; // que el proximo runDueRetries lo intente con backoff 2s
    queued.lastAttemptAt = Date.now();
    queued.lastError = null;
    queued.status = 'pending';
    pendingOps.value = new Map(pendingOps.value);
    persistQueue();
    scheduleNextRetry();
    return;
  }

  // Mutex por sticker. Si hay una operacion en vuelo:
  // - tap normal (force=false): ignoramos para no romper la UI con doble tap
  // - undo (force=true): esperamos a que termine la original
  const existing = inFlight.get(stickerNumber);
  if (existing) {
    if (!_force) return;
    await existing;
  }

  // Claim el slot
  let opResolve: () => void = () => {};
  const opPromise = new Promise<void>((r) => {
    opResolve = r;
  });
  inFlight.set(stickerNumber, opPromise);

  const previousState = stickers.value[stickerNumber];

  try {
    const fresh = await ensureFreshSession();
    if (!fresh) {
      // sessionDead: la maneja el modal global, no la queue.
      syncError.value = 'Sesión expirada. Recarga la página.';
      return;
    }

    // Optimistic. Si el state es default, borramos la entrada del map (asi
    // stickers.value[n] === undefined y stats lo cuenta como no-owned).
    if (!newState.owned && newState.dupes === 0 && !newState.note) {
      const m = { ...stickers.value };
      delete m[stickerNumber];
      stickers.value = m;
    } else {
      stickers.value = { ...stickers.value, [stickerNumber]: newState };
    }

    const error = await writeStickerToDb(user.value.id, stickerNumber, newState);

    if (!error) {
      syncError.value = null;
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

    // Error transitorio (timeout, red, server) → encolar. NO revertimos el optimistic.
    console.warn(`[setSticker] ${stickerNumber} write failed, enqueuing for retry:`, error.message);
    enqueueOp(stickerNumber, newState, previousState, error.message);
  } finally {
    inFlight.delete(stickerNumber);
    opResolve();
  }
}

// Tap: vacio → owned → ×2 → ×3 (se queda en ×3, para quitar usar modal)
function cycleSticker(stickerNumber: number, _skipUndo = false) {
  if (inFlight.has(stickerNumber)) return;
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
        // Not owned yet → mark owned, extra copies become dupes
        toUpsert.push({
          num,
          prev: existing,
          newState: { owned: true, dupes: count - 1, note: existing?.note ?? '' },
        });
      } else if (count > 1) {
        // Already owned, but input has duplicates → add those as extra dupes
        toUpsert.push({
          num,
          prev: existing,
          newState: { ...existing, dupes: existing.dupes + (count - 1) },
        });
      }
      // If already owned and count === 1, nothing to do
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
      console.error('[useStickers] Batch add error:', error);
      const revertMap = { ...stickers.value };
      for (const { num, prev } of toUpsert) {
        if (prev) {
          revertMap[num] = prev;
        } else {
          delete revertMap[num];
        }
      }
      stickers.value = revertMap;
      syncError.value = error.message;
      return 0;
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
      console.error('[useStickers] Bulk upsert error:', error);
      const revertMap = { ...stickers.value };
      for (const { num, prev } of toInsert) {
        if (prev) {
          revertMap[num] = prev;
        } else {
          delete revertMap[num];
        }
      }
      stickers.value = revertMap;
      syncError.value = error.message;
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
          syncError.value = delErr.message;
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
          syncError.value = upErr.message;
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
      console.error('[useStickers] Bulk delete error:', error);
      const revertMap = { ...stickers.value };
      for (const { num, prev } of toRemove) {
        revertMap[num] = prev;
      }
      stickers.value = revertMap;
      syncError.value = error.message;
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

  const revert = () => {
    stickers.value = snapshot;
  };

  try {
    if (upsertRows.length > 0) {
      const { error } = await withAuthRetry(() =>
        supabase.from('stickers').upsert(upsertRows, { onConflict: 'user_id,sticker_number' }),
      );
      if (error) {
        console.error('[useStickers] importBulk upsert error:', error);
        revert();
        syncError.value = error.message;
        return 0;
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
        console.error('[useStickers] importBulk delete error:', error);
        revert();
        syncError.value = error.message;
        return 0;
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
  if (inFlight.has(stickerNumber)) return;
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
    setNote,
    importBulk,
    decrementSticker,
  };
}
