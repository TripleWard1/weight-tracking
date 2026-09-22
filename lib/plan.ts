// lib/plan.ts — Hugo's 3-day Push/Pull/Legs machine hypertrophy plan (On Air Fitness, Panatta).
// One-tap installable via Settings. Replaces existing routines only; never touches history.

import type { Routine, RoutineExercise, MuscleGroup } from "./workouts";

type PlanRoutine = Omit<Routine, "id" | "createdAt">;

function ex(name: string, muscle: MuscleGroup, count: number, reps: string): RoutineExercise {
  return { name, muscle, sets: Array.from({ length: count }, () => ({ reps, kg: null })) };
}

const DOUBLE_PROG =
  "RPE 8–9. Dupla progressão: sobe as reps até ao topo do intervalo em todas as séries, depois adiciona a menor carga e volta ao fundo do intervalo.";

export const TRAINING_PLAN: PlanRoutine[] = [
  {
    name: "Day 1 — Push",
    note: "Peito · Ombros · Tríceps. " + DOUBLE_PROG,
    exercises: [
      ex("Declined Chest Press (Panatta)", "chest", 4, "8–12"),
      ex("Vertical Multi Press / Shoulder Press", "shoulders", 3, "8–12"),
      ex("Super Lower Chest Flight (Panatta)", "chest", 3, "12–15"),
      ex("Machine Lateral Raise", "shoulders", 4, "12–20"),
      ex("Dip Machine (weighted)", "chest", 3, "8–12"),
      ex("Triceps Pushdown (cable)", "arms", 3, "10–15"),
      ex("Overhead Cable Triceps Extension", "arms", 3, "12–15"),
    ],
  },
  {
    name: "Day 2 — Pull",
    note: "Costas · Deltóides posteriores · Bíceps. " + DOUBLE_PROG,
    exercises: [
      ex("Super Lat Pulldown (Panatta)", "back", 4, "10–12"),
      ex("Chest-Supported Machine Row", "back", 4, "10–12"),
      ex("Second Row / Wide Pulldown angle", "back", 3, "10–12"),
      ex("Reverse Pec Deck (rear delts)", "shoulders", 3, "15–20"),
      ex("Machine / Cable Biceps Curl", "arms", 3, "10–12"),
      ex("Incline DB Curl or Preacher", "arms", 3, "10–15"),
    ],
  },
  {
    name: "Day 3 — Legs",
    note: "Quadríceps · Isquiotibiais · Glúteos · Gémeos. Come carbos antes. " + DOUBLE_PROG,
    exercises: [
      ex("Leg Press or Hack Squat (Panatta)", "legs", 4, "10–12"),
      ex("One-Leg Extension (per leg)", "legs", 3, "12–15"),
      ex("Lying/Seated Leg Curl", "legs", 4, "10–15"),
      ex("Standing One-Leg Curl (per leg)", "legs", 3, "10–15"),
      ex("Glute Bridge Machine", "legs", 3, "10–12"),
      ex("Standing + Seated Calf Raise", "legs", 4, "12–20"),
    ],
  },
];
