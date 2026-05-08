<script setup lang="ts">
import { ref } from 'vue';
import { ALBUM_SECTIONS, stickerNumberFromCode } from '@/lib/albumData';

const emit = defineEmits<{
  add: [numbers: number[]];
  close: [];
}>();

const input = ref('');
const error = ref('');

// Build a set of valid section codes for quick lookup
const sectionByCode = new Map(ALBUM_SECTIONS.map((s) => [s.code, s]));

/**
 * Parse sticker input — accepts:
 * - Full team code (no number): MEX → all 20 stickers for México
 * - Codes: MEX5, ARG1, FWC12
 * - Code ranges: MEX1-MEX10, ARG5-ARG15
 * - Bare numbers within a code context: MEX 1 5 8 → MEX1, MEX5, MEX8
 */
function parseInput(raw: string): number[] {
  const nums: number[] = [];

  // First, preprocess: detect lines/groups like "MEX 1 5 8 12" or "MEX: 1, 5, 8"
  // Split by newline first, then process each line
  const lines = raw.split(/\n/).filter(Boolean);

  for (const line of lines) {
    // Check if line starts with a team prefix followed by numbers
    // e.g. "MEX 1 5 8 12" or "MEX: 1, 5, 8" or "ARG 3-10"
    const prefixLine = line.trim().match(/^([A-Za-z]{2,5})\s*[:.]?\s+(.+)$/);
    if (prefixLine) {
      const prefix = prefixLine[1].toUpperCase();
      if (sectionByCode.has(prefix)) {
        // Parse the rest as numbers/ranges within this prefix
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

    // Otherwise, split by comma/space/semicolon and parse each token
    const parts = line.split(/[,;\s]+/).filter(Boolean);
    for (const p of parts) {
      // Code range: MEX1-MEX10
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

      // Full team code without number: MEX → all 20 stickers
      const teamOnly = p.match(/^([A-Za-z]{2,5})$/);
      if (teamOnly) {
        const sec = sectionByCode.get(teamOnly[1].toUpperCase());
        if (sec) {
          for (let i = 0; i < sec.count; i++) {
            nums.push(sec.startsAt + i);
          }
          continue;
        }
      }

      // Single code: MEX5, ARG1
      const codeMatch = p.match(/^[A-Za-z]+\d+$/);
      if (codeMatch) {
        const n = stickerNumberFromCode(p);
        if (n !== undefined) nums.push(n);
        continue;
      }

      // Single number (for backwards compat)
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
  // Keep duplicates — they become extra copies (dupes)
  return nums.sort((a, b) => a - b);
}

/** Summary of parsed result for preview display */
function parseSummary(raw: string) {
  const nums = parseInput(raw);
  const total = nums.length;
  const unique = new Set(nums).size;
  const dupes = total - unique;
  return { total, unique, dupes };
}

function addTeamCode(code: string) {
  const current = input.value.trim();
  input.value = current ? `${current}, ${code}` : code;
}

function handleAdd() {
  const nums = parseInput(input.value);
  if (nums.length === 0) {
    error.value = 'No se encontraron láminas válidas';
    return;
  }
  error.value = '';
  emit('add', nums);
  input.value = '';
}
</script>

<template>
  <div class="bi-bg" @click="emit('close')">
    <div class="bi" @click.stop>
      <div class="bi-head">
        <div>
          <div class="bi-label">AGREGAR LÁMINAS</div>
          <div class="bi-title">Ingreso rápido</div>
        </div>
        <button class="bi-close" @click="emit('close')">✕</button>
      </div>
      <p class="bi-hint">
        Escribe códigos separados por coma. Usa <strong>MEX</strong> para agregar todo México,
        <strong>MEX 1 5 8</strong> para sueltas, o repite un código para sumar repetidas.
      </p>

      <!-- Quick team chips -->
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
        placeholder="Ej: MEX5, ARG1, BRA&#10;o por equipo: MEX 1 5 8 12"
        rows="3"
        autofocus
        @keydown.enter.ctrl="handleAdd"
        @keydown.enter.meta="handleAdd"
      />
      <div v-if="error" class="bi-error">{{ error }}</div>
      <div class="bi-footer">
        <div class="bi-preview">
          {{ parseSummary(input).unique }} láminas<template v-if="parseSummary(input).dupes > 0">
            + {{ parseSummary(input).dupes }} rep.</template
          >
        </div>
        <button class="bi-btn" :disabled="parseSummary(input).total === 0" @click="handleAdd">
          Agregar al álbum
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
.bi-hint strong {
  color: var(--gold);
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
  border-color: var(--gold);
  color: var(--gold);
  background: rgba(232, 179, 65, 0.1);
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
  border-color: var(--gold);
}
.bi-input::placeholder {
  color: rgba(246, 241, 225, 0.3);
}
.bi-error {
  font-size: 11px;
  color: var(--coral);
  margin-top: 6px;
}
.bi-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 14px;
  gap: 12px;
}
.bi-preview {
  font-family: var(--mono);
  font-size: 11px;
  color: rgba(246, 241, 225, 0.5);
}
.bi-btn {
  padding: 12px 24px;
  background: var(--gold);
  color: var(--pitch-deep);
  border: none;
  border-radius: 8px;
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
  flex-shrink: 0;
}
.bi-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.bi-btn:not(:disabled):hover {
  background: var(--gold-deep);
}
</style>
