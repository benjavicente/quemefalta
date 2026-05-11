<script setup lang="ts">
import { ref, computed } from 'vue';
import { useStickers } from '@/composables/useStickers';
import { TOTAL_STICKERS } from '@/lib/albumData';
import {
  totalPacksFromZero,
  projectionTable,
  simulateWithTrade,
  projectionCurvesWithTrade,
} from '@/lib/calcUtils';

const { stats } = useStickers();

const extraPacks = ref(50);
const packPrice = ref(1100);
const mlPrice = ref(1000);
const tau = ref(50); // 0-100 slider, divide by 100 for calc

const N = TOTAL_STICKERS;
const K = computed(() => stats.value.owned);
const currentDupes = computed(() => stats.value.dupes);
const missing = computed(() => N - K.value);
const tauDecimal = computed(() => tau.value / 100);

const totalFromZero = computed(() => totalPacksFromZero(N));

// Profile label for tau slider
const tauProfile = computed(() => {
  const t = tau.value;
  if (t <= 10) return 'No voy a cambiar';
  if (t <= 30) return 'Solo familia/pega';
  if (t <= 50) return '1-2 grupos Telegram';
  if (t <= 75) return 'Telegram + Plaza';
  return 'Multi-canal, ferias, full';
});

// Main simulation
const sim = computed(() =>
  simulateWithTrade(K.value, currentDupes.value, N, extraPacks.value, packPrice.value, tauDecimal.value),
);

// Recommendation based on real cost
const recommendation = computed(() => {
  const cpn = sim.value.costPerNewReal;
  if (cpn === Infinity) return { level: 'neutral', text: 'Album completo' };
  const ratio = cpn / mlPrice.value;
  if (ratio < 0.5) return { level: 'green', text: `Sobres + cambio sale ${formatCLP(cpn)}/nueva — mas barato que ML (${formatCLP(mlPrice.value)})` };
  if (ratio < 1.0) return { level: 'yellow', text: `Casi igual: ${formatCLP(cpn)}/nueva vs ${formatCLP(mlPrice.value)} en ML` };
  return { level: 'red', text: `Mejor comprar en ML: sobre sale ${formatCLP(cpn)}/nueva vs ${formatCLP(mlPrice.value)} individual` };
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

function formatCLP(n: number): string {
  return '$' + n.toLocaleString('es-CL');
}
</script>

<template>
  <div class="calc-view">
    <!-- Tu estado -->
    <div class="calc-card">
      <div class="calc-label">TU ESTADO</div>
      <div class="calc-status">
        <span class="calc-status-num">{{ K }}</span> de {{ N }}
        <span class="calc-status-pct">({{ currentPct }}%)</span>
        <span class="calc-status-sep">·</span>
        Faltan <strong>{{ missing }}</strong>
        <span class="calc-status-sep">·</span>
        <span class="calc-status-dupes">{{ currentDupes }} repetidas</span>
      </div>
      <div class="calc-funfact">
        Completar el album sin cambiar necesita ~{{ totalFromZero.toLocaleString('es-CL') }} sobres en promedio
      </div>
    </div>

    <!-- Simulador -->
    <div class="calc-card">
      <div class="calc-label">SIMULADOR</div>

      <div class="calc-input-row">
        <label class="calc-input-label">Sobres extra</label>
        <div class="calc-slider-row">
          <input v-model.number="extraPacks" type="range" min="0" max="500" step="5" class="calc-range" />
          <input v-model.number="extraPacks" type="number" min="0" max="999" class="calc-num" />
        </div>
      </div>

      <div class="calc-input-row">
        <label class="calc-input-label">Tasa de cambio: {{ tau }}%</label>
        <div class="calc-slider-row">
          <input v-model.number="tau" type="range" min="0" max="90" step="5" class="calc-range" />
          <span class="calc-tau-label">{{ tauProfile }}</span>
        </div>
      </div>

      <div class="calc-inputs-row">
        <div class="calc-input-row calc-input-half">
          <label class="calc-input-label">Precio sobre</label>
          <input v-model.number="packPrice" type="number" min="0" class="calc-num" />
        </div>
        <div class="calc-input-row calc-input-half">
          <label class="calc-input-label">Precio ML individual</label>
          <input v-model.number="mlPrice" type="number" min="0" class="calc-num" />
        </div>
      </div>

      <div class="calc-results">
        <div class="calc-result">
          <span class="calc-result-val">{{ sim.newDirect }}</span> nuevas salen de los sobres
        </div>
        <div v-if="sim.newFromTrade > 0" class="calc-result">
          <span class="calc-result-val calc-result-trade">+{{ sim.newFromTrade }}</span>
          nuevas cambiando repetidas <span class="calc-result-hint">(sin costo extra)</span>
        </div>
        <div class="calc-result">
          Llegaras a <span class="calc-result-val">{{ sim.totalFinal }}</span>
          <span class="calc-result-pct">({{ sim.pctFinal }}%)</span>
        </div>

        <div class="calc-divider" />

        <div class="calc-result">
          Gastas <span class="calc-result-val">{{ formatCLP(sim.totalCost) }}</span> en sobres
        </div>
        <div class="calc-result">
          Cada lamina nueva te sale
          <span class="calc-result-val">{{ formatCLP(tauDecimal > 0 ? sim.costPerNewReal : sim.costPerNewNaive) }}</span>
          <template v-if="tauDecimal > 0">
            <span class="calc-result-hint">(seria {{ formatCLP(sim.costPerNewNaive) }} sin cambiar repes)</span>
          </template>
        </div>
        <div v-if="sim.dupesDead > 0" class="calc-result calc-result-dead">
          {{ sim.dupesDead }} repetidas quedarian sin cambiar
        </div>
      </div>

      <div :class="['calc-rec', `calc-rec-${recommendation.level}`]">
        {{ recommendation.text }}
      </div>
    </div>

    <!-- Tabla -->
    <div class="calc-card">
      <div class="calc-label">PROYECCION (SOLO SOBRES)</div>
      <div class="calc-table-wrap">
        <table class="calc-table">
          <thead>
            <tr>
              <th>Sobres</th>
              <th>Nuevas</th>
              <th>Repes</th>
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
          v-for="t in yTicks" :key="'yg' + t"
          :x1="pad.left" :x2="svgW - pad.right" :y1="sy(t)" :y2="sy(t)"
          class="calc-grid"
        />
        <!-- Current % baseline -->
        <line
          :x1="pad.left" :x2="svgW - pad.right"
          :y1="sy(currentPct)" :y2="sy(currentPct)"
          class="calc-baseline"
        />
        <!-- 3 curves -->
        <polyline
          v-for="c in curves" :key="c.tau"
          :points="curvePoints(c.points)"
          fill="none" :stroke="c.color" stroke-width="1.8"
          stroke-linecap="round" stroke-linejoin="round"
          :opacity="c.tau === 0 ? 0.5 : 1"
        />
        <!-- Y labels -->
        <text
          v-for="t in yTicks" :key="'yl' + t"
          :x="pad.left - 4" :y="sy(t) + 3"
          class="calc-axis-label" text-anchor="end"
        >{{ t }}%</text>
        <!-- X labels -->
        <text
          v-for="t in xTicks" :key="'xl' + t"
          :x="sx(t)" :y="svgH - 6"
          class="calc-axis-label" text-anchor="middle"
        >{{ t }}</text>
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

    <!-- Acordeon matematica -->
    <details class="calc-math">
      <summary class="calc-math-toggle">Ver matematica detras</summary>
      <div class="calc-math-body">
        <p>
          <strong>Laminas nuevas esperadas:</strong><br />
          nuevas = (N - K) * [1 - (1 - 1/N)^(s*k)]<br />
          N={{ N }} laminas en el album, K=las que tienes, s=sobres, k=7 por sobre.
        </p>
        <p>
          <strong>Nuevas por cambio:</strong><br />
          nuevas_cambio = min(R * tau * rho, faltantes restantes)<br />
          R=repetidas totales, tau=tasa de cambio, rho=0.8 (ratio nuevas/repe).
        </p>
        <p>
          <strong>Costo por lamina nueva:</strong><br />
          $/nueva = precio_sobre / nuevas_en_1_sobre<br />
          Con cambio: costo_total / (nuevas_directas + nuevas_cambio)
        </p>
        <p>
          <strong>Sobres para llenar desde cero:</strong><br />
          total = N * H_N / k, donde H_N es el N-esimo numero armonico.<br />
          Para {{ N }} laminas: ~{{ totalFromZero.toLocaleString('es-CL') }} sobres.
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
