// lib/plan.ts — Hugo's 3-day Full Body plan, FINAL v5 (On Air Fitness Braga Liberdade).
// Machines + cables, no barbell. One-tap installable via Settings.
// Replaces existing routines only; never touches workout history or weights.

import type { Routine, RoutineExercise, MuscleGroup } from "./workouts";

type PlanRoutine = Omit<Routine, "id" | "createdAt">;

function ex(name: string, muscle: MuscleGroup, count: number, reps: string): RoutineExercise {
  return { name, muscle, sets: Array.from({ length: count }, () => ({ reps, kg: null })) };
}

const RULES =
  "RPE 8–9 (pernas RPE 8). Dupla progressão: topo do intervalo em todas as séries → menor incremento → volta ao fundo do intervalo.";

export const PLAN_NAME = "Full Body Final v5";

export const TRAINING_PLAN: PlanRoutine[] = [
  {
    name: "Day A — Full Body",
    note:
      "Peito superior · Dorsais · Quadríceps · Isquios · Deltóide lateral · Tríceps · Gémeos. Carbos 60–90 min antes. Descanso 2–3 min nos 3 primeiros, 60–90 s no resto. " +
      RULES,
    exercises: [
      ex("HS Iso-Lateral Incline Press", "chest", 3, "8–12"),
      ex("Super Lat Pulldown (Panatta)", "back", 3, "10–12"),
      ex("Leg Press or Hack Squat", "legs", 3, "10–12"),
      ex("Seated Leg Curl", "legs", 3, "10–15"),
      ex("Cable Lateral Raise", "shoulders", 3, "12–20"),
      ex("Dip Machine (weighted)", "arms", 3, "8–12"),
      ex("Standing Calf Raise", "legs", 3, "12–20"),
    ],
  },
  {
    name: "Day B — Full Body",
    note:
      "Costas · Peito · Quadríceps · Glúteos · Deltóide posterior · Bíceps · Deltóide lateral · Lombares. Back extension SÓ com peso corporal nas primeiras 3–4 semanas. " +
      RULES,
    exercises: [
      ex("Chest-Supported Machine Row", "back", 3, "10–12"),
      ex("HS Iso-Lateral Decline Press", "chest", 3, "8–12"),
      ex("One-Leg Extension (per leg)", "legs", 3, "12–15"),
      ex("Glute Bridge Machine", "legs", 3, "10–12"),
      ex("Reverse Pec Deck", "shoulders", 4, "15–20"),
      ex("Bayesian Cable Curl", "arms", 3, "10–15"),
      ex("Machine Lateral Raise", "shoulders", 3, "12–20"),
      ex("Back Extension (machine, bodyweight)", "back", 2, "12–15"),
    ],
  },
  {
    name: "Day C — Full Body",
    note:
      "Peito (isolamento) · Dorsais · Quadríceps · Isquios · Deltóides · Tríceps · Trapézio · Gémeos. Superset tríceps + shrug alternado, 60–90 s após cada par. " +
      RULES,
    exercises: [
      ex("Super Lower Chest Flight (Panatta)", "chest", 3, "12–15"),
      ex("Single-Arm Lat Pulldown", "back", 3, "12–15"),
      ex("Leg Press or Hack Squat", "legs", 3, "10–12"),
      ex("Seated Leg Curl", "legs", 3, "10–15"),
      ex("Machine Lateral Raise", "shoulders", 3, "12–20"),
      ex("Reverse Pec Deck", "shoulders", 2, "15–20"),
      ex("Overhead Cable Triceps Ext. (superset)", "arms", 3, "12–15"),
      ex("Machine Shrug (superset)", "back", 2, "12–15"),
      ex("Seated Calf Raise", "legs", 3, "12–20"),
    ],
  },
];
