"use client";

import { useEffect, useState } from "react";
import { toDisplay, toKg, round1, Unit } from "@/lib/stats";
import {
  Workout,
  Exercise,
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

function toLocalInputValue(ts: number): string {
  const d = new Date(ts);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

interface WorkoutSheetProps {
  open: boolean;
  unit: Unit;
  editing: Workout | null;
  knownExercises: string[];
  onClose: () => void;
  onSave: (workout: Omit<Workout, "id" | "createdAt">) => void;
  onDelete: (id: string) => void;
}

export default function WorkoutSheet({
  open,
  unit,
  editing,
  knownExercises,
  onClose,
  onSave,
  onDelete,
}: WorkoutSheetProps) {
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState(toLocalInputValue(Date.now()));
  const [duration, setDuration] = useState("");
  const [note, setNote] = useState("");
  const [exercises, setExercises] = useState<EditExercise[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    if (editing) {
      setTitle(editing.title || "");
      setWhen(toLocalInputValue(editing.ts));
      setDuration(editing.durationMin != null ? String(editing.durationMin) : "");
      setNote(editing.note || "");
      setExercises(
        editing.exercises.map((ex) => ({
          name: ex.name,
          muscle: ex.muscle,
          sets: ex.sets.map((s) => ({
            reps: String(s.reps),
            weight: String(round1(toDisplay(s.kg, unit)) ?? ""),
          })),
        }))
      );
    } else {
      setTitle("");
      setWhen(toLocalInputValue(Date.now()));
      setDuration("");
      setNote("");
      setExercises([blankExercise()]);
    }
  }, [open, editing, unit]);

  if (!open) return null;

  function blankExercise(): EditExercise {
    return { name: "", muscle: "other", sets: [{ reps: "", weight: "" }] };
  }

  function patchExercise(i: number, patch: Partial<EditExercise>) {
    setExercises((prev) => prev.map((ex, idx) => (idx === i ? { ...ex, ...patch } : ex)));
  }
  function onName(i: number, name: string) {
    setExercises((prev) =>
      prev.map((ex, idx) => {
        if (idx !== i) return ex;
        const muscle = ex.muscle === "other" ? guessMuscle(name) : ex.muscle;
        return { ...ex, name, muscle };
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
        return { ...ex, sets: [...ex.sets, { reps: last?.reps || "", weight: last?.weight || "" }] };
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
          ? {
              ...ex,
              sets: ex.sets.map((s, k) => (k === j ? { ...s, [field]: value } : s)),
            }
          : ex
      )
    );
  }

  function submit() {
    const ts = new Date(when).getTime();
    if (Number.isNaN(ts)) {
      setError("Pick a valid date and time.");
      return;
    }
    const built: Exercise[] = [];
    for (const ex of exercises) {
      const name = ex.name.trim();
      if (!name) continue;
      const sets = ex.sets
        .map((s) => ({
          reps: parseInt(s.reps, 10),
          kg: toKg(parseFloat(s.weight.replace(",", ".")), unit) ?? 0,
        }))
        .filter((s) => !Number.isNaN(s.reps) && s.reps > 0);
      if (!sets.length) continue;
      built.push({ name, muscle: ex.muscle, sets });
    }
    if (!built.length) {
      setError("Add at least one exercise with a set (reps required).");
      return;
    }
    const dur = duration === "" ? null : parseInt(duration, 10);
    onSave({
      ts,
      title: title.trim(),
      note: note.trim(),
      durationMin: dur != null && !Number.isNaN(dur) ? dur : null,
      exercises: built,
    });
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div
        className="sheet sheet-tall"
        role="dialog"
        aria-modal="true"
        aria-label={editing ? "Edit workout" : "Log workout"}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grip" />
        <div className="sheet-head">
          <h2>{editing ? "Edit workout" : "Log workout"}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="sheet-scroll">
          <div className="field-row">
            <label className="field">
              <span>Title (optional)</span>
              <input
                type="text"
                placeholder="Push day"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={60}
              />
            </label>
            <label className="field dur">
              <span>Min</span>
              <input
                type="number"
                inputMode="numeric"
                placeholder="-"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="mono"
              />
            </label>
          </div>

          <label className="field">
            <span>Date &amp; time</span>
            <input
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
            />
          </label>

          <datalist id="known-exercises">
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
                  list="known-exercises"
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
                onChange={(e) => patchExercise(i, { muscle: e.target.value as MuscleGroup })}
              >
                {MUSCLE_ORDER.map((m) => (
                  <option key={m} value={m}>
                    {MUSCLE_LABELS[m]}
                  </option>
                ))}
              </select>

              <div className="set-rows">
                <div className="set-row set-head">
                  <span>Set</span>
                  <span>Reps</span>
                  <span>Weight ({unit})</span>
                  <span />
                </div>
                {ex.sets.map((s, j) => (
                  <div className="set-row" key={j}>
                    <span className="set-idx mono">{j + 1}</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      placeholder="0"
                      value={s.reps}
                      onChange={(e) => updateSet(i, j, "reps", e.target.value)}
                      className="mono"
                    />
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.5"
                      placeholder="0"
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
              placeholder="Felt strong, upped bench…"
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
            {editing ? "Save workout" : "Save workout"}
          </button>
        </div>
      </div>
    </div>
  );
}
