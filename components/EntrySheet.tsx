"use client";

import { useEffect, useState } from "react";
import { toKg, toDisplay, round1, Entry, Unit } from "@/lib/stats";

function toLocalInputValue(ts: number): string {
  const d = new Date(ts);
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 16);
}

export interface EntryInput {
  kg: number;
  ts: number;
  bodyFat: number | null;
  calories: number | null;
  note: string;
}

interface EntrySheetProps {
  open: boolean;
  unit: Unit;
  editing: Entry | null;
  onClose: () => void;
  onSave: (entry: EntryInput) => void;
  onDelete: (id: string) => void;
}

export default function EntrySheet({
  open,
  unit,
  editing,
  onClose,
  onSave,
  onDelete,
}: EntrySheetProps) {
  const [weight, setWeight] = useState("");
  const [when, setWhen] = useState(toLocalInputValue(Date.now()));
  const [bodyFat, setBodyFat] = useState("");
  const [calories, setCalories] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    if (editing) {
      setWeight(String(round1(toDisplay(editing.kg, unit)) ?? ""));
      setWhen(toLocalInputValue(editing.ts));
      setBodyFat(editing.bodyFat != null ? String(editing.bodyFat) : "");
      setCalories(editing.calories != null ? String(editing.calories) : "");
      setNote(editing.note || "");
    } else {
      setWeight("");
      setWhen(toLocalInputValue(Date.now()));
      setBodyFat("");
      setCalories("");
      setNote("");
    }
  }, [open, editing, unit]);

  if (!open) return null;

  function submit() {
    const num = parseFloat(weight.replace(",", "."));
    if (!num || num <= 0) {
      setError("Enter a weight above zero.");
      return;
    }
    const ts = new Date(when).getTime();
    if (Number.isNaN(ts)) {
      setError("Pick a valid date and time.");
      return;
    }
    const bf = bodyFat === "" ? null : parseFloat(bodyFat.replace(",", "."));
    const cal = calories === "" ? null : parseFloat(calories.replace(",", "."));
    onSave({
      kg: toKg(num, unit) as number,
      ts,
      bodyFat: bf != null && !Number.isNaN(bf) ? bf : null,
      calories: cal != null && !Number.isNaN(cal) ? cal : null,
      note: note.trim(),
    });
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={editing ? "Edit reading" : "Log weight"}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grip" />
        <div className="sheet-head">
          <h2>{editing ? "Edit reading" : "Log weight"}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <label className="field big">
          <span>Weight ({unit})</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            autoFocus
            placeholder="0.0"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="mono"
          />
        </label>

        <label className="field">
          <span>Date &amp; time</span>
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
          />
        </label>

        <div className="field-row">
          <label className="field">
            <span>Body fat % (optional)</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              placeholder="—"
              value={bodyFat}
              onChange={(e) => setBodyFat(e.target.value)}
              className="mono"
            />
          </label>
          <label className="field">
            <span>Calories today (optional)</span>
            <input
              type="number"
              inputMode="numeric"
              step="10"
              placeholder="kcal"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              className="mono"
            />
          </label>
        </div>

        <label className="field">
          <span>Note (optional)</span>
          <input
            type="text"
            placeholder="After training, fasted…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={120}
          />
        </label>

        {error && <p className="sheet-error">{error}</p>}

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
            {editing ? "Save changes" : "Save reading"}
          </button>
        </div>
      </div>
    </div>
  );
}
