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
  calories?: number | null; // optional kcal logged for that day
  createdAt?: unknown;
}

export type PhaseType = "cut" | "bulk" | "maintain";

export interface Phase {
  id: string;
  type: PhaseType;
  startTs: number;
  targetRatePerWeek: number; // kg/week, signed (negative = losing)
  note?: string;
}

export type Sex = "male" | "female";

// Activity multipliers for Mifflin-St Jeor (standard TDEE bands).
export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active";

export interface Settings {
  name?: string;
  unit?: Unit;
  heightCm?: number | null;
  goalKg?: number | null;
  phases?: Phase[];
  sex?: Sex | null;
  birthYear?: number | null;
  activityLevel?: ActivityLevel | null;
  autoActivity?: boolean; // derive activity level from logged workouts
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

export type TDEEMethod = "adaptive" | "formula" | "none";

export interface TDEE {
  value: number | null; // the maintenance kcal/day to use (adaptive preferred, else formula)
  method: TDEEMethod;
  adaptive: number | null; // measured from intake vs weight trend
  formula: number | null; // Mifflin-St Jeor prediction
  avgIntake: number | null; // mean logged intake over the window
  ratePerWeekKg: number; // weight trend used
  daysOfIntake: number; // days with calories logged
}

export type PhaseHealth = "on-track" | "faster" | "slower" | "wrong-way" | "no-data";

export interface PhaseStatus {
  health: PhaseHealth;
  actualRatePerWeek: number;
  targetRatePerWeek: number;
  message: string;
}

// ~7700 kcal per kg of body mass (Wishnofsky's rule; a rough but standard estimate).
export const KCAL_PER_KG = 7700;

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
  return Array.from(byDay.values()).sort((a, b) => a.ts - b.ts);
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

/* ---------------- Phases ---------------- */

// The active phase is the most recently started one.
export function activePhase(phases: Phase[] | undefined | null): Phase | null {
  if (!phases || !phases.length) return null;
  return [...phases].sort((a, b) => b.startTs - a.startTs)[0];
}

export function phaseTypeLabel(type: PhaseType): string {
  if (type === "cut") return "Cut";
  if (type === "bulk") return "Bulk";
  return "Maintain";
}

// Default target rate (kg/week) suggested for a phase type. Signed.
export function defaultPhaseRate(type: PhaseType): number {
  if (type === "cut") return -0.4;
  if (type === "bulk") return 0.25;
  return 0;
}

// Compare the actual trend inside the phase against its target.
export function phaseStatus(
  entries: Entry[],
  phase: Phase,
  windowDays = 21
): PhaseStatus {
  const target = phase.targetRatePerWeek;
  // Only look at readings since the phase started (capped to windowDays).
  const sinceStart = sortByTime(entries).filter((e) => e.ts >= phase.startTs);
  const actual = trendPerWeek(sinceStart, windowDays);
  const daily = dailySeries(sinceStart);

  if (daily.length < 2) {
    return {
      health: "no-data",
      actualRatePerWeek: actual,
      targetRatePerWeek: target,
      message: "Log a few more readings in this phase to see how you're tracking.",
    };
  }

  const TOL = 0.12; // kg/week tolerance band

  // Maintenance: any direction near zero is fine.
  if (phase.type === "maintain") {
    if (Math.abs(actual) <= 0.15) {
      return { health: "on-track", actualRatePerWeek: actual, targetRatePerWeek: target, message: "Holding steady - right where a maintenance phase should be." };
    }
    return {
      health: actual > 0 ? "faster" : "slower",
      actualRatePerWeek: actual,
      targetRatePerWeek: target,
      message:
        actual > 0
          ? "Drifting up a little. Trim intake slightly to hold your weight."
          : "Drifting down a little. Add a little intake to hold your weight.",
    };
  }

  // Wrong direction (e.g. gaining during a cut).
  const cutting = phase.type === "cut";
  const goingRightWay = cutting ? actual < 0 : actual > 0;
  if (!goingRightWay && Math.abs(actual) > 0.05) {
    return {
      health: "wrong-way",
      actualRatePerWeek: actual,
      targetRatePerWeek: target,
      message: cutting
        ? "Trend is up during a cut. Worth reviewing intake this week."
        : "Trend is down during a bulk. You may need to eat a bit more.",
    };
  }

  const diff = actual - target; // negative = losing faster than target (for cut)
  if (Math.abs(diff) <= TOL) {
    return { health: "on-track", actualRatePerWeek: actual, targetRatePerWeek: target, message: "On track - your trend matches this phase's target pace." };
  }

  // For a cut, more-negative-than-target = faster; for a bulk, more-positive = faster.
  const faster = cutting ? actual < target : actual > target;
  return {
    health: faster ? "faster" : "slower",
    actualRatePerWeek: actual,
    targetRatePerWeek: target,
    message: faster
      ? cutting
        ? "Losing faster than planned. Fine short-term, but very fast loss can cost muscle - consider easing up."
        : "Gaining faster than planned - more of this may be fat. Consider easing intake down."
      : cutting
        ? "Slower than your target. A small further cut in intake would nudge it along."
        : "Slower than your target. A small bump in intake would nudge it along.",
  };
}

/* ---------------- TDEE ---------------- */

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: "Sedentary - little exercise",
  light: "Light - 1–3 days/week",
  moderate: "Moderate - 3–5 days/week",
  active: "Active - 6–7 days/week",
  very_active: "Very active - hard training / physical job",
};

// Mifflin-St Jeor basal metabolic rate. Returns kcal/day or null if inputs missing.
export function bmrMifflin(
  kg: number | null,
  heightCm: number | null | undefined,
  age: number | null,
  sex: Sex | null | undefined
): number | null {
  if (!kg || !heightCm || age == null || !sex) return null;
  const base = 10 * kg + 6.25 * heightCm - 5 * age;
  return sex === "male" ? base + 5 : base - 161;
}

// Predicted maintenance (formula) from profile. Null if profile incomplete.
export function formulaTDEE(currentKg: number | null, settings: Settings | null): number | null {
  if (!settings || currentKg == null) return null;
  const age =
    settings.birthYear != null ? new Date().getFullYear() - settings.birthYear : null;
  const bmr = bmrMifflin(currentKg, settings.heightCm, age, settings.sex);
  const activity = settings.activityLevel
    ? ACTIVITY_FACTORS[settings.activityLevel]
    : null;
  if (bmr == null || activity == null) return null;
  return bmr * activity;
}

// Combined TDEE: measured from data when there's enough intake logged (preferred),
// otherwise the Mifflin-St Jeor formula prediction from the profile.
export function estimateTDEE(
  entries: Entry[],
  settings: Settings | null = null,
  windowDays = 14
): TDEE {
  const series = dailySeries(entries);
  const latestTs = series.length ? series[series.length - 1].ts : Date.now();
  const cutoff = latestTs - windowDays * 86400000;
  const currentKg = series.length ? series[series.length - 1].kg : null;

  const withCals = entries.filter(
    (e) => e.ts >= cutoff && e.calories != null && !Number.isNaN(e.calories as number)
  );
  const daysOfIntake = new Set(withCals.map((e) => dayKey(e.ts))).size;
  const ratePerWeekKg = trendPerWeek(entries, windowDays);

  const formula = formulaTDEE(currentKg, settings);

  let adaptive: number | null = null;
  let avgIntake: number | null = null;
  if (daysOfIntake >= 5) {
    avgIntake =
      withCals.reduce((s, e) => s + (e.calories as number), 0) / withCals.length;
    const dailyImbalance = (ratePerWeekKg / 7) * KCAL_PER_KG; // <0 when losing
    adaptive = avgIntake - dailyImbalance;
  }

  const value = adaptive ?? formula ?? null;
  const method: TDEEMethod =
    adaptive != null ? "adaptive" : formula != null ? "formula" : "none";

  return { value, method, adaptive, formula, avgIntake, ratePerWeekKg, daysOfIntake };
}

// Recommended daily intake to hit a target weekly rate, given a TDEE value.
export function recommendedIntake(
  tdee: number,
  targetRatePerWeek: number
): number {
  return tdee + (targetRatePerWeek / 7) * KCAL_PER_KG;
}
