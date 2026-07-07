"use client";

import { useEffect, useState } from "react";
import { toKg, toDisplay, round1, Unit } from "@/lib/stats";
import {
  Routine,
  RoutineExercise,
  MuscleGroup,
  MUSCLE_LABELS,
  MUSCLE_ORDER,
  guessMuscle,
} from "@/lib/workouts";

interface EditSet {
  reps: string;
  weight: string;
}
interface EditExercise {
  name: string;
  muscle: MuscleGroup;
  sets: EditSet[];
}

function blankExercise(): EditExercise {
  return {
    name: "",
    muscle: "other",
    sets: [
      { reps: "8-12", weight: "" },
      { reps: "8-12", weight: "" },
      { reps: "8-12", weight: "" },
    ],
  };
}

interface RoutineSheetProps {
  open: boolean;
  unit: Unit;
  editing: Routine | null;
  knownExercises: string[];
  onClose: () => void;
  onSave: (routine: Omit<Routine, "id" | "createdAt">) => void;
  onDelete: (id: string) => void;
}

export default function RoutineSheet({
  open,
  unit,
  editing,
  knownExercises,
  onClose,
  onSave,
  onDelete,
}: RoutineSheetProps) {
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [exercises, setExercises] = useState<EditExercise[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    if (editing) {
      setName(editing.name || "");
      setNote(editing.note || "");
      setExercises(
        editing.exercises.map((ex) => ({
          name: ex.name,
          muscle: ex.muscle,
          sets: ex.sets.map((s) => ({
            reps: s.reps,
            weight: s.kg != null ? String(round1(toDisplay(s.kg, unit)) ?? "") : "",
          })),
        }))
      );
    } else {
      setName("");
      setNote("");
      setExercises([blankExercise()]);
    }
  }, [open, editing, unit]);

  if (!open) return null;

  function patchExercise(i: number, patch: Partial<EditExercise>) {
    setExercises((prev) => prev.map((ex, idx) => (idx === i ? { ...ex, ...patch } : ex)));
  }
  function onName(i: number, value: string) {
    setExercises((prev) =>
      prev.map((ex, idx) => {
        if (idx !== i) return ex;
        const muscle = ex.muscle === "other" ? guessMuscle(value) : ex.muscle;
        return { ...ex, name: value, muscle };
      })
    );
  }
  function addExercise() {
    setExercises((prev) => [...prev, blankExercise()]);
  }
  function removeExercise(i: number) {
    setExercises((prev) => prev.filter((_, idx) => idx !== i));
  }
  function addSet(i: number) {
    setExercises((prev) =>
      prev.map((ex, idx) => {
        if (idx !== i) return ex;
        const last = ex.sets[ex.sets.length - 1];
        return {
          ...ex,
          sets: [...ex.sets, { reps: last?.reps || "8-12", weight: last?.weight || "" }],
        };
      })
    );
  }
  function removeSet(i: number, j: number) {
    setExercises((prev) =>
      prev.map((ex, idx) =>
        idx === i ? { ...ex, sets: ex.sets.filter((_, k) => k !== j) } : ex
      )
    );
  }
  function updateSet(i: number, j: number, field: keyof EditSet, value: string) {
    setExercises((prev) =>
      prev.map((ex, idx) =>
        idx === i
          ? { ...ex, sets: ex.sets.map((s, k) => (k === j ? { ...s, [field]: value } : s)) }
          : ex
      )
    );
  }

  function submit() {
    if (!name.trim()) {
      setError("Give your routine a name.");
      return;
    }
    const built: RoutineExercise[] = [];
    for (const ex of exercises) {
      const exName = ex.name.trim();
      if (!exName) continue;
      const sets = ex.sets
        .filter((s) => s.reps.trim() !== "")
        .map((s) => {
          const w = s.weight.trim() === "" ? null : parseFloat(s.weight.replace(",", "."));
          return {
            reps: s.reps.trim(),
            kg: w != null && !Number.isNaN(w) ? toKg(w, unit) : null,
          };
        });
      if (!sets.length) continue;
      built.push({ name: exName, muscle: ex.muscle, sets });
    }
    if (!built.length) {
      setError("Add at least one exercise with a set.");
      return;
    }
    onSave({ name: name.trim(), note: note.trim(), exercises: built });
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div
        className="sheet sheet-tall"
        role="dialog"
        aria-modal="true"
        aria-label={editing ? "Edit routine" : "New routine"}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grip" />
        <div className="sheet-head">
          <h2>{editing ? "Edit routine" : "New routine"}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="sheet-scroll">
          <label className="field">
            <span>Routine name</span>
            <input
              type="text"
              placeholder="Push A · Upper · Legs…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              autoFocus
            />
          </label>

          <datalist id="known-exercises-routine">
            {knownExercises.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>

          {exercises.map((ex, i) => (
            <div className="ex-block" key={i}>
              <div className="ex-head">
                <input
                  className="ex-name"
                  type="text"
                  list="known-exercises-routine"
                  placeholder="Exercise name"
                  value={ex.name}
                  onChange={(e) => onName(i, e.target.value)}
                />
                <button
                  className="icon-btn sm"
                  onClick={() => removeExercise(i)}
                  aria-label="Remove exercise"
                >
                  ✕
                </button>
              </div>

              <select
                className="select sm"
                value={ex.muscle}
                onChange={(e) =>
                  patchExercise(i, { muscle: e.target.value as MuscleGroup })
                }
              >
                {MUSCLE_ORDER.map((m) => (
                  <option key={m} value={m}>
                    {MUSCLE_LABELS[m]}
                  </option>
                ))}
              </select>

              <div className="set-rows">
                <div className="set-row plan set-head">
                  <span>Set</span>
                  <span>Target reps</span>
                  <span>Weight ({unit})</span>
                  <span />
                </div>
                {ex.sets.map((s, j) => (
                  <div className="set-row plan" key={j}>
                    <span className="set-idx mono">{j + 1}</span>
                    <input
                      type="text"
                      placeholder="8-12"
                      value={s.reps}
                      onChange={(e) => updateSet(i, j, "reps", e.target.value)}
                    />
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.5"
                      placeholder="optional"
                      value={s.weight}
                      onChange={(e) => updateSet(i, j, "weight", e.target.value)}
                      className="mono"
                    />
                    <button
                      className="icon-btn sm"
                      onClick={() => removeSet(i, j)}
                      aria-label="Remove set"
                      disabled={ex.sets.length <= 1}
                    >
                      –
                    </button>
                  </div>
                ))}
              </div>
              <button className="add-set" onClick={() => addSet(i)}>
                ＋ Add set
              </button>
            </div>
          ))}

          <button className="btn ghost block" onClick={addExercise}>
            ＋ Add exercise
          </button>

          <label className="field" style={{ marginTop: 14 }}>
            <span>Note (optional)</span>
            <input
              type="text"
              placeholder="Rest 2 min, RPE 8…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={120}
            />
          </label>

          {error && <p className="sheet-error">{error}</p>}
        </div>

        <div className="sheet-actions">
          {editing && (
            <button
              className="btn ghost danger"
              onClick={() => editing.id && onDelete(editing.id)}
            >
              Delete
            </button>
          )}
          <button className="btn primary" onClick={submit}>
            {editing ? "Save routine" : "Create routine"}
          </button>
        </div>
      </div>
    </div>
  );
}
