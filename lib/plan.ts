// lib/plan.ts — Hugo's 3-day Full Body plan (On Air Fitness Braga Liberdade, Panatta).
// One-tap installable via Settings. Replaces existing routines only; never touches history.

import type { Routine, RoutineExercise, MuscleGroup } from "./workouts";

type PlanRoutine = Omit<Routine, "id" | "createdAt">;

function ex(name: string, muscle: MuscleGroup, count: number, reps: string): RoutineExercise {
  return { name, muscle, sets: Array.from({ length: count }, () => ({ reps, kg: null })) };
}

const DOUBLE_PROG =
  "RPE 8–9 (pernas RPE 8). Dupla progressão: sobe as reps até ao topo do intervalo em todas as séries, depois adiciona a menor carga e volta ao fundo.";

export const TRAINING_PLAN: PlanRoutine[] = [
  {
    name: "Day A — Full Body",
    note: "Peito superior · Dorsais · Quadríceps · Isquios · Deltóide lateral · Tríceps · Gémeos. " + DOUBLE_PROG,
    exercises: [
      ex("Incline Chest Press (machine)", "chest", 4, "8–12"),
      ex("Super Lat Pulldown (Panatta)", "back", 3, "10–12"),
      ex("Leg Press or Hack Squat", "legs", 3, "10–12"),
      ex("Seated Leg Curl", "legs", 3, "10–15"),
      ex("Machine Lateral Raise", "shoulders", 3, "12–20"),
      ex("Overhead Cable Triceps Extension", "arms", 2, "10–15"),
      ex("Standing Calf Raise", "legs", 3, "12–20"),
    ],
  },
  {
    name: "Day B — Full Body",
    note: "Costas (espessura) · Peito inferior · Quadríceps · Glúteos · Deltóide posterior · Bíceps · Deltóide lateral. " + DOUBLE_PROG,
    exercises: [
      ex("Chest-Supported Machine Row", "back", 3, "10–12"),
      ex("Declined Chest Press (Panatta)", "chest", 3, "8–12"),
      ex("One-Leg Extension (per leg)", "legs", 3, "12–15"),
      ex("Glute Bridge Machine", "legs", 3, "10–12"),
      ex("Reverse Pec Deck", "shoulders", 3, "15–20"),
      ex("Incline DB Curl", "arms", 3, "10–15"),
      ex("Machine Lateral Raise", "shoulders", 2, "15–20"),
    ],
  },
  {
    name: "Day C — Full Body",
    note: "Peito (isolamento) · Dorsais · Quadríceps · Isquios · Deltóide lateral · Braços · Glúteos · Abdominais. Supersets no fim. " + DOUBLE_PROG,
    exercises: [
      ex("Super Lower Chest Flight (Panatta)", "chest", 3, "12–15"),
      ex("Single-Arm or Straight-Arm Pulldown", "back", 3, "12–15"),
      ex("Leg Press or Hack Squat", "legs", 3, "10–12"),
      ex("Seated Leg Curl", "legs", 3, "10–15"),
      ex("Machine Lateral Raise", "shoulders", 3, "12–20"),
      ex("Triceps Pushdown (superset)", "arms", 2, "10–15"),
      ex("Preacher Curl (superset)", "arms", 2, "10–15"),
      ex("Hip Abduction (superset)", "legs", 3, "12–15"),
      ex("Machine Crunch (superset)", "core", 3, "12–15"),
    ],
  },
];
