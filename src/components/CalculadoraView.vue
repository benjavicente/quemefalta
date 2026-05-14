<script setup lang="ts">
import { ref, computed, watch, inject } from 'vue';
import type { Ref } from 'vue';
import { useStickers } from '@/composables/useStickers';
import { TOTAL_STICKERS } from '@/lib/albumData';
import {
  totalPacksFromZero,
  projectionTable,
  simulateWithTrade,
  projectionCurvesWithTrade,
  expectedNew,
} from '@/lib/calcUtils';

const STICKERS_PER_PACK = 7;

const isPreview = inject<Ref<boolean>>('isPreview', ref(false));
const { stats } = useStickers();

const ownedInput = ref(0);
const dupesInput = ref(0);

// Auto-fill from user data when logged in
watch(
  () => stats.value.owned,
  (val) => {
    if (!isPreview.value) ownedInput.value = val;
  },
  { immediate: true },
);
watch(
  () => stats.value.dupes,
  (val) => {
    if (!isPreview.value) dupesInput.value = val;
  },
  { immediate: true },
);

const extraPacks = ref(50);
const packPrice = ref(1100);
const mlPrice = ref(1000);
const tradePeople = ref(5); // number of people you trade with

const N = TOTAL_STICKERS;
const K = computed(() => Math.max(0, Math.min(N, ownedInput.value || 0)));
const currentDupes = computed(() => Math.max(0, dupesInput.value || 0));
const missing = computed(() => N - K.value);
// Map people count → tau with diminishing returns: tau = 1 - 0.88^n
const tauDecimal = computed(() =>
  tradePeople.value <= 0 ? 0 : Math.min(0.92, 1 - Math.pow(0.88, tradePeople.value)),
);

const totalFromZero = computed(() => totalPacksFromZero(N));

// Profile label for trade people slider.
// WhatsApp y Facebook son los canales mas comunes en LATAM para coleccionistas;
// dejamos Telegram fuera para no sesgar la sugerencia a una sola app.
const tradeProfile = computed(() => {
  const n = tradePeople.value;
  if (n === 0) return 'No cambio con nadie';
  if (n <= 2) return 'Familia o compañeros de trabajo';
  if (n <= 5) return 'Amigos y conocidos';
  if (n <= 10) return 'Grupo de WhatsApp o Facebook';
  if (n <= 15) return 'Varios grupos de WhatsApp/Facebook';
  return 'Comunidad activa (varios canales)';
});

// Esperanza por sobre = láminas nuevas promedio que esperás de UN sobre,
// dado cuántas tenés ya. Cuanto más completo está tu álbum, más bajo este número
// (es más probable que cada lámina sea repetida).
const expectedNewPerPack = computed(() => expectedNew(K.value, N, 1));
const newPercentagePerPack = computed(() => {
  if (K.value >= N) return 0;
  return Math.round((expectedNewPerPack.value / STICKERS_PER_PACK) * 100);
});

// Main simulation
const sim = computed(() =>
  simulateWithTrade(
    K.value,
    currentDupes.value,
    N,
    extraPacks.value,
    packPrice.value,
    tauDecimal.value,
  ),
);

// Cuántos intercambios EXITOSOS necesitarías por persona en promedio para
// alcanzar las "nuevas por cambio" que predice la simulación.
const tradesPerPerson = computed(() => {
  if (tradePeople.value === 0 || sim.value.newFromTrade === 0) return 0;
  return Math.max(1, Math.round(sim.value.newFromTrade / tradePeople.value));
});

// Porcentaje de nuevas dentro del total de láminas que sacarías de los sobres
// (newDirect / (newDirect + dupesGenerated)). Sirve para mostrar al lado del
// número en el simulador, igual que el "% del sobre" de la card de estado.
const newPctFromPacks = computed(() => {
  const total = sim.value.newDirect + sim.value.dupesGenerated;
  if (total === 0) return 0;
  return Math.round((sim.value.newDirect / total) * 100);
});

// Recommendation based on real cost.
// Solo aplica cuando estás comprando sobres — si no, comparar contra "lámina suelta" no tiene sentido.
const recommendation = computed(() => {
  if (extraPacks.value === 0) {
    if (sim.value.newFromTrade > 0) {
      return {
        level: 'green',
        text: `Esas ${sim.value.newFromTrade} nuevas te salen gratis: solo estás cambiando repetidas.`,
      };
    }
    return {
      level: 'neutral',
      text: 'Sin sobres y sin cambios no hay nuevas. Mueve los controles para simular.',
    };
  }
  const cpn = sim.value.costPerNewReal;
  if (cpn === Infinity || cpn === 0) {
    return { level: 'neutral', text: 'Ajusta los valores arriba para ver la comparación.' };
  }
  const ratio = cpn / mlPrice.value;
  if (ratio < 0.5) {
    return {
      level: 'green',
      text: `Conviene sobres: ${formatCLP(cpn)} vs ${formatCLP(mlPrice.value)} suelta.`,
    };
  }
  if (ratio < 1.0) {
    return {
      level: 'yellow',
      text: `Parejo: ${formatCLP(cpn)} sobre vs ${formatCLP(mlPrice.value)} suelta.`,
    };
  }
  return {
    level: 'red',
    text: `Conviene comprar sueltas: ${formatCLP(mlPrice.value)} vs ${formatCLP(cpn)} del sobre.`,
  };
});

// Table (without trade, raw projection)
const table = computed(() => projectionTable(K.value, N, packPrice.value));

// Multi-curve chart
const maxCurvePacks = 400;
const curves = computed(() =>
  projectionCurvesWithTrade(K.value, currentDupes.value, N, maxCurvePacks, packPrice.value),
);
const currentPct = computed(() => Math.round((K.value / N) * 1000) / 10);

// SVG helpers
const svgW = 320;
const svgH = 180;
const pad = { top: 10, right: 10, bottom: 28, left: 40 };
const plotW = svgW - pad.left - pad.right;
const plotH = svgH - pad.top - pad.bottom;

function sx(packs: number) {
  return pad.left + (packs / maxCurvePacks) * plotW;
}
function sy(pct: number) {
  const minY = Math.max(0, currentPct.value - 10);
  const rangeY = 100 - minY;
  return pad.top + plotH - ((Math.min(100, pct) - minY) / rangeY) * plotH;
}

function curvePoints(points: { x: number; y: number }[]) {
  return points.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ');
}

const yTicks = computed(() => {
  const minY = Math.max(0, currentPct.value - 10);
  const ticks: number[] = [];
  const start = Math.ceil(minY / 10) * 10;
  for (let t = start; t <= 100; t += 10) ticks.push(t);
  return ticks;
});

const xTicks = [0, 100, 200, 300, 400];

// Sin separador de miles. El punto se reserva SOLO para decimales (evitamos
// el conflicto con 1.045 = mil cuarenta y cinco vs 1.045 = uno coma cero cuatro cinco).
function formatCLP(n: number): string {
  return '$' + Math.round(n);
}
</script>

<template>
  <div class="calc-view">
    <!-- Tu estado -->
    <div class="calc-card">
      <div class="calc-label">TU ESTADO</div>
      <div class="calc-estado-inputs">
        <div class="calc-estado-field">
          <label class="calc-input-label">Laminas que tengo</label>
          <input
            v-model.number="ownedInput"
            type="number"
            min="0"
            :max="N"
            class="calc-num calc-estado-num"
          />
        </div>
        <div class="calc-estado-field">
          <label class="calc-input-label">Repetidas</label>
          <input
            v-model.number="dupesInput"
            type="number"
            min="0"
            class="calc-num calc-estado-num"
          />
        </div>
      </div>
      <div class="calc-status">
        <span class="calc-status-num">{{ K }}</span> de {{ N }}
        <span class="calc-status-pct">({{ currentPct }}%)</span>
        <span class="calc-status-sep">·</span>
        Faltan <strong>{{ missing }}</strong>
      </div>

      <div v-if="K < N" class="calc-expectation">
        Cada sobre nuevo te da, en promedio,
        <span class="calc-expectation-val">{{ expectedNewPerPack.toFixed(1) }}</span>
        láminas nuevas
        <span class="calc-expectation-pct">({{ newPercentagePerPack }}% del sobre)</span>.
      </div>

      <div class="calc-funfact">
        Llenar todo solo con sobres necesitaría ~{{ totalFromZero }} en promedio.
      </div>
    </div>

    <!-- Simulador -->
    <div class="calc-card">
      <div class="calc-label">SIMULADOR</div>

      <div class="calc-input-row">
        <label class="calc-input-label">Sobres extra</label>
        <div class="calc-slider-row">
          <input
            v-model.number="extraPacks"
            type="range"
            min="0"
            max="500"
            step="5"
            class="calc-range"
          />
          <input v-model.number="extraPacks" type="number" min="0" max="999" class="calc-num" />
        </div>
      </div>

      <div class="calc-input-row">
        <label class="calc-input-label">Personas con las que cambias: {{ tradePeople }}</label>
        <div class="calc-slider-row">
          <input
            v-model.number="tradePeople"
            type="range"
            min="0"
            max="20"
            step="1"
            class="calc-range"
          />
          <span class="calc-tau-label">{{ tradeProfile }}</span>
        </div>
      </div>

      <div class="calc-inputs-row">
        <div class="calc-input-row calc-input-half">
          <label class="calc-input-label">Precio del sobre</label>
          <input v-model.number="packPrice" type="number" min="0" class="calc-num" />
        </div>
        <div class="calc-input-row calc-input-half">
          <label class="calc-input-label">Precio lámina suelta</label>
          <input v-model.number="mlPrice" type="number" min="0" class="calc-num" />
        </div>
      </div>

      <div class="calc-results">
        <div class="calc-result">
          <span class="calc-result-val">{{ sim.newDirect }}</span> nuevas
          <span v-if="extraPacks > 0">y {{ sim.dupesGenerated }} repetidas</span>
          de los sobres
          <span v-if="extraPacks > 0" class="calc-result-hint">
            ({{ newPctFromPacks }}% nuevas)
          </span>
        </div>
        <div v-if="sim.newFromTrade > 0" class="calc-result">
          <span class="calc-result-val calc-result-trade">+{{ sim.newFromTrade }}</span>
          nuevas cambiando repetidas
        </div>
        <div v-if="sim.newFromTrade > 0 && tradePeople > 0" class="calc-result calc-result-sub">
          ~<span class="calc-result-val">{{ tradesPerPerson }}</span>
          por persona en promedio.
        </div>
        <div class="calc-result">
          Total: <span class="calc-result-val">{{ sim.totalFinal }}</span>
          <span class="calc-result-pct">({{ sim.pctFinal }}%)</span>
        </div>

        <template v-if="extraPacks > 0">
          <div class="calc-divider" />

          <div class="calc-result">
            Gastas <span class="calc-result-val">{{ formatCLP(sim.totalCost) }}</span> en sobres
          </div>
          <div v-if="sim.newTotal > 0" class="calc-result">
            Costo por lámina nueva:
            <span class="calc-result-val">{{
              formatCLP(tradePeople > 0 ? sim.costPerNewReal : sim.costPerNewNaive)
            }}</span>
            <span v-if="tradePeople > 0 && sim.newDirect > 0" class="calc-result-hint">
              (sin cambiar repetidas: {{ formatCLP(sim.costPerNewNaive) }})
            </span>
          </div>
        </template>

        <div v-if="sim.dupesDead > 0" class="calc-result calc-result-dead">
          ~{{ sim.dupesDead }} repetidas quedarían sin cambiar.
        </div>
      </div>

      <div :class="['calc-rec', `calc-rec-${recommendation.level}`]">
        {{ recommendation.text }}
      </div>
    </div>

    <!-- Tabla -->
    <div class="calc-card">
      <div class="calc-label">PROYECCIÓN (SOLO SOBRES)</div>
      <div class="calc-table-wrap">
        <table class="calc-table">
          <thead>
            <tr>
              <th>Sobres</th>
              <th>Nuevas</th>
              <th>Repetidas</th>
              <th>Total</th>
              <th>%</th>
              <th>$/nueva</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in table" :key="row.packs">
              <td>{{ row.packs }}</td>
              <td>{{ row.newStickers }}</td>
              <td class="calc-td-dupes">{{ row.dupes }}</td>
              <td>{{ row.total }}</td>
              <td>{{ row.pct }}%</td>
              <td>{{ formatCLP(row.costPerNew) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Curva multi-linea -->
    <div class="calc-card">
      <div class="calc-label">CURVA DE RENDIMIENTO</div>
      <svg class="calc-svg" :viewBox="`0 0 ${svgW} ${svgH}`" preserveAspectRatio="xMidYMid meet">
        <!-- Grid -->
        <line
          v-for="t in yTicks"
          :key="'yg' + t"
          :x1="pad.left"
          :x2="svgW - pad.right"
          :y1="sy(t)"
          :y2="sy(t)"
          class="calc-grid"
        />
        <!-- Current % baseline -->
        <line
          :x1="pad.left"
          :x2="svgW - pad.right"
          :y1="sy(currentPct)"
          :y2="sy(currentPct)"
          class="calc-baseline"
        />
        <!-- 3 curves -->
        <polyline
          v-for="c in curves"
          :key="c.tau"
          :points="curvePoints(c.points)"
          fill="none"
          :stroke="c.color"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          :opacity="c.tau === 0 ? 0.5 : 1"
        />
        <!-- Y labels -->
        <text
          v-for="t in yTicks"
          :key="'yl' + t"
          :x="pad.left - 4"
          :y="sy(t) + 3"
          class="calc-axis-label"
          text-anchor="end"
        >
          {{ t }}%
        </text>
        <!-- X labels -->
        <text
          v-for="t in xTicks"
          :key="'xl' + t"
          :x="sx(t)"
          :y="svgH - 6"
          class="calc-axis-label"
          text-anchor="middle"
        >
          {{ t }}
        </text>
        <text :x="svgW / 2" :y="svgH" class="calc-axis-label" text-anchor="middle">sobres</text>
      </svg>
      <!-- Legend -->
      <div class="calc-legend">
        <div v-for="c in curves" :key="'lg' + c.tau" class="calc-legend-item">
          <span class="calc-legend-dot" :style="{ background: c.color }" />
          {{ c.label }}
        </div>
      </div>
    </div>

    <!-- Acordeon estadistica -->
    <details class="calc-math">
      <summary class="calc-math-toggle">Cómo se calcula</summary>
      <div class="calc-math-body">
        <p>
          Son cálculos de probabilidad (no fórmulas exactas). Asumen que cada sobre trae 7 láminas
          al azar de las {{ N }} posibles, con repetición.
        </p>
        <p>
          <strong>Nuevas esperadas en s sobres:</strong><br />
          nuevas = (N − K) · [1 − (1 − 1/N)^(s·k)]<br />
          N = {{ N }}, K = las que ya tienes, s = sobres, k = 7.
        </p>
        <p>
          <strong>Nuevas por cambio:</strong><br />
          nuevas_cambio = mín(R · τ · ρ, faltantes restantes)<br />
          R = repetidas totales, τ = qué fracción logras cambiar (sube con más contactos), ρ = 0,8
          (de cada repetida cambiada, el 80% termina siendo nueva para ti).
        </p>
        <p>
          <strong>Costo por lámina nueva:</strong><br />
          costo total ÷ (nuevas de sobres + nuevas por cambio).
        </p>
        <p>
          <strong>Sobres para completar desde cero:</strong><br />
          total = N · H_N ÷ k, donde H_N es la suma 1 + 1/2 + … + 1/N (número armónico).<br />
          Para {{ N }} láminas: ~{{ totalFromZero }} sobres.
        </p>
      </div>
    </details>
  </div>
</template>

<style scoped>
.calc-view {
  padding: 0 clamp(14px, 3vw, 28px) 30px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.calc-card {
  background: rgba(246, 241, 225, 0.03);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 16px;
}

.calc-label {
  font-family: var(--mono);
  font-size: 9px;
  letter-spacing: 0.18em;
  color: var(--gold);
  margin-bottom: 10px;
}

/* Estado inputs */
.calc-estado-inputs {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}
.calc-estado-field {
  flex: 1;
}
.calc-estado-num {
  width: 100%;
  box-sizing: border-box;
}

/* Status */
.calc-status {
  font-size: 14px;
  color: var(--chalk);
  line-height: 1.5;
}
.calc-status-num {
  font-family: var(--display);
  font-size: 28px;
  color: var(--gold);
}
.calc-status-pct {
  color: rgba(246, 241, 225, 0.55);
}
.calc-status-sep {
  color: rgba(246, 241, 225, 0.25);
  margin: 0 4px;
}
.calc-status-dupes {
  color: var(--coral);
  font-weight: 600;
}
.calc-funfact {
  font-family: var(--mono);
  font-size: 10px;
  color: rgba(246, 241, 225, 0.4);
  margin-top: 8px;
  letter-spacing: 0.02em;
}

/* Esperanza por sobre */
.calc-expectation {
  margin-top: 10px;
  padding: 10px 12px;
  background: rgba(232, 179, 65, 0.06);
  border-left: 2px solid var(--gold);
  border-radius: 4px;
  font-size: 13px;
  color: var(--chalk);
  line-height: 1.4;
}
.calc-expectation-val {
  font-family: var(--display);
  font-size: 18px;
  color: var(--gold);
  margin: 0 2px;
}
.calc-expectation-pct {
  color: rgba(246, 241, 225, 0.55);
  font-size: 12px;
}

/* Inputs */
.calc-input-row {
  margin-bottom: 12px;
}
.calc-input-label {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.08em;
  color: rgba(246, 241, 225, 0.55);
  display: block;
  margin-bottom: 4px;
}
.calc-slider-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.calc-range {
  flex: 1;
  accent-color: var(--gold);
  height: 4px;
}
.calc-num {
  width: 72px;
  padding: 6px 8px;
  background: rgba(246, 241, 225, 0.06);
  border: 1px solid var(--line);
  border-radius: 6px;
  color: var(--chalk);
  font-family: var(--mono);
  font-size: 13px;
  text-align: right;
  outline: none;
}
.calc-num:focus {
  border-color: var(--gold);
}
.calc-inputs-row {
  display: flex;
  gap: 10px;
}
.calc-input-half {
  flex: 1;
}
.calc-tau-label {
  font-family: var(--mono);
  font-size: 10px;
  color: rgba(246, 241, 225, 0.55);
  white-space: nowrap;
  min-width: 0;
  flex-shrink: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Results */
.calc-results {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
}
.calc-result {
  font-size: 13px;
  color: rgba(246, 241, 225, 0.7);
}
.calc-result-val {
  font-weight: 700;
  color: var(--gold);
}
.calc-result-trade {
  color: #34d399;
}
.calc-result-pct {
  color: rgba(246, 241, 225, 0.5);
}
.calc-result-hint {
  font-size: 11px;
  color: rgba(246, 241, 225, 0.35);
}
.calc-result-sub {
  font-size: 11px;
  color: rgba(246, 241, 225, 0.5);
  padding-left: 12px;
  margin-top: -2px;
}
.calc-divider {
  height: 1px;
  background: var(--line);
  margin: 6px 0;
}
.calc-result-dead {
  font-family: var(--mono);
  font-size: 11px;
  color: rgba(246, 241, 225, 0.35);
  margin-top: 2px;
}

/* Recommendation */
.calc-rec {
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
  text-align: center;
}
.calc-rec-green {
  background: rgba(52, 211, 153, 0.12);
  color: #34d399;
  border: 1px solid rgba(52, 211, 153, 0.3);
}
.calc-rec-yellow {
  background: rgba(251, 191, 36, 0.12);
  color: #fbbf24;
  border: 1px solid rgba(251, 191, 36, 0.3);
}
.calc-rec-red {
  background: rgba(239, 83, 80, 0.12);
  color: var(--coral);
  border: 1px solid rgba(239, 83, 80, 0.3);
}
.calc-rec-neutral {
  background: rgba(246, 241, 225, 0.06);
  color: rgba(246, 241, 225, 0.5);
  border: 1px solid var(--line);
}

/* Table */
.calc-table-wrap {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
.calc-table {
  width: 100%;
  border-collapse: collapse;
  font-family: var(--mono);
  font-size: 11px;
}
.calc-table th {
  text-align: right;
  padding: 6px 8px;
  color: rgba(246, 241, 225, 0.5);
  font-weight: 600;
  font-size: 9px;
  letter-spacing: 0.1em;
  border-bottom: 1px solid var(--line);
}
.calc-table th:first-child {
  text-align: left;
}
.calc-table td {
  text-align: right;
  padding: 7px 8px;
  color: var(--chalk);
  border-bottom: 1px solid rgba(246, 241, 225, 0.04);
}
.calc-table td:first-child {
  text-align: left;
  color: var(--gold);
  font-weight: 700;
}
.calc-td-dupes {
  color: rgba(246, 241, 225, 0.4);
}

/* SVG Chart */
.calc-svg {
  width: 100%;
  height: auto;
  max-height: 200px;
}
.calc-grid {
  stroke: rgba(246, 241, 225, 0.06);
  stroke-width: 0.5;
}
.calc-baseline {
  stroke: rgba(246, 241, 225, 0.25);
  stroke-width: 0.5;
  stroke-dasharray: 4 3;
}
.calc-axis-label {
  font-family: var(--mono);
  font-size: 8px;
  fill: rgba(246, 241, 225, 0.4);
}

/* Legend */
.calc-legend {
  display: flex;
  gap: 14px;
  justify-content: center;
  margin-top: 10px;
}
.calc-legend-item {
  display: flex;
  align-items: center;
  gap: 5px;
  font-family: var(--mono);
  font-size: 9px;
  color: rgba(246, 241, 225, 0.55);
}
.calc-legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  flex-shrink: 0;
}

/* Math accordion */
.calc-math {
  margin-top: 4px;
}
.calc-math-toggle {
  font-family: var(--mono);
  font-size: 11px;
  color: rgba(246, 241, 225, 0.4);
  cursor: pointer;
  letter-spacing: 0.04em;
  padding: 8px 0;
}
.calc-math-toggle:hover {
  color: var(--gold);
}
.calc-math-body {
  padding: 12px 16px;
  background: rgba(246, 241, 225, 0.03);
  border: 1px solid var(--line);
  border-radius: 8px;
  margin-top: 8px;
}
.calc-math-body p {
  font-family: var(--mono);
  font-size: 11px;
  line-height: 1.6;
  color: rgba(246, 241, 225, 0.6);
  margin: 0 0 12px;
}
.calc-math-body p:last-child {
  margin-bottom: 0;
}
.calc-math-body strong {
  color: var(--gold);
}
</style>
