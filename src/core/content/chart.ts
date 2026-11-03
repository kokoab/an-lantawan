import type { Chart } from './doc';

type Row = Chart['attrs']['rows'][number];

/** Bar lengths as a share of the longest bar, from 0 to 100. Negative values count as 0. */
export function barShares(rows: readonly Row[]) {
  const max = Math.max(0, ...rows.map((r) => r.value));
  return rows.map((r) => (max > 0 ? Math.round((Math.max(0, r.value) / max) * 1000) / 10 : 0));
}

/** Points of a line chart inside a width × height box, with the lowest value at the bottom. */
export function linePoints(rows: readonly Row[], width: number, height: number, pad = 8) {
  if (rows.length === 0) return [];
  const values = rows.map((r) => r.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = rows.length > 1 ? (width - pad * 2) / (rows.length - 1) : 0;
  return rows.map((r, i) => ({
    x: Math.round((pad + step * i) * 10) / 10,
    y: Math.round((height - pad - ((r.value - min) / span) * (height - pad * 2)) * 10) / 10,
  }));
}

/** 26,000 and 4,383, as the chart labels show them. */
export const chartNumber = (n: number) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n);
