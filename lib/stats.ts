// lib/stats.ts
// Pure, dependency-free math for the weight ledger.
// Weights are always stored internally in KILOGRAMS. Display conversion happens at the edge.

export type Unit = "kg" | "lb";

export interface Entry {
  id?: string;
  kg: number;
  ts: number; // epoch ms
  note?: string;
  bodyFat?: number | null;
  createdAt?: unknown;
}

export interface Settings {
  name?: string;
  unit?: Unit;
  heightCm?: number | null;
  goalKg?: number | null;
}

export interface Summary {
  count: number;
  current: number | null;
  start: number | null;
  totalChange: number | null;
  min: number | null;
  max: number | null;
  last7Change: number | null;
  last30Change: number | null;
}

export interface Projection {
  reachable: boolean;
  weeks: number | null;
  date: Date | null;
}

export const KG_PER_LB = 0.45359237;

export function kgToLb(kg: number): number {
  return kg / KG_PER_LB;
}
export function lbToKg(lb: number): number {
  return lb * KG_PER_LB;
}

export function toDisplay(kg: number | null | undefined, unit: Unit): number | null {
  if (kg == null || Number.isNaN(kg)) return null;
  return unit === "lb" ? kgToLb(kg) : kg;
}
export function toKg(value: number | null | undefined, unit: Unit): number | null {
  if (value == null || Number.isNaN(value)) return null;
  return unit === "lb" ? lbToKg(value) : value;
}

export function dayKey(dateLike: number | string | Date): string {
  const d = new Date(dateLike);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function daysBetween(a: number | string | Date, b: number | string | Date): number {
  const da = new Date(a);
  const db = new Date(b);
  const MS = 86400000;
  return Math.round((db.setHours(0, 0, 0, 0) - da.setHours(0, 0, 0, 0)) / MS);
}

export function sortByTime(entries: Entry[]): Entry[] {
  return [...entries].sort((a, b) => a.ts - b.ts);
}

// If multiple entries fall on the same calendar day, the latest reading of the day wins.
export function dailySeries(entries: Entry[]): Entry[] {
  const sorted = sortByTime(entries);
  const byDay = new Map<string, Entry>();
  for (const e of sorted) byDay.set(dayKey(e.ts), e);
  return [...byDay.values()].sort((a, b) => a.ts - b.ts);
}

export interface MAPoint {
  ts: number;
  kg: number;
  avg: number;
}

// Date-aware trailing moving average.
export function movingAverage(entries: Entry[], windowDays = 7): MAPoint[] {
  const series = dailySeries(entries);
  return series.map((point, i) => {
    const cutoff = point.ts - (windowDays - 1) * 86400000;
    let sum = 0;
    let count = 0;
    for (let j = i; j >= 0; j--) {
      if (series[j].ts < cutoff) break;
      sum += series[j].kg;
      count++;
    }
    return { ts: point.ts, kg: point.kg, avg: count ? sum / count : point.kg };
  });
}

// Least-squares slope over the last `days` of data. Returns kg per week (signed).
export function trendPerWeek(entries: Entry[], days = 30): number {
  const series = dailySeries(entries);
  if (series.length < 2) return 0;
  const latestTs = series[series.length - 1].ts;
  const cutoff = latestTs - days * 86400000;
  const pts = series.filter((p) => p.ts >= cutoff);
  if (pts.length < 2) return 0;

  const x0 = pts[0].ts;
  const xs = pts.map((p) => (p.ts - x0) / 86400000);
  const ys = pts.map((p) => p.kg);
  const n = pts.length;
  const sumX = xs.reduce((s, v) => s + v, 0);
  const sumY = ys.reduce((s, v) => s + v, 0);
  const sumXY = xs.reduce((s, v, i) => s + v * ys[i], 0);
  const sumXX = xs.reduce((s, v) => s + v * v, 0);
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return 0;
  const slopePerDay = (n * sumXY - sumX * sumY) / denom;
  return slopePerDay * 7;
}

export interface Bmi {
  value: number;
  label: string;
}

export function bmi(kg: number | null, heightCm: number | null | undefined): Bmi | null {
  if (!kg || !heightCm) return null;
  const m = heightCm / 100;
  const value = kg / (m * m);
  let label = "Normal";
  if (value < 18.5) label = "Underweight";
  else if (value < 25) label = "Normal";
  else if (value < 30) label = "Overweight";
  else label = "Obese";
  return { value, label };
}

export function projectGoal(
  currentKg: number | null,
  goalKg: number | null,
  ratePerWeek: number
): Projection | null {
  if (currentKg == null || goalKg == null) return null;
  const remaining = goalKg - currentKg;
  if (Math.abs(remaining) < 0.05) return { reachable: true, weeks: 0, date: new Date() };
  const movingRightWay =
    (remaining < 0 && ratePerWeek < 0) || (remaining > 0 && ratePerWeek > 0);
  if (!movingRightWay || Math.abs(ratePerWeek) < 1e-4) {
    return { reachable: false, weeks: null, date: null };
  }
  const weeks = remaining / ratePerWeek;
  const date = new Date(Date.now() + weeks * 7 * 86400000);
  return { reachable: true, weeks, date };
}

export function streak(entries: Entry[]): number {
  const series = dailySeries(entries);
  if (!series.length) return 0;
  const keys = new Set(series.map((e) => dayKey(e.ts)));
  let count = 0;
  let cursor = new Date(series[series.length - 1].ts);
  cursor.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const gap = daysBetween(cursor, today);
  if (gap > 1) return 0;
  while (keys.has(dayKey(cursor))) {
    count++;
    cursor = new Date(cursor.getTime() - 86400000);
  }
  return count;
}

export function summarize(entries: Entry[]): Summary {
  const series = dailySeries(entries);
  if (!series.length) {
    return {
      count: 0,
      current: null,
      start: null,
      totalChange: null,
      min: null,
      max: null,
      last7Change: null,
      last30Change: null,
    };
  }
  const current = series[series.length - 1].kg;
  const start = series[0].kg;
  const kgs = series.map((e) => e.kg);
  const min = Math.min(...kgs);
  const max = Math.max(...kgs);

  const changeSince = (days: number): number => {
    const latestTs = series[series.length - 1].ts;
    const cutoff = latestTs - days * 86400000;
    const past = series.filter((p) => p.ts <= cutoff);
    const ref = past.length ? past[past.length - 1] : series[0];
    return current - ref.kg;
  };

  return {
    count: series.length,
    current,
    start,
    totalChange: current - start,
    min,
    max,
    last7Change: series.length > 1 ? changeSince(7) : 0,
    last30Change: series.length > 1 ? changeSince(30) : 0,
  };
}

export function filterRange(entries: Entry[], range: string): Entry[] {
  if (range === "all") return sortByTime(entries);
  const days = Number(range);
  const now = Date.now();
  const cutoff = now - days * 86400000;
  return sortByTime(entries).filter((e) => e.ts >= cutoff);
}

export function round1(n: number | null | undefined): number | null {
  if (n == null || Number.isNaN(n)) return null;
  return Math.round(n * 10) / 10;
}
