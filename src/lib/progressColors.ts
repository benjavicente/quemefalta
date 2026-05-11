/**
 * Color scale for progress bars and indicators.
 * Used across AlbumView, AlbumAccordion, and anywhere progress is shown.
 *
 *   1-19%  → #ef5350  (rojo)
 *  20-39%  → #f59e0b  (ámbar)
 *  40-59%  → #fb923c  (naranja)
 *  60-79%  → #fbbf24  (amarillo)
 *  80-89%  → #a3e635  (lima)
 *  90-99%  → #4dd0a1  (mint)
 *    100%  → #34d399  (verde brillante)
 */
export function pctColor(pct: number): string {
  if (pct >= 100) return '#34d399';
  if (pct >= 90) return '#4dd0a1';
  if (pct >= 80) return '#a3e635';
  if (pct >= 60) return '#fbbf24';
  if (pct >= 40) return '#fb923c';
  if (pct >= 20) return '#f59e0b';
  return '#ef5350';
}

/** Same scale but accepting a `complete` flag for 100% shortcut. */
export function barColor(pct: number, complete: boolean): string {
  if (complete) return '#34d399';
  return pctColor(pct);
}
