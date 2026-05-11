<script setup lang="ts">
import { ref, computed } from 'vue';
import { useStickers } from '@/composables/useStickers';
import { TOTAL_STICKERS } from '@/lib/albumData';
import { generateCsv, parseCsv, CsvParseError } from '@/lib/csvUtils';

const emit = defineEmits<{
  close: [];
  imported: [count: number];
}>();

const { stickers, importBulk } = useStickers();

const view = ref<'menu' | 'preview'>('menu');
const importMode = ref<'merge' | 'replace'>('merge');
const pendingData = ref<Map<number, number> | null>(null);
const parseWarnings = ref<string[]>([]);
const importing = ref(false);
const error = ref('');

// ── Export ──

function handleExport() {
  const csv = generateCsv(stickers.value as Record<number, any>);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `quemefalta-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Import ──

function handleFileSelect(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  error.value = '';

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const result = parseCsv(reader.result as string);
      pendingData.value = result.data;
      parseWarnings.value = result.warnings;
      view.value = 'preview';
    } catch (e) {
      error.value = e instanceof CsvParseError ? e.message : 'Error leyendo el archivo';
    }
  };
  reader.readAsText(file);
}

const diff = computed(() => {
  if (!pendingData.value) return null;
  let toOwn = 0;
  let toRemove = 0;
  let toChange = 0;
  let unchanged = 0;

  for (let n = 1; n <= TOTAL_STICKERS; n++) {
    const current = stickers.value[n];
    const csvQty = pendingData.value.get(n) ?? 0;
    const currentQty = current?.owned ? 1 + current.dupes : 0;

    if (importMode.value === 'merge') {
      // Merge: only act on stickers present in CSV
      if (!pendingData.value.has(n)) {
        unchanged++;
      } else if (csvQty > 0 && currentQty === 0) {
        toOwn++;
      } else if (csvQty === 0 && currentQty > 0) {
        toRemove++;
      } else if (csvQty !== currentQty) {
        toChange++;
      } else {
        unchanged++;
      }
    } else {
      // Replace: full comparison
      if (csvQty > 0 && currentQty === 0) toOwn++;
      else if (csvQty === 0 && currentQty > 0) toRemove++;
      else if (csvQty !== currentQty) toChange++;
      else unchanged++;
    }
  }

  return { toOwn, toRemove, toChange, unchanged, total: toOwn + toRemove + toChange };
});

async function handleImport() {
  if (!pendingData.value || !diff.value || diff.value.total === 0) return;
  importing.value = true;
  error.value = '';

  try {
    const count = await importBulk(pendingData.value, importMode.value);
    emit('imported', count);
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error importando';
  } finally {
    importing.value = false;
  }
}

function resetToMenu() {
  view.value = 'menu';
  pendingData.value = null;
  parseWarnings.value = [];
  error.value = '';
}
</script>

<template>
  <div class="modal-bg" @click="$emit('close')" @keydown.escape="$emit('close')">
    <div class="modal" @click.stop>
      <!-- Menu view -->
      <template v-if="view === 'menu'">
        <div class="modal-title">EXPORTAR / IMPORTAR</div>
        <p class="modal-desc">
          CSV en formato grilla: 49 secciones × 20 láminas.<br />
          0 = falta, 1 = tengo, 2+ = repetidas.
        </p>

        <button class="csv-btn csv-btn-primary" @click="handleExport">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Descargar CSV
        </button>

        <div class="csv-divider">
          <span>o</span>
        </div>

        <label class="csv-btn csv-btn-secondary csv-file-label">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          Importar CSV
          <input type="file" accept=".csv,text/csv" class="csv-file-input" @change="handleFileSelect" />
        </label>

        <div v-if="error" class="csv-error" role="alert">{{ error }}</div>
      </template>

      <!-- Preview view -->
      <template v-else-if="view === 'preview' && diff">
        <div class="modal-title">VISTA PREVIA</div>

        <div class="csv-diff">
          <div v-if="diff.toOwn > 0" class="csv-diff-row csv-diff-add">
            +{{ diff.toOwn }} nuevas
          </div>
          <div v-if="diff.toRemove > 0" class="csv-diff-row csv-diff-remove">
            -{{ diff.toRemove }} a quitar
          </div>
          <div v-if="diff.toChange > 0" class="csv-diff-row csv-diff-change">
            ~{{ diff.toChange }} cambios de cantidad
          </div>
          <div class="csv-diff-row csv-diff-same">
            {{ diff.unchanged }} sin cambios
          </div>
        </div>

        <div v-if="parseWarnings.length > 0" class="csv-warnings">
          <details>
            <summary>{{ parseWarnings.length }} advertencia{{ parseWarnings.length > 1 ? 's' : '' }}</summary>
            <ul>
              <li v-for="(w, i) in parseWarnings" :key="i">{{ w }}</li>
            </ul>
          </details>
        </div>

        <!-- Mode selector -->
        <div class="csv-mode">
          <button
            :class="['csv-mode-btn', { 'csv-mode-active': importMode === 'merge' }]"
            @click="importMode = 'merge'"
          >
            Combinar
          </button>
          <button
            :class="['csv-mode-btn', { 'csv-mode-active': importMode === 'replace' }]"
            @click="importMode = 'replace'"
          >
            Reemplazar
          </button>
        </div>
        <p class="csv-mode-hint">
          <template v-if="importMode === 'merge'">
            Solo actualiza lo que difiere. Las notas existentes se conservan.
          </template>
          <template v-else>
            Reemplaza todo el álbum. <strong>Las notas se pierden.</strong>
          </template>
        </p>

        <div v-if="error" class="csv-error" role="alert">{{ error }}</div>

        <div class="csv-actions">
          <button class="csv-btn csv-btn-ghost" @click="resetToMenu">Cancelar</button>
          <button
            class="csv-btn csv-btn-primary"
            :disabled="importing || diff.total === 0"
            @click="handleImport"
          >
            {{ importing ? 'Importando...' : `Importar ${diff.total} cambios` }}
          </button>
        </div>
      </template>

      <button class="close-btn" @click="$emit('close')">CERRAR</button>
    </div>
  </div>
</template>

<style scoped>
.modal-bg {
  position: fixed;
  inset: 0;
  background: rgba(12, 18, 32, 0.75);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  z-index: 100;
  animation: fadeIn 0.15s ease-out;
}
.modal {
  background: var(--paper);
  color: var(--ink);
  width: 100%;
  max-width: 420px;
  border-radius: 14px;
  padding: 26px 22px;
  box-shadow: 0 30px 60px rgba(0, 0, 0, 0.5);
  animation: popIn 0.2s ease-out;
  font-family: var(--body);
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes popIn {
  from { opacity: 0; transform: translateY(10px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
.modal-title {
  font-family: var(--display);
  font-size: 26px;
  letter-spacing: 0.04em;
  margin-bottom: 12px;
  color: var(--pitch);
}
.modal-desc {
  font-size: 13px;
  line-height: 1.5;
  color: var(--ink-soft);
  margin: 0 0 18px;
}

/* Buttons */
.csv-btn {
  width: 100%;
  padding: 14px 0;
  font-weight: 700;
  font-size: 14px;
  letter-spacing: 0.04em;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-family: inherit;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  transition: all 0.15s;
}
.csv-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.csv-btn-primary {
  background: var(--pitch);
  color: var(--paper);
}
.csv-btn-primary:hover:not(:disabled) {
  background: var(--pitch-deep);
}
.csv-btn-secondary {
  background: var(--paper);
  border: 1.5px solid var(--paper-deep);
  color: var(--pitch);
}
.csv-btn-secondary:hover {
  background: rgba(0, 0, 0, 0.03);
}
.csv-btn-ghost {
  background: transparent;
  color: var(--ink-soft);
  padding: 10px 0;
}
.csv-btn-ghost:hover {
  color: var(--pitch);
}

/* File input hidden */
.csv-file-label {
  cursor: pointer;
  position: relative;
}
.csv-file-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

/* Divider */
.csv-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 14px 0;
}
.csv-divider::before,
.csv-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--paper-deep);
}
.csv-divider span {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--ink-soft);
  letter-spacing: 0.1em;
}

/* Error */
.csv-error {
  background: rgba(239, 83, 80, 0.1);
  border: 1px solid rgba(239, 83, 80, 0.3);
  border-radius: 6px;
  padding: 10px 14px;
  margin-top: 12px;
  font-size: 12px;
  color: var(--coral);
}

/* Diff */
.csv-diff {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}
.csv-diff-row {
  font-family: var(--mono);
  font-size: 12px;
  font-weight: 700;
  padding: 6px 12px;
  border-radius: 6px;
}
.csv-diff-add {
  background: rgba(52, 211, 153, 0.12);
  color: #34d399;
}
.csv-diff-remove {
  background: rgba(239, 83, 80, 0.12);
  color: var(--coral);
}
.csv-diff-change {
  background: rgba(251, 191, 36, 0.12);
  color: #fbbf24;
}
.csv-diff-same {
  background: rgba(0, 0, 0, 0.04);
  color: var(--ink-soft);
}

/* Warnings */
.csv-warnings {
  margin-bottom: 14px;
}
.csv-warnings details {
  font-size: 12px;
  color: var(--ink-soft);
}
.csv-warnings summary {
  cursor: pointer;
  font-weight: 600;
  color: #fbbf24;
  margin-bottom: 6px;
}
.csv-warnings ul {
  margin: 0;
  padding: 0 0 0 18px;
  max-height: 100px;
  overflow-y: auto;
}
.csv-warnings li {
  margin-bottom: 2px;
  font-family: var(--mono);
  font-size: 10px;
}

/* Mode selector */
.csv-mode {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}
.csv-mode-btn {
  flex: 1;
  padding: 10px 0;
  background: var(--paper);
  border: 1.5px solid var(--paper-deep);
  border-radius: 8px;
  font-size: 13px;
  font-weight: 700;
  color: var(--ink-soft);
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
}
.csv-mode-active {
  border-color: var(--pitch);
  color: var(--pitch);
  background: rgba(0, 0, 0, 0.03);
}
.csv-mode-hint {
  font-size: 11px;
  color: var(--ink-soft);
  line-height: 1.4;
  margin: 0 0 16px;
}
.csv-mode-hint strong {
  color: var(--coral);
}

/* Actions row */
.csv-actions {
  display: flex;
  gap: 8px;
}
.csv-actions .csv-btn-ghost {
  width: auto;
  flex-shrink: 0;
}
.csv-actions .csv-btn-primary {
  flex: 1;
}

/* Close */
.close-btn {
  width: 100%;
  padding: 8px 0;
  margin-top: 12px;
  background: transparent;
  border: none;
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.18em;
  color: var(--ink-soft);
  cursor: pointer;
}
.close-btn:hover {
  color: var(--pitch);
}
</style>
