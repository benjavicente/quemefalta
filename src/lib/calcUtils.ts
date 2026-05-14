/**
 * Probabilistic sticker calculator — coupon collector math.
 * N = total stickers in album, k = stickers per pack, K = currently owned.
 */

export interface ProjectionRow {
  packs: number;
  newStickers: number;
  dupes: number;
  total: number;
  pct: number;
  costPerNew: number;
}

/** F3: expected NEW stickers after buying s packs, currently owning K of N */
export function expectedNew(K: number, N: number, s: number, k = 7): number {
  if (K >= N || s <= 0) return 0;
  const missing = N - K;
  // P(a specific missing sticker is NOT in s*k draws) = (1 - 1/N)^(s*k)
  // Expected new = missing * (1 - P(not drawn))
  return missing * (1 - Math.pow(1 - 1 / N, s * k));
}

/** F5: cost per new sticker if you buy 1 more pack */
export function costPerNew(K: number, N: number, packPrice: number, k = 7): number {
  const newInOnePack = expectedNew(K, N, 1, k);
  if (newInOnePack <= 0) return Infinity;
  return packPrice / newInOnePack;
}

/** F6: packs needed to go from K to targetK (expected) */
export function packsToReach(K: number, targetK: number, N: number, k = 7): number {
  if (targetK <= K) return 0;
  if (targetK >= N) targetK = N - 0.01; // can't reach exactly N with finite packs
  const missing = N - K;
  const fraction = (targetK - K) / missing; // fraction of missing stickers to find
  // From F3: fraction = 1 - (1-1/N)^(s*k), solve for s:
  // s = ln(1 - fraction) / (k * ln(1 - 1/N))
  const s = Math.log(1 - fraction) / (k * Math.log(1 - 1 / N));
  return Math.ceil(s);
}

/** F7: expected total packs to fill album from zero (coupon collector / k) */
export function totalPacksFromZero(N: number, k = 7): number {
  // E[total items] = N * H_N where H_N = sum(1/i, i=1..N)
  let harmonic = 0;
  for (let i = 1; i <= N; i++) harmonic += 1 / i;
  return Math.round((N * harmonic) / k);
}

/** Generate projection table for common pack milestones */
export function projectionTable(K: number, N: number, packPrice: number, k = 7): ProjectionRow[] {
  const milestones = [10, 25, 50, 100, 150, 200, 300];
  return milestones.map((packs) => {
    const newStickers = expectedNew(K, N, packs, k);
    const totalDrawn = packs * k;
    const total = K + newStickers;
    return {
      packs,
      newStickers: Math.round(newStickers),
      dupes: Math.round(totalDrawn - newStickers),
      total: Math.round(total),
      pct: Math.round((total / N) * 1000) / 10,
      costPerNew: newStickers > 0 ? Math.round((packs * packPrice) / newStickers) : Infinity,
    };
  });
}

/** Simulation result including trade model */
export interface TradeSimResult {
  newDirect: number;
  newFromTrade: number;
  newTotal: number;
  totalFinal: number;
  pctFinal: number;
  totalCost: number;
  costPerNewNaive: number;
  costPerNewReal: number;
  dupesGenerated: number;
  dupesTotal: number;
  dupesDead: number;
}

/**
 * Full simulation: packs + trade model.
 * tau = trade success rate (0-1), rho = new stickers per traded dupe (fixed 0.8)
 */
export function simulateWithTrade(
  K: number,
  currentDupes: number,
  N: number,
  s: number,
  packPrice: number,
  tau: number,
  rho = 0.8,
  k = 7,
): TradeSimResult {
  const newDirect = expectedNew(K, N, s, k);
  const dupesGenerated = s * k - newDirect;
  const dupesTotal = currentDupes + dupesGenerated;
  const remainingAfterDirect = N - K - newDirect;
  const newFromTrade = Math.min(dupesTotal * tau * rho, Math.max(0, remainingAfterDirect));
  const newTotal = newDirect + newFromTrade;
  const totalFinal = K + newTotal;
  const totalCost = s * packPrice;

  return {
    newDirect: Math.round(newDirect),
    newFromTrade: Math.round(newFromTrade),
    newTotal: Math.round(newTotal),
    totalFinal: Math.round(totalFinal),
    pctFinal: Math.round((totalFinal / N) * 1000) / 10,
    totalCost,
    costPerNewNaive: newDirect > 0 ? Math.round(totalCost / newDirect) : Infinity,
    costPerNewReal: newTotal > 0 ? Math.round(totalCost / newTotal) : Infinity,
    dupesGenerated: Math.round(dupesGenerated),
    dupesTotal: Math.round(dupesTotal),
    dupesDead: Math.round(dupesTotal * (1 - tau)),
  };
}

/** Generate 3 projection curves for different tau values (for multi-line chart) */
export function projectionCurvesWithTrade(
  K: number,
  currentDupes: number,
  N: number,
  maxPacks: number,
  packPrice: number,
  k = 7,
): { tau: number; label: string; color: string; points: { x: number; y: number }[] }[] {
  const taus = [
    { tau: 0, label: 'Sin cambio', color: '#ef5350' },
    { tau: 0.5, label: 'Cambio moderado', color: '#fbbf24' },
    { tau: 0.8, label: 'Cambio activo', color: '#34d399' },
  ];
  const steps = 50;
  return taus.map(({ tau, label, color }) => {
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i <= steps; i++) {
      const packs = Math.round((i / steps) * maxPacks);
      const sim = simulateWithTrade(K, currentDupes, N, packs, packPrice, tau, 0.8, k);
      points.push({ x: packs, y: sim.pctFinal });
    }
    return { tau, label, color, points };
  });
}

/** Generate points for SVG projection curve */
export function projectionCurve(
  K: number,
  N: number,
  maxPacks: number,
  k = 7,
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  const steps = 50;
  for (let i = 0; i <= steps; i++) {
    const packs = Math.round((i / steps) * maxPacks);
    const total = K + expectedNew(K, N, packs, k);
    points.push({ x: packs, y: Math.round((total / N) * 1000) / 10 });
  }
  return points;
}
