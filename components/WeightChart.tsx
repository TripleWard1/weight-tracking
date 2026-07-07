"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Area,
  TooltipProps,
} from "recharts";
import type { Unit } from "@/lib/stats";

export interface ChartPoint {
  t: number;
  actual: number | null;
  avg: number | null;
  target?: number | null;
}

function fmtDate(ts: number, span: number): string {
  const d = new Date(ts);
  if (span > 200 * 86400000) {
    return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function CustomTooltip({
  active,
  payload,
  unit,
}: TooltipProps<number, string> & { unit: Unit }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload as ChartPoint;
  return (
    <div
      style={{
        background: "var(--surface-3)",
        border: "1px solid var(--line-strong)",
        borderRadius: 10,
        padding: "9px 12px",
        boxShadow: "var(--shadow)",
        fontSize: 12.5,
      }}
    >
      <div style={{ color: "var(--muted)", marginBottom: 4 }}>
        {new Date(p.t).toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
        })}
      </div>
      {p.actual != null && (
        <div style={{ color: "var(--text)" }} className="mono">
          {p.actual.toFixed(1)} {unit}
        </div>
      )}
      {p.avg != null && (
        <div style={{ color: "var(--accent-2)", marginTop: 2 }} className="mono">
          7-day avg {p.avg.toFixed(1)} {unit}
        </div>
      )}
    </div>
  );
}

interface WeightChartProps {
  data: ChartPoint[];
  unit: Unit;
  goal: number | null;
  height?: number;
}

export default function WeightChart({ data, unit, goal, height = 260 }: WeightChartProps) {
  if (!data || data.length === 0) {
    return (
      <div
        style={{
          height,
          display: "grid",
          placeItems: "center",
          color: "var(--muted)",
          fontSize: 14,
        }}
      >
        No readings in this range yet.
      </div>
    );
  }

  const span = data[data.length - 1].t - data[0].t;
  const values = data
    .flatMap((d) => [d.actual, d.avg, d.target ?? null])
    .filter((v): v is number => v != null);
  if (goal != null) values.push(goal);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max(0.5, (max - min) * 0.12);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 10, bottom: 4, left: -12 }}>
        <defs>
          <linearGradient id="avgFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-2)" stopOpacity={0.18} />
            <stop offset="100%" stopColor="var(--accent-2)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--line)" vertical={false} />
        <XAxis
          dataKey="t"
          type="number"
          scale="time"
          domain={["dataMin", "dataMax"]}
          tickFormatter={(t: number) => fmtDate(t, span)}
          tick={{ fill: "var(--muted)", fontSize: 11 }}
          stroke="var(--line)"
          minTickGap={28}
        />
        <YAxis
          domain={[min - pad, max + pad]}
          tick={{ fill: "var(--muted)", fontSize: 11 }}
          stroke="var(--line)"
          width={44}
          tickFormatter={(v: number) => v.toFixed(0)}
        />
        <Tooltip content={<CustomTooltip unit={unit} />} />
        {goal != null && (
          <ReferenceLine
            y={goal}
            stroke="var(--warn)"
            strokeDasharray="5 5"
            strokeWidth={1.4}
            label={{
              value: `goal ${goal.toFixed(1)}`,
              position: "insideTopRight",
              fill: "var(--warn)",
              fontSize: 11,
            }}
          />
        )}
        <Area
          type="monotone"
          dataKey="avg"
          stroke="none"
          fill="url(#avgFill)"
          isAnimationActive={false}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="target"
          stroke="var(--muted)"
          strokeWidth={1.6}
          strokeDasharray="2 4"
          dot={false}
          isAnimationActive={false}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="actual"
          stroke="var(--accent)"
          strokeWidth={1.4}
          strokeOpacity={0.55}
          dot={{ r: 2, fill: "var(--accent)", strokeWidth: 0 }}
          activeDot={{ r: 4 }}
          isAnimationActive={false}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="avg"
          stroke="var(--accent-2)"
          strokeWidth={2.6}
          dot={false}
          isAnimationActive={false}
          connectNulls
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
