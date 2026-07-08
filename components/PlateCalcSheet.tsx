"use client";

import { useState, useEffect } from "react";
import { Unit } from "@/lib/stats";
import {
  platesPerSide,
  KG_PLATES,
  LB_PLATES,
  DEFAULT_BAR_KG,
  DEFAULT_BAR_LB,
} from "@/lib/workouts";

interface Props {
  open: boolean;
  unit: Unit;
  onClose: () => void;
}

// Plate colours (IPF-ish) for the visual stack.
const PLATE_COLOR: Record<number, string> = {
  25: "#e2564d",
  20: "#4a77d6",
  15: "#e0a53a",
  10: "#3fa66a",
  5: "#d8dde6",
  2.5: "#8a93a6",
  1.25: "#6b7383",
  45: "#e2564d",
  35: "#4a77d6",
};

export default function PlateCalcSheet({ open, unit, onClose }: Props) {
  const barDefault = unit === "lb" ? DEFAULT_BAR_LB : DEFAULT_BAR_KG;
  const plates = unit === "lb" ? LB_PLATES : KG_PLATES;
  const [target, setTarget] = useState("");
  const [bar, setBar] = useState(String(barDefault));

  useEffect(() => {
    if (open) setBar(String(unit === "lb" ? DEFAULT_BAR_LB : DEFAULT_BAR_KG));
  }, [open, unit]);

  if (!open) return null;

  const targetNum = parseFloat(target.replace(",", ".")) || 0;
  const barNum = parseFloat(bar.replace(",", ".")) || 0;
  const result = platesPerSide(targetNum, barNum, plates);

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Plate calculator"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grip" />
        <div className="sheet-head">
          <h2>Plate calculator</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="field-row">
          <label className="field">
            <span>Target total ({unit})</span>
            <input
              type="number"
              inputMode="decimal"
              step="2.5"
              autoFocus
              placeholder="100"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="mono"
            />
          </label>
          <label className="field">
            <span>Bar ({unit})</span>
            <input
              type="number"
              inputMode="decimal"
              step="2.5"
              value={bar}
              onChange={(e) => setBar(e.target.value)}
              className="mono"
            />
          </label>
        </div>

        {targetNum > 0 && (
          <div className="plate-result">
            {result.perSide.length ? (
              <>
                <span className="plate-caption">Per side:</span>
                <div className="plate-stack">
                  {result.perSide.flatMap(({ plate, count }) =>
                    Array.from({ length: count }).map((_, k) => (
                      <span
                        key={`${plate}-${k}`}
                        className="plate-chip"
                        style={{ background: PLATE_COLOR[plate] || "var(--surface-3)" }}
                      >
                        {plate}
                      </span>
                    ))
                  )}
                </div>
                <div className="plate-lines">
                  {result.perSide.map(({ plate, count }) => (
                    <span key={plate} className="mono">
                      {count} × {plate}{unit}
                    </span>
                  ))}
                </div>
                {result.leftover > 0 && (
                  <p className="plate-leftover">
                    {result.leftover}{unit}/side can’t be matched with standard plates.
                  </p>
                )}
              </>
            ) : (
              <p className="muted-note">
                Target is at or below the bar weight - no plates needed.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
