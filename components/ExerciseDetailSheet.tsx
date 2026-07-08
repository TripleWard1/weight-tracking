"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { toDisplay, round1, Unit } from "@/lib/stats";
import {
  Workout,
  exerciseProgression,
  exerciseSessions,
  personalRecords,
} from "@/lib/workouts";

interface Props {
  open: boolean;
  name: string | null;
  workouts: Workout[];
  unit: Unit;
  onClose: () => void;
}

export default function ExerciseDetailSheet({ open, name, workouts, unit, onClose }: Props) {
  if (!open || !name) return null;

  const prog = exerciseProgression(workouts, name).map((p) => ({
    t: p.ts,
    e1rm: round1(toDisplay(p.best1RM, unit)),
    top: round1(toDisplay(p.topKg, unit)),
  }));
  const sessions = exerciseSessions(workouts, name).sort((a, b) => b.ts - a.ts);
  const pr = personalRecords(workouts).get(name.trim().toLowerCase());

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div
        className="sheet sheet-tall"
        role="dialog"
        aria-modal="true"
        aria-label={name}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grip" />
        <div className="sheet-head">
          <h2>{name}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="sheet-scroll">
          {pr && (
            <div className="pr-summary">
              <div className="pr-cell">
                <span className="pr-num mono">
                  {round1(toDisplay(pr.best1RM, unit))} {unit}
                </span>
                <span className="pr-label">🏆 best est. 1RM</span>
              </div>
              <div className="pr-cell">
                <span className="pr-num mono">
                  {round1(toDisplay(pr.bestWeight, unit))} {unit} × {pr.bestWeightReps}
                </span>
                <span className="pr-label">heaviest set</span>
              </div>
            </div>
          )}

          {prog.length > 1 ? (
            <div className="card" style={{ marginBottom: 12 }}>
              <span className="eyebrow">Estimated 1RM</span>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={prog} margin={{ top: 12, right: 10, bottom: 0, left: -14 }}>
                  <CartesianGrid stroke="var(--line)" vertical={false} />
                  <XAxis
                    dataKey="t"
                    type="number"
                    scale="time"
                    domain={["dataMin", "dataMax"]}
                    tickFormatter={(t: number) =>
                      new Date(t).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })
                    }
                    tick={{ fill: "var(--muted)", fontSize: 10 }}
                    stroke="var(--line)"
                    minTickGap={26}
                  />
                  <YAxis
                    tick={{ fill: "var(--muted)", fontSize: 11 }}
                    stroke="var(--line)"
                    width={40}
                    domain={["auto", "auto"]}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface-3)",
                      border: "1px solid var(--line-strong)",
                      borderRadius: 10,
                      fontSize: 12.5,
                      color: "var(--text)",
                    }}
                    labelFormatter={(t) =>
                      new Date(t as number).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="e1rm"
                    name={`1RM (${unit})`}
                    stroke="var(--accent)"
                    strokeWidth={2.4}
                    dot={{ r: 3, fill: "var(--accent)", strokeWidth: 0 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="muted-note">Log this exercise again to chart its progression.</p>
          )}

          <div className="card list">
            <span className="eyebrow" style={{ padding: "4px 8px 8px" }}>
              History · {sessions.length} sessions
            </span>
            {sessions.map((s, i) => (
              <div className="row" key={i} style={{ cursor: "default" }}>
                <div className="row-main">
                  <span className="row-weight">
                    {new Date(s.ts).toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                    {s.isPR && <span className="pr-tag">🏆 PR</span>}
                  </span>
                  <span className="row-note">
                    {s.sets
                      .map((set) => `${round1(toDisplay(set.kg, unit)) ?? 0}×${set.reps}`)
                      .join("  ·  ")}
                  </span>
                </div>
                <div className="row-side">
                  <span className="row-delta mono">
                    {round1(toDisplay(s.best1RM, unit))} {unit}
                  </span>
                  <span className="row-bf mono">est. 1RM</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
