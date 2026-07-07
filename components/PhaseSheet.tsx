"use client";

import { useEffect, useState } from "react";
import {
  Phase,
  PhaseType,
  Unit,
  defaultPhaseRate,
  toDisplay,
  toKg,
  round1,
} from "@/lib/stats";

function toLocalInputValue(ts: number): string {
  const d = new Date(ts);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

interface PhaseSheetProps {
  open: boolean;
  unit: Unit;
  active: Phase | null;
  onClose: () => void;
  onSave: (phase: Phase) => void;
  onEnd: () => void;
}

const TYPES: { key: PhaseType; label: string; hint: string }[] = [
  { key: "cut", label: "Cut", hint: "Lose fat" },
  { key: "maintain", label: "Maintain", hint: "Hold steady" },
  { key: "bulk", label: "Bulk", hint: "Build muscle" },
];

export default function PhaseSheet({
  open,
  unit,
  active,
  onClose,
  onSave,
  onEnd,
}: PhaseSheetProps) {
  const [type, setType] = useState<PhaseType>("cut");
  // Target rate is entered as a positive magnitude in the display unit; sign comes from type.
  const [rateMag, setRateMag] = useState("");
  const [startAt, setStartAt] = useState(toLocalInputValue(Date.now()));
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    if (active) {
      setType(active.type);
      const mag = Math.abs(round1(toDisplay(active.targetRatePerWeek, unit)) ?? 0);
      setRateMag(active.type === "maintain" ? "" : String(mag));
      setStartAt(toLocalInputValue(active.startTs));
      setNote(active.note || "");
    } else {
      setType("cut");
      setRateMag(String(Math.abs(round1(toDisplay(defaultPhaseRate("cut"), unit)) ?? 0.4)));
      setStartAt(toLocalInputValue(Date.now()));
      setNote("");
    }
  }, [open, active, unit]);

  if (!open) return null;

  function pickType(t: PhaseType) {
    setType(t);
    if (t === "maintain") setRateMag("");
    else
      setRateMag(String(Math.abs(round1(toDisplay(defaultPhaseRate(t), unit)) ?? 0)));
  }

  function save() {
    let targetKg = 0;
    if (type !== "maintain") {
      const mag = Math.abs(parseFloat(rateMag.replace(",", ".")) || 0);
      const kg = toKg(mag, unit) ?? 0;
      targetKg = type === "cut" ? -kg : kg;
    }
    const startTs = new Date(startAt).getTime() || Date.now();
    onSave({
      id: active?.id || `phase_${Date.now()}`,
      type,
      startTs,
      targetRatePerWeek: targetKg,
      note: note.trim(),
    });
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Training phase"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grip" />
        <div className="sheet-head">
          <h2>{active ? "Edit phase" : "Start a phase"}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="field">
          <span>Type</span>
          <div className="phase-types">
            {TYPES.map((t) => (
              <button
                key={t.key}
                className={"phase-type" + (type === t.key ? " on" : "")}
                onClick={() => pickType(t.key)}
              >
                <strong>{t.label}</strong>
                <em>{t.hint}</em>
              </button>
            ))}
          </div>
        </div>

        {type !== "maintain" && (
          <label className="field">
            <span>
              Target pace ({unit}/week {type === "cut" ? "to lose" : "to gain"})
            </span>
            <input
              type="number"
              inputMode="decimal"
              step="0.05"
              placeholder={unit === "kg" ? "0.4" : "0.9"}
              value={rateMag}
              onChange={(e) => setRateMag(e.target.value)}
              className="mono"
            />
            <span className="field-hint">
              A steady {type === "cut" ? "0.3–0.7" : "0.1–0.3"} {unit}/week is a
              sustainable range for most people.
            </span>
          </label>
        )}

        <label className="field">
          <span>Start date</span>
          <input
            type="datetime-local"
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
          />
        </label>

        <label className="field">
          <span>Note (optional)</span>
          <input
            type="text"
            placeholder="Return to training, easing in…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={120}
          />
        </label>

        <div className="sheet-actions">
          {active && (
            <button className="btn ghost danger" onClick={onEnd}>
              End phase
            </button>
          )}
          <button className="btn primary" onClick={save}>
            {active ? "Save phase" : "Start phase"}
          </button>
        </div>
      </div>
    </div>
  );
}
