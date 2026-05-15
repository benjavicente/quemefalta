<script setup lang="ts">
import { ref, computed } from 'vue';
import { ALBUM_SECTIONS, stickerNumberFromCode, codeForSticker } from '@/lib/albumData';
import { useStickers } from '@/composables/useStickers';

const emit = defineEmits<{
  remove: [numbers: number[]];
  close: [];
}>();

const { stickers } = useStickers();

const input = ref('');
const error = ref('');

const sectionByCode = new Map(ALBUM_SECTIONS.map((s) => [s.code, s]));

/** Mismo parser que BatchInput. Acepta MEX, MEX5, MEX1-MEX5, "MEX 1 5 8". */
function parseInput(raw: string): number[] {
  const nums: number[] = [];
  const lines = raw.split(/\n/).filter(Boolean);

  for (const line of lines) {
    const prefixLine = line.trim().match(/^([A-Za-z]{2,5})\s*[:.]?\s+(.+)$/);
    if (prefixLine) {
      const prefix = prefixLine[1].toUpperCase();
      if (sectionByCode.has(prefix)) {
        const rest = prefixLine[2];
        const parts = rest.split(/[,;\s]+/).filter(Boolean);
        for (const p of parts) {
          const range = p.match(/^(\d+)\s*[-–]\s*(\d+)$/);
          if (range) {
            const start = parseInt(range[1]);
            const end = parseInt(range[2]);
            if (start <= end && end - start < 100) {
              for (let i = start; i <= end; i++) {
                const n = stickerNumberFromCode(`${prefix}${i}`);
                if (n !== undefined) nums.push(n);
              }
            }
            continue;
          }
          const num = parseInt(p);
          if (!isNaN(num)) {
            const n = stickerNumberFromCode(`${prefix}${num}`);
            if (n !== undefined) nums.push(n);
          }
        }
        continue;
      }
    }

    const parts = line.split(/[,;\s]+/).filter(Boolean);
    for (const p of parts) {
      const codeRange = p.match(/^([A-Za-z]+)(\d+)\s*[-–]\s*([A-Za-z]+)(\d+)$/);
      if (codeRange) {
        const [, prefix1, num1, prefix2, num2] = codeRange;
        if (prefix1.toUpperCase() === prefix2.toUpperCase()) {
          const start = parseInt(num1);
          const end = parseInt(num2);
          if (start <= end && end - start < 100) {
            for (let i = start; i <= end; i++) {
              const n = stickerNumberFromCode(`${prefix1}${i}`);
              if (n !== undefined) nums.push(n);
            }
          }
        }
        continue;
      }

      const teamOnly = p.match(/^([A-Za-z]{2,5})$/);
      if (teamOnly) {
        const sec = sectionByCode.get(teamOnly[1].toUpperCase());
        if (sec) {
          for (let i = 0; i < sec.count; i++) nums.push(sec.startsAt + i);
          continue;
        }
      }

      const codeMatch = p.match(/^[A-Za-z]+\d+$/);
      if (codeMatch) {
        const n = stickerNumberFromCode(p);
        if (n !== undefined) nums.push(n);
        continue;
      }

      const n = parseInt(p);
      if (
        !isNaN(n) &&
        n >= 1 &&
        n <=
          ALBUM_SECTIONS[ALBUM_SECTIONS.length - 1].startsAt +
            ALBUM_SECTIONS[ALBUM_SECTIONS.length - 1].count -
            1
      ) {
        nums.push(n);
      }
    }
  }
  return nums.sort((a, b) => a - b);
}

/**
 * Desglose contra el estado actual:
 * - unmarkedCount: cuántas pasan de owned → no-owned (todas las copias quitadas)
 * - decrementCount: cuántas repetidas se quitan (la lámina sigue marcada)
 * - skippedCount: cuántas apariciones no aplicaron (sticker no marcado)
 */
const breakdown = computed(() => {
  const nums = parseInput(input.value);
  if (nums.length === 0) {
    return {
      unmarkedCount: 0,
      decrementCount: 0,
      skippedCount: 0,
      total: 0,
      unmarkedCodes: [] as string[],
      decrementCodes: [] as string[],
      skippedCodes: [] as string[],
    };
  }

  const counts = new Map<number, number>();
  for (const n of nums) counts.set(n, (counts.get(n) || 0) + 1);

  const ordered = [...counts.entries()].sort(([a], [b]) => a - b);

  let unmarkedCount = 0;
  let decrementCount = 0;
  let skippedCount = 0;
  const unmarkedCodes: string[] = [];
  const decrementCodes: string[] = [];
  const skippedCodes: string[] = [];

  for (const [num, count] of ordered) {
    const existing = stickers.value[num];
    const code = codeForSticker(num);

    if (!existing?.owned) {
      skippedCount += count;
      skippedCodes.push(count > 1 ? `${code} (×${count})` : code);
      continue;
    }
    const totalCopies = 1 + existing.dupes;
    const removed = Math.min(count, totalCopies);
    const remaining = totalCopies - removed;

    if (remaining === 0) {
      unmarkedCount++;
      unmarkedCodes.push(code);
      // Las copias extra que también se quitan en la misma lámina
      const extraRemoved = removed - 1;
      if (extraRemoved > 0) {
        decrementCount += extraRemoved;
        decrementCodes.push(extraRemoved > 1 ? `${code} (−${extraRemoved})` : code);
      }
    } else {
      decrementCount += removed;
      decrementCodes.push(removed > 1 ? `${code} (−${removed})` : code);
    }
    if (count > removed) {
      skippedCount += count - removed;
      skippedCodes.push(count - removed > 1 ? `${code} (×${count - removed})` : code);
    }
  }

  return {
    unmarkedCount,
    decrementCount,
    skippedCount,
    total: unmarkedCount + decrementCount,
    unmarkedCodes,
    decrementCodes,
    skippedCodes,
  };
});

function addTeamCode(code: string) {
  const current = input.value.trim();
  input.value = current ? `${current}, ${code}` : code;
}

function handleRemove() {
  const nums = parseInput(input.value);
  if (nums.length === 0) {
    error.value = 'No se encontraron láminas válidas';
    return;
  }
  error.value = '';
  emit('remove', nums);
  input.value = '';
}
</script>

<template>
  <div class="bi-bg">
    <div class="bi" @click.stop>
      <div class="bi-head">
        <div>
          <div class="bi-label bi-label-remove">QUITAR LÁMINAS</div>
          <div class="bi-title">Egreso rápido</div>
        </div>
        <button class="bi-close" aria-label="Cerrar" @click="emit('close')">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <p class="bi-hint">
        Cada vez que escribes un código, se resta 1 copia. Si llega a 0 la lámina queda como
        faltante. Códigos no marcados se ignoran.
      </p>

      <div class="bi-teams">
        <button
          v-for="code in ['FWC', 'MEX', 'ARG', 'BRA', 'ESP', 'ENG', 'GER', 'FRA']"
          :key="code"
          class="bi-team-chip"
          @click="addTeamCode(code)"
        >
          {{ code }}
        </button>
      </div>

      <textarea
        v-model="input"
        class="bi-input"
        aria-label="Códigos de láminas a quitar"
        placeholder="Ej: MEX5, ARG1&#10;o repite para quitar varias copias: MEX5 MEX5"
        rows="3"
        autofocus
        @keydown.enter.ctrl="handleRemove"
        @keydown.enter.meta="handleRemove"
      />
      <div v-if="error" class="bi-error" role="alert">{{ error }}</div>

      <div v-if="breakdown.total > 0 || breakdown.skippedCount > 0" class="bi-preview-card">
        <div v-if="breakdown.unmarkedCount > 0" class="bi-preview-block">
          <div class="bi-preview-row">
            <span class="bi-preview-num bi-preview-num-unmark">−{{ breakdown.unmarkedCount }}</span>
            <span class="bi-preview-label">
              {{ breakdown.unmarkedCount === 1 ? 'desmarcada' : 'desmarcadas' }}
              <span class="bi-preview-meta">(1 → 0, vuelve a faltante)</span>
            </span>
          </div>
          <div class="bi-preview-codes bi-preview-codes-unmark">
            {{ breakdown.unmarkedCodes.join(', ') }}
          </div>
        </div>
        <div v-if="breakdown.decrementCount > 0" class="bi-preview-block">
          <div class="bi-preview-row">
            <span class="bi-preview-num bi-preview-num-decrement">−{{ breakdown.decrementCount }}</span>
            <span class="bi-preview-label">
              {{ breakdown.decrementCount === 1 ? 'repetida' : 'repetidas' }} menos
              <span class="bi-preview-meta">(sigue marcada como tuya)</span>
            </span>
          </div>
          <div class="bi-preview-codes bi-preview-codes-decrement">
            {{ breakdown.decrementCodes.join(', ') }}
          </div>
        </div>
        <div v-if="breakdown.skippedCount > 0" class="bi-preview-block bi-preview-block-skip">
          <div class="bi-preview-row bi-preview-row-skip">
            <span class="bi-preview-num bi-preview-num-skip">{{ breakdown.skippedCount }}</span>
            <span class="bi-preview-label">
              {{ breakdown.skippedCount === 1 ? 'ignorada' : 'ignoradas' }}
              <span class="bi-preview-meta">(no las tenías)</span>
            </span>
          </div>
          <div class="bi-preview-codes bi-preview-codes-skip">
            {{ breakdown.skippedCodes.join(', ') }}
          </div>
        </div>
      </div>

      <div class="bi-footer">
        <button class="bi-btn bi-btn-remove" :disabled="breakdown.total === 0" @click="handleRemove">
          Quitar
          <span v-if="breakdown.total > 0" class="bi-btn-count">{{ breakdown.total }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bi-bg {
  position: fixed;
  inset: 0;
  background: rgba(12, 18, 32, 0.75);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 20px;
  animation: fadeIn 0.12s ease-out;
}
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
.bi {
  background: #141c2b;
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 22px 20px;
  max-width: 440px;
  width: 100%;
  box-shadow: 0 30px 60px rgba(0, 0, 0, 0.5);
  color: var(--chalk);
}
.bi-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}
.bi-label {
  font-family: var(--mono);
  font-size: 9px;
  letter-spacing: 0.18em;
  color: var(--gold);
  margin-bottom: 4px;
}
.bi-label-remove {
  color: var(--coral);
}
.bi-title {
  font-family: var(--display);
  font-size: 24px;
  letter-spacing: 0.04em;
}
.bi-close {
  background: transparent;
  border: none;
  color: rgba(246, 241, 225, 0.5);
  font-size: 16px;
  cursor: pointer;
  padding: 4px;
}
.bi-hint {
  font-size: 12px;
  color: rgba(246, 241, 225, 0.6);
  line-height: 1.5;
  margin: 0 0 12px;
}
.bi-teams {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}
.bi-team-chip {
  padding: 5px 10px;
  border-radius: 100px;
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  background: rgba(246, 241, 225, 0.04);
  color: var(--chalk);
  border: 1px solid var(--line);
  cursor: pointer;
  transition: all 0.12s;
}
.bi-team-chip:hover {
  border-color: var(--coral);
  color: var(--coral);
  background: rgba(226, 90, 58, 0.08);
}
.bi-input {
  width: 100%;
  padding: 12px 14px;
  font-family: var(--mono);
  font-size: 14px;
  background: rgba(246, 241, 225, 0.04);
  border: 1px solid var(--line);
  border-radius: 8px;
  color: var(--chalk);
  resize: none;
  outline: none;
  line-height: 1.5;
}
.bi-input:focus {
  border-color: var(--coral);
}
.bi-input::placeholder {
  color: rgba(246, 241, 225, 0.3);
}
.bi-error {
  font-size: 11px;
  color: var(--coral);
  margin-top: 6px;
}
.bi-preview-card {
  margin-top: 12px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: rgba(246, 241, 225, 0.02);
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 220px;
  overflow-y: auto;
}
.bi-preview-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.bi-preview-block-skip {
  opacity: 0.7;
}
.bi-preview-codes {
  font-family: var(--mono);
  font-size: 10px;
  line-height: 1.5;
  padding-left: 48px;
  word-break: break-word;
}
.bi-preview-codes-unmark {
  color: var(--coral);
}
.bi-preview-codes-decrement {
  color: var(--gold);
}
.bi-preview-codes-skip {
  color: rgba(246, 241, 225, 0.45);
}
.bi-preview-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
  font-size: 13px;
  color: var(--chalk);
}
.bi-preview-row-skip {
  opacity: 0.65;
}
.bi-preview-num {
  font-family: var(--display);
  font-size: 20px;
  line-height: 1;
  min-width: 38px;
}
.bi-preview-num-unmark {
  color: var(--coral);
}
.bi-preview-num-decrement {
  color: var(--gold);
}
.bi-preview-num-skip {
  color: rgba(246, 241, 225, 0.5);
}
.bi-preview-label {
  display: flex;
  flex-direction: column;
  gap: 2px;
  line-height: 1.2;
}
.bi-preview-meta {
  font-family: var(--mono);
  font-size: 10px;
  color: rgba(246, 241, 225, 0.4);
  letter-spacing: 0.02em;
}
.bi-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-top: 14px;
  gap: 12px;
}
.bi-btn {
  padding: 12px 22px;
  border: none;
  border-radius: 8px;
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.bi-btn-remove {
  background: var(--coral);
  color: white;
}
.bi-btn-remove:not(:disabled):hover {
  background: #c94a30;
}
.bi-btn-count {
  font-family: var(--mono);
  font-size: 11px;
  background: rgba(0, 0, 0, 0.18);
  padding: 2px 7px;
  border-radius: 100px;
}
.bi-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
