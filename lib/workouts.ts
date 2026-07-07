// lib/workouts.ts
// Strength-training log: workouts -> exercises -> sets. Weights stored in KG.

import type { ActivityLevel } from "./stats";
import { toDisplay, round1, type Unit } from "./stats";

export type MuscleGroup =
  | "chest"
  | "back"
  | "shoulders"
  | "legs"
  | "arms"
  | "core"
  | "other";

export interface SetEntry {
  reps: number;
  kg: number;
}

export interface Exercise {
  name: string;
  muscle: MuscleGroup;
  sets: SetEntry[];
}

export interface Workout {
  id?: string;
  ts: number; // epoch ms
  title?: string;
  note?: string;
  durationMin?: number | null;
  exercises: Exercise[];
  createdAt?: unknown;
}

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: "Chest",
  back: "Back",
  shoulders: "Shoulders",
  legs: "Legs",
  arms: "Arms",
  core: "Core",
  other: "Other",
};

export const MUSCLE_ORDER: MuscleGroup[] = [
  "chest",
  "back",
  "shoulders",
  "legs",
  "arms",
  "core",
  "other",
];

// Light auto-classification of common lifts to a muscle group.
const EXERCISE_MUSCLE: { re: RegExp; muscle: MuscleGroup }[] = [
  { re: /bench|chest|fly|pec|dip|push[- ]?up/i, muscle: "chest" },
  { re: /row|pull[- ]?up|chin|lat|deadlift|pulldown|back|shrug/i, muscle: "back" },
  { re: /shoulder|press|ohp|lateral|delt|raise|arnold/i, muscle: "shoulders" },
  { re: /squat|leg|lunge|calf|hamstring|quad|glute|hip thrust|rdl/i, muscle: "legs" },
  { re: /curl|tricep|bicep|extension|pushdown|skull/i, muscle: "arms" },
  { re: /ab|core|plank|crunch|obliques|leg raise/i, muscle: "core" },
];

export function guessMuscle(name: string): MuscleGroup {
  for (const m of EXERCISE_MUSCLE) if (m.re.test(name)) return m.muscle;
  return "other";
}

// Estimated 1-rep max (Epley). reps=1 returns the weight itself.
export function epley1RM(kg: number, reps: number): number {
  if (!kg || !reps) return 0;
  return kg * (1 + reps / 30);
}

export function exerciseVolume(ex: Exercise): number {
  return ex.sets.reduce((s, set) => s + (set.reps || 0) * (set.kg || 0), 0);
}

export function exerciseTopKg(ex: Exercise): number {
  return ex.sets.reduce((m, set) => Math.max(m, set.kg || 0), 0);
}

export function exerciseBest1RM(ex: Exercise): number {
  return ex.sets.reduce((m, set) => Math.max(m, epley1RM(set.kg || 0, set.reps || 0)), 0);
}

export function workoutVolume(w: Workout): number {
  return w.exercises.reduce((s, ex) => s + exerciseVolume(ex), 0);
}

export function workoutSets(w: Workout): number {
  return w.exercises.reduce((s, ex) => s + ex.sets.length, 0);
}

export function sortWorkouts(workouts: Workout[]): Workout[] {
  return [...workouts].sort((a, b) => a.ts - b.ts);
}

// Local week start (Monday 00:00).
export function startOfWeek(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7; // Mon=0 .. Sun=6
  d.setDate(d.getDate() - day);
  return d.getTime();
}

export interface WeekBucket {
  weekStart: number;
  count: number;
  volume: number;
}

// Sessions + volume per week for the last `weeks` weeks (oldest first).
export function workoutsPerWeek(workouts: Workout[], weeks = 8): WeekBucket[] {
  const thisWeek = startOfWeek(Date.now());
  const buckets: WeekBucket[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    buckets.push({ weekStart: thisWeek - i * 7 * 86400000, count: 0, volume: 0 });
  }
  const index = new Map(buckets.map((b, i) => [b.weekStart, i]));
  for (const w of workouts) {
    const ws = startOfWeek(w.ts);
    const i = index.get(ws);
    if (i != null) {
      buckets[i].count += 1;
      buckets[i].volume += workoutVolume(w);
    }
  }
  return buckets;
}

export function sessionsThisWeek(workouts: Workout[]): number {
  const ws = startOfWeek(Date.now());
  return workouts.filter((w) => startOfWeek(w.ts) === ws).length;
}

// Consecutive weeks (ending this or last week) with at least one session.
export function weekStreak(workouts: Workout[]): number {
  if (!workouts.length) return 0;
  const weeksWith = new Set(workouts.map((w) => startOfWeek(w.ts)));
  const thisWeek = startOfWeek(Date.now());
  let cursor = thisWeek;
  // Allow the streak to still count if this week is empty but last week wasn't.
  if (!weeksWith.has(cursor) && weeksWith.has(cursor - 7 * 86400000)) {
    cursor -= 7 * 86400000;
  }
  let count = 0;
  while (weeksWith.has(cursor)) {
    count++;
    cursor -= 7 * 86400000;
  }
  return count;
}

export function avgWorkoutsPerWeek(workouts: Workout[], weeks = 3): number {
  if (!workouts.length) return 0;
  const buckets = workoutsPerWeek(workouts, weeks);
  const total = buckets.reduce((s, b) => s + b.count, 0);
  return total / weeks;
}

// Map average weekly sessions to an activity level for the TDEE formula.
export function activityFromWorkoutsPerWeek(n: number): ActivityLevel {
  if (n < 0.5) return "sedentary";
  if (n < 3) return "light";
  if (n < 5) return "moderate";
  if (n < 7) return "active";
  return "very_active";
}

export function deriveActivityLevel(workouts: Workout[]): ActivityLevel {
  return activityFromWorkoutsPerWeek(avgWorkoutsPerWeek(workouts, 3));
}

// Unique exercise names across all workouts (sorted, by recent usage frequency).
export function exerciseNames(workouts: Workout[]): string[] {
  const seen = new Map<string, number>();
  for (const w of workouts) {
    for (const ex of w.exercises) {
      const key = ex.name.trim();
      if (!key) continue;
      seen.set(key, (seen.get(key) || 0) + 1);
    }
  }
  return [...seen.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
}

export interface ProgressionPoint {
  ts: number;
  topKg: number;
  best1RM: number;
  volume: number;
}

// Progression for one exercise across the workouts that include it.
export function exerciseProgression(
  workouts: Workout[],
  name: string
): ProgressionPoint[] {
  const target = name.trim().toLowerCase();
  const points: ProgressionPoint[] = [];
  for (const w of sortWorkouts(workouts)) {
    for (const ex of w.exercises) {
      if (ex.name.trim().toLowerCase() === target) {
        points.push({
          ts: w.ts,
          topKg: exerciseTopKg(ex),
          best1RM: exerciseBest1RM(ex),
          volume: exerciseVolume(ex),
        });
      }
    }
  }
  return points;
}

export interface MuscleVolume {
  muscle: MuscleGroup;
  volume: number;
  sets: number;
}

// Total volume + set count per muscle group over the last `days`.
export function muscleVolume(workouts: Workout[], days = 30): MuscleVolume[] {
  const cutoff = Date.now() - days * 86400000;
  const totals = new Map<MuscleGroup, { volume: number; sets: number }>();
  for (const w of workouts) {
    if (w.ts < cutoff) continue;
    for (const ex of w.exercises) {
      const cur = totals.get(ex.muscle) || { volume: 0, sets: 0 };
      cur.volume += exerciseVolume(ex);
      cur.sets += ex.sets.length;
      totals.set(ex.muscle, cur);
    }
  }
  return MUSCLE_ORDER.map((m) => ({
    muscle: m,
    volume: totals.get(m)?.volume || 0,
    sets: totals.get(m)?.sets || 0,
  })).filter((x) => x.volume > 0 || x.sets > 0);
}

export function workoutDayKeys(workouts: Workout[]): Set<string> {
  const s = new Set<string>();
  for (const w of workouts) {
    const d = new Date(w.ts);
    s.add(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`
    );
  }
  return s;
}

/* ---------------- Routines (planned workouts / templates) ---------------- */

// Planned set: reps as a string so ranges like "8-12" are allowed; weight optional.
export interface RoutineSet {
  reps: string;
  kg: number | null;
}
export interface RoutineExercise {
  name: string;
  muscle: MuscleGroup;
  sets: RoutineSet[];
}
export interface Routine {
  id?: string;
  name: string;
  note?: string;
  exercises: RoutineExercise[];
  createdAt?: unknown;
}

// Draft structures used by the logger UI (display-unit strings while editing).
export interface DraftSet {
  reps: string;
  weight: string;
}
export interface DraftExercise {
  name: string;
  muscle: MuscleGroup;
  sets: DraftSet[];
}
export interface Draft {
  title: string;
  exercises: DraftExercise[];
}

export interface Performance {
  ts: number;
  sets: SetEntry[];
}

// Most recent performance of a named exercise (optionally strictly before a time).
export function lastPerformance(
  workouts: Workout[],
  name: string,
  beforeTs?: number
): Performance | null {
  const target = name.trim().toLowerCase();
  if (!target) return null;
  const sorted = [...workouts].sort((a, b) => b.ts - a.ts); // newest first
  for (const w of sorted) {
    if (beforeTs != null && w.ts >= beforeTs) continue;
    for (const ex of w.exercises) {
      if (ex.name.trim().toLowerCase() === target) {
        return { ts: w.ts, sets: ex.sets };
      }
    }
  }
  return null;
}

// "60×8 · 60×8 · 55×6" in the display unit (weights rounded).
export function performanceLabel(perf: Performance | null, unit: Unit): string | null {
  if (!perf || !perf.sets.length) return null;
  return perf.sets
    .map((s) => `${round1(toDisplay(s.kg, unit)) ?? 0}×${s.reps}`)
    .join(" · ");
}

// Build a logging draft from a routine, carrying over last time's weights so you
// can match or beat them (progressive overload).
export function draftFromRoutine(
  routine: Routine,
  workouts: Workout[],
  unit: Unit
): Draft {
  const exercises: DraftExercise[] = routine.exercises.map((rx) => {
    const last = lastPerformance(workouts, rx.name);
    const sets: DraftSet[] = rx.sets.map((ps, i) => {
      const lastSet = last?.sets[i];
      const weightKg = lastSet?.kg ?? ps.kg ?? null;
      return {
        reps: lastSet?.reps != null ? String(lastSet.reps) : "",
        weight: weightKg != null ? String(round1(toDisplay(weightKg, unit)) ?? "") : "",
      };
    });
    return { name: rx.name, muscle: rx.muscle, sets };
  });
  return { title: routine.name, exercises };
}

export function routineSetCount(r: Routine): number {
  return r.exercises.reduce((s, ex) => s + ex.sets.length, 0);
}
