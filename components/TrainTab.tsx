"use client";

import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import { toDisplay, round1, Unit } from "@/lib/stats";
import {
  Workout,
  workoutVolume,
  workoutSets,
  workoutsPerWeek,
  sessionsThisWeek,
  weekStreak,
  avgWorkoutsPerWeek,
  exerciseNames,
  exerciseProgression,
  muscleVolume,
  MUSCLE_LABELS,
} from "@/lib/workouts";

interface TrainProps {
  workouts: Workout[];
  unit: Unit;
  onEdit: (w: Workout) => void;
  onLog: () => void;
}

function vol(kgVolume: number, unit: Unit): number {
  return Math.round(toDisplay(kgVolume, unit) ?? 0);
}

export default function TrainTab({ workouts, unit, onEdit, onLog }: TrainProps) {
  const names = useMemo(() => exerciseNames(workouts), [workouts]);
  const [exercise, setExercise] = useState<string>("");
  const chosen = exercise || names[0] || "";

  if (!workouts.length) {
    return (
      <div className="empty card">
        <p>No workouts logged yet.</p>
        <span>Tap “Log workout” to record your first session.</span>
        <div style={{ marginTop: 16 }}>
          <button className="btn primary" onClick={onLog}>
            ＋ Log workout
          </button>
        </div>
      </div>
    );
  }

  const thisWeek = sessionsThisWeek(workouts);
  const streak = weekStreak(workouts);
  const avg = Math.round(avgWorkoutsPerWeek(workouts, 3) * 10) / 10;
  const weeks = workoutsPerWeek(workouts, 8);
  const weekVol = weeks[weeks.length - 1]?.volume ?? 0;

  const consistency = weeks.map((b) => ({
    label: new Date(b.weekStart).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
    count: b.count,
  }));

  const prog = chosen ? exerciseProgression(workouts, chosen) : [];
  const progData = prog.map((p) => ({
    t: p.ts,
    e1rm: round1(toDisplay(p.best1RM, unit)),
    top: round1(toDisplay(p.topKg, unit)),
  }));

  const muscles = muscleVolume(workouts, 30).map((m) => ({
    label: MUSCLE_LABELS[m.muscle],
    volume: vol(m.volume, unit),
    sets: m.sets,
  }));

  const recent = [...workouts].sort((a, b) => b.ts - a.ts).slice(0, 20);

  return (
    <div className="stack">
      <section className="card">
        <span className="eyebrow">This week</span>
        <div className="train-summary">
          <div className="tsum">
            <span className="tsum-num mono">{thisWeek}</span>
            <span className="tsum-label">sessions</span>
          </div>
          <div className="tsum">
            <span className="tsum-num mono">{streak}</span>
            <span className="tsum-label">week streak</span>
          </div>
          <div className="tsum">
            <span className="tsum-num mono">{avg}</span>
            <span className="tsum-label">avg / week</span>
          </div>
          <div className="tsum">
            <span className="tsum-num mono">{vol(weekVol, unit).toLocaleString()}</span>
            <span className="tsum-label">volume ({unit})</span>
          </div>
        </div>
      </section>

      <section className="card">
        <span className="eyebrow">Weekly consistency · 8 weeks</span>
        <div style={{ marginTop: 10 }}>
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={consistency} margin={{ top: 6, right: 6, bottom: 0, left: -20 }}>
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "var(--muted)", fontSize: 10 }}
                stroke="var(--line)"
                interval={0}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: "var(--muted)", fontSize: 11 }}
                stroke="var(--line)"
                width={34}
              />
              <Tooltip
                cursor={{ fill: "var(--surface-2)" }}
                contentStyle={{
                  background: "var(--surface-3)",
                  border: "1px solid var(--line-strong)",
                  borderRadius: 10,
                  fontSize: 12.5,
                  color: "var(--text)",
                }}
              />
              <Bar dataKey="count" radius={[5, 5, 0, 0]} fill="var(--accent)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {names.length > 0 && (
        <section className="card">
          <div className="chart-head">
            <span className="eyebrow">Load progression</span>
            <select
              className="select sm auto"
              value={chosen}
              onChange={(e) => setExercise(e.target.value)}
            >
              {names.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          {progData.length > 1 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={progData} margin={{ top: 10, right: 10, bottom: 0, left: -12 }}>
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
                  name={`est. 1RM (${unit})`}
                  stroke="var(--accent)"
                  strokeWidth={2.4}
                  dot={{ r: 3, fill: "var(--accent)", strokeWidth: 0 }}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="top"
                  name={`top set (${unit})`}
                  stroke="var(--accent-2)"
                  strokeWidth={1.6}
                  strokeDasharray="4 4"
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="muted-note">
              Log “{chosen}” in at least two sessions to see its progression.
            </p>
          )}
          <div className="legend">
            <span>
              <i className="dot accent" /> est. 1RM
            </span>
            <span>
              <i className="dash accent2d" /> top set
            </span>
          </div>
        </section>
      )}

      {muscles.length > 0 && (
        <section className="card">
          <span className="eyebrow">Volume by muscle · 30 days</span>
          <div style={{ marginTop: 10 }}>
            <ResponsiveContainer width="100%" height={Math.max(150, muscles.length * 34)}>
              <BarChart
                data={muscles}
                layout="vertical"
                margin={{ top: 0, right: 12, bottom: 0, left: 8 }}
              >
                <CartesianGrid stroke="var(--line)" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="label"
                  tick={{ fill: "var(--text-2)", fontSize: 12 }}
                  stroke="var(--line)"
                  width={72}
                />
                <Tooltip
                  cursor={{ fill: "var(--surface-2)" }}
                  contentStyle={{
                    background: "var(--surface-3)",
                    border: "1px solid var(--line-strong)",
                    borderRadius: 10,
                    fontSize: 12.5,
                    color: "var(--text)",
                  }}
                  formatter={(v: number, _n: string, p: { payload?: { sets?: number } }) => [
                    `${v.toLocaleString()} ${unit} · ${p?.payload?.sets ?? 0} sets`,
                    "volume",
                  ]}
                />
                <Bar dataKey="volume" radius={[0, 5, 5, 0]}>
                  {muscles.map((_, i) => (
                    <Cell key={i} fill="var(--accent)" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      <section className="card list">
        <span className="eyebrow" style={{ padding: "4px 8px 8px" }}>
          Recent workouts
        </span>
        {recent.map((w) => {
          const musclesUsed = Array.from(new Set(w.exercises.map((e) => e.muscle)))
            .map((m) => MUSCLE_LABELS[m])
            .join(" · ");
          return (
            <button key={w.id} className="row" onClick={() => onEdit(w)}>
              <div className="row-main">
                <span className="row-weight">
                  {w.title || "Workout"}
                </span>
                <span className="row-date">
                  {new Date(w.ts).toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                  {w.durationMin ? ` · ${w.durationMin} min` : ""}
                </span>
                {musclesUsed ? <span className="row-note">{musclesUsed}</span> : null}
              </div>
              <div className="row-side">
                <span className="row-delta mono">{vol(workoutVolume(w), unit).toLocaleString()} {unit}</span>
                <span className="row-bf mono">
                  {w.exercises.length} ex · {workoutSets(w)} sets
                </span>
              </div>
            </button>
          );
        })}
      </section>
    </div>
  );
}
