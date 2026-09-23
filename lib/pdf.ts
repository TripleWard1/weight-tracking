// lib/pdf.ts — dependency-free progress report.
// Builds a styled HTML document with inline SVG charts and opens the browser's
// print dialog (choose "Save as PDF"). No external libraries required.
import {
  Entry,
  Settings,
  Unit,
  toDisplay,
  round1,
  dailySeries,
  movingAverage,
  summarize,
} from "./stats";
import {
  Workout,
  exerciseNames,
  exerciseProgression,
  personalRecords,
  workoutVolume,
  muscleVolume,
  avgWorkoutsPerWeek,
  weekStreak,
  MUSCLE_LABELS,
} from "./workouts";

const ACCENT = "#0fb7a4";
const ACCENT2 = "#5b63e0";
const INK = "#131824";
const MUTED = "#6a7488";
const WARN = "#d67d2c";
const LINE = "#e2e6ee";

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;"
  );
}
function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
function fmtShort(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

interface Pt {
  t: number;
  v: number;
}
interface Series {
  points: Pt[];
  color: string;
  dash?: boolean;
  width?: number;
}

function chartSVG(series: Series[], unit: string, W = 680, H = 190): string {
  const all = series.flatMap((s) => s.points);
  if (all.length < 2)
    return `<div class="nodata">Not enough data to chart yet.</div>`;
  const pad = { l: 40, r: 14, t: 10, b: 24 };
  const ts = all.map((p) => p.t);
  const vs = all.map((p) => p.v);
  let tMin = Math.min(...ts);
  let tMax = Math.max(...ts);
  let vMin = Math.min(...vs);
  let vMax = Math.max(...vs);
  if (tMax === tMin) tMax = tMin + 1;
  const vpad = Math.max(0.5, (vMax - vMin) * 0.12);
  vMin -= vpad;
  vMax += vpad;
  if (vMax === vMin) vMax += 1;
  const x = (t: number) => pad.l + ((t - tMin) / (tMax - tMin)) * (W - pad.l - pad.r);
  const y = (v: number) => H - pad.b - ((v - vMin) / (vMax - vMin)) * (H - pad.t - pad.b);

  let grid = "";
  for (let i = 0; i <= 3; i++) {
    const v = vMin + ((vMax - vMin) * i) / 3;
    const gy = y(v);
    grid += `<line x1="${pad.l}" y1="${gy}" x2="${W - pad.r}" y2="${gy}" stroke="${LINE}" stroke-width="1"/>`;
    grid += `<text x="${pad.l - 6}" y="${gy + 3}" text-anchor="end" font-size="9" fill="${MUTED}">${Math.round(v)}</text>`;
  }
  grid += `<text x="${pad.l}" y="${H - 6}" font-size="9" fill="${MUTED}">${fmtShort(tMin)}</text>`;
  grid += `<text x="${W - pad.r}" y="${H - 6}" text-anchor="end" font-size="9" fill="${MUTED}">${fmtShort(tMax)}</text>`;

  let lines = "";
  for (const s of series) {
    const pts = [...s.points].sort((a, b) => a.t - b.t);
    if (pts.length < 2) continue;
    const d = pts.map((p) => `${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
    lines += `<polyline fill="none" stroke="${s.color}" stroke-width="${s.width ?? 2}" ${
      s.dash ? 'stroke-dasharray="4 4"' : ""
    } points="${d}"/>`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="xMidYMid meet">${grid}${lines}<text x="${
    W - pad.r
  }" y="12" text-anchor="end" font-size="9" fill="${MUTED}">${unit}</text></svg>`;
}

export function generateReport(
  entries: Entry[],
  workouts: Workout[],
  settings: Settings | null,
  unit: Unit
) {
  const name = settings?.name || "Athlete";
  const s = summarize(entries);
  const daily = dailySeries(entries);
  const firstTs = daily.length ? daily[0].ts : Date.now();
  const lastTs = daily.length ? daily[daily.length - 1].ts : Date.now();
  const weeks = Math.max(1, (lastTs - firstTs) / (7 * 86400000));
  const rate = s.totalChange != null ? s.totalChange / weeks : 0;
  const d = (v: number | null | undefined) =>
    v == null ? "—" : `${round1(toDisplay(v, unit))}`;

  // KPIs
  const kpis = [
    { label: `Current (${unit})`, value: d(s.current) },
    {
      label: `Change (${unit})`,
      value: s.totalChange != null ? `${s.totalChange <= 0 ? "" : "+"}${d(s.totalChange)}` : "—",
      color: s.totalChange != null && s.totalChange <= 0 ? ACCENT : WARN,
    },
    {
      label: `Rate (${unit}/wk)`,
      value: `${rate <= 0 ? "" : "+"}${d(rate)}`,
      color: rate <= 0 ? ACCENT : WARN,
    },
    { label: "Workouts", value: `${workouts.length}` },
    { label: "Exercises", value: `${exerciseNames(workouts).length}` },
  ];
  const kpiHTML = kpis
    .map(
      (k) =>
        `<div class="kpi"><div class="kpi-v" style="color:${k.color || INK}">${k.value}</div><div class="kpi-l">${k.label}</div></div>`
    )
    .join("");

  // Weight chart
  let weightChart = `<div class="nodata">Not enough weight readings yet.</div>`;
  if (daily.length > 1) {
    const actual = daily.map((p) => ({ t: p.ts, v: toDisplay(p.kg, unit) as number }));
    const ma = movingAverage(entries, 7).map((m) => ({ t: m.ts, v: toDisplay(m.avg, unit) as number }));
    weightChart = chartSVG(
      [
        { points: actual, color: ACCENT, width: 1.2 },
        { points: ma, color: ACCENT2, width: 2.4 },
      ],
      unit
    );
  }

  // Milestones
  const goalKg = settings?.goalKg ?? null;
  const mRows = [
    ["Start", `${d(s.start)} ${unit}`],
    ["Current", `${d(s.current)} ${unit}`],
    ["Lowest", `${d(s.min)} ${unit}`],
    ["Highest", `${d(s.max)} ${unit}`],
    ["Total change", s.totalChange != null ? `${s.totalChange <= 0 ? "" : "+"}${d(s.totalChange)} ${unit}` : "—"],
    ["Avg rate", `${rate <= 0 ? "" : "+"}${d(rate)} ${unit}/week`],
  ];
  if (goalKg != null) mRows.push(["Goal", `${d(goalKg)} ${unit}`]);
  const mHTML = mRows.map((r) => `<tr><td>${r[0]}</td><td class="num">${r[1]}</td></tr>`).join("");

  // Progressive overload per exercise
  const names = exerciseNames(workouts);
  const prs = personalRecords(workouts);
  const exBlocks = names
    .map((nm) => {
      const prog = exerciseProgression(workouts, nm);
      if (!prog.length) return "";
      const first1 = prog[0].best1RM;
      const last1 = prog[prog.length - 1].best1RM;
      const delta = last1 - first1;
      const pr = prs.get(nm.trim().toLowerCase());
      const chart = chartSVG([{ points: prog.map((p) => ({ t: p.ts, v: toDisplay(p.best1RM, unit) as number })), color: ACCENT, width: 2 }], unit, 680, 150);
      return `<div class="ex">
        <div class="ex-head">
          <div class="ex-name">${esc(nm)}</div>
          <div class="ex-delta" style="color:${delta >= 0 ? ACCENT : WARN}">${delta >= 0 ? "▲" : "▼"} ${Math.abs(round1(toDisplay(delta, unit)) ?? 0)} ${unit}</div>
        </div>
        <div class="ex-stats">${prog.length} sessions &nbsp;•&nbsp; 1RM ${d(first1)}→${d(last1)} ${unit}${
          pr ? ` &nbsp;•&nbsp; best ${d(pr.best1RM)} ${unit}` : ""
        }</div>
        ${chart}
      </div>`;
    })
    .join("");

  // Training summary + muscle + PR tables
  const totalVol = workouts.reduce((a, w) => a + workoutVolume(w), 0);
  const sumRows = [
    ["Total workouts", `${workouts.length}`],
    ["Avg workouts / week", `${Math.round(avgWorkoutsPerWeek(workouts, 8) * 10) / 10}`],
    ["Current week streak", `${weekStreak(workouts)}`],
    ["Total volume", `${Math.round(toDisplay(totalVol, unit) ?? 0).toLocaleString()} ${unit}`],
  ]
    .map((r) => `<tr><td>${r[0]}</td><td class="num">${r[1]}</td></tr>`)
    .join("");

  const mv = muscleVolume(workouts, 3650).sort((a, b) => b.volume - a.volume);
  const mvHTML = mv
    .map(
      (m) =>
        `<tr><td>${MUSCLE_LABELS[m.muscle]}</td><td class="num">${m.sets}</td><td class="num">${Math.round(
          toDisplay(m.volume, unit) ?? 0
        ).toLocaleString()}</td></tr>`
    )
    .join("");

  const prHTML = names
    .map((nm) => {
      const pr = prs.get(nm.trim().toLowerCase());
      if (!pr) return "";
      return `<tr><td>${esc(nm)}</td><td class="num">${d(pr.best1RM)} ${unit}</td><td class="num">${d(pr.bestWeight)}×${pr.bestWeightReps}</td><td class="num">${fmtShort(pr.best1RMTs)}</td></tr>`;
    })
    .filter(Boolean)
    .join("");

  const hasTraining = workouts.length > 0;

  const html = `<!doctype html><html><head><meta charset="utf-8"/>
<title>Mercury — ${esc(name)} — Progress Report</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: ${INK}; margin: 0; padding: 0; }
  .wrap { max-width: 720px; margin: 0 auto; padding: 24px; }
  .top { background: ${INK}; color: #fff; border-radius: 12px; padding: 20px 22px; display: flex; justify-content: space-between; align-items: center; }
  .brand { display:flex; align-items:center; gap:10px; font-size: 20px; font-weight: 700; }
  .dot { width: 13px; height: 13px; border-radius: 50%; background: ${ACCENT}; display:inline-block; }
  .top .sub { color: #b6bece; font-size: 12px; margin-top: 3px; font-weight: 400; }
  .top .right { text-align: right; font-size: 12px; color:#cfd5e0; }
  h2 { font-size: 15px; margin: 26px 0 10px; }
  .range { color: ${MUTED}; font-size: 12px; margin-top: 14px; }
  .kpis { display: grid; grid-template-columns: repeat(5,1fr); gap: 8px; margin-top: 8px; }
  .kpi { background: #f4f6f9; border-radius: 8px; padding: 12px 6px; text-align: center; }
  .kpi-v { font-size: 16px; font-weight: 700; }
  .kpi-l { font-size: 8.5px; color: ${MUTED}; text-transform: uppercase; letter-spacing: .04em; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { text-align: left; padding: 6px 8px; border: 1px solid ${LINE}; }
  th { background: ${INK}; color:#fff; font-weight:600; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  tr:nth-child(even) td { background: #f8fafc; }
  .half { width: 60%; }
  .legend { font-size: 11px; color: ${MUTED}; margin-top: 4px; }
  .legend b { display:inline-block; width:10px; height:3px; vertical-align: middle; margin-right:4px; }
  .ex { border: 1px solid ${LINE}; border-radius: 10px; padding: 12px 14px; margin-bottom: 12px; page-break-inside: avoid; }
  .ex-head { display:flex; justify-content: space-between; align-items:center; }
  .ex-name { font-weight: 700; font-size: 13px; }
  .ex-delta { font-weight: 700; font-size: 13px; }
  .ex-stats { color: ${MUTED}; font-size: 11px; margin: 2px 0 6px; }
  .nodata { color: ${MUTED}; font-size: 12px; padding: 10px 0; }
  .printbar { position: sticky; top: 0; background: ${ACCENT}; color: #04241f; text-align: center; padding: 10px; font-weight: 700; cursor: pointer; }
  @media print { .printbar { display: none; } .wrap { padding: 0; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } h2 { page-break-after: avoid; } }
  @page { margin: 14mm; }
</style></head>
<body>
<div class="printbar" onclick="window.print()">▼ Guardar como PDF / Imprimir</div>
<div class="wrap">
  <div class="top">
    <div><div class="brand"><span class="dot"></span>Mercury</div><div class="sub">Progress Report</div></div>
    <div class="right">${fmtDate(Date.now())}<br/>${esc(name)}</div>
  </div>
  ${daily.length ? `<div class="range">Weight data: ${fmtDate(firstTs)} — ${fmtDate(lastTs)}</div>` : ""}
  <div class="kpis">${kpiHTML}</div>

  <h2>Weight progression</h2>
  ${weightChart}
  ${daily.length > 1 ? `<div class="legend"><span><b style="background:${ACCENT}"></b>daily</span> &nbsp; <span><b style="background:${ACCENT2}"></b>7-day average</span></div>` : ""}

  <h2>Milestones</h2>
  <table class="half"><tbody>${mHTML}</tbody></table>

  ${
    hasTraining && exBlocks
      ? `<h2>Progressive overload</h2><div class="ex-stats">Estimated 1RM progression per exercise, oldest to latest.</div>${exBlocks}`
      : ""
  }

  ${
    hasTraining
      ? `<h2>Training summary</h2><table class="half"><tbody>${sumRows}</tbody></table>
         ${mvHTML ? `<h2>Volume by muscle group</h2><table><thead><tr><th>Muscle</th><th class="num">Sets</th><th class="num">Volume (${unit})</th></tr></thead><tbody>${mvHTML}</tbody></table>` : ""}
         ${prHTML ? `<h2>Personal records</h2><table><thead><tr><th>Exercise</th><th class="num">Best 1RM</th><th class="num">Heaviest</th><th class="num">Since</th></tr></thead><tbody>${prHTML}</tbody></table>` : ""}`
      : ""
  }
  <div style="text-align:center;color:${MUTED};font-size:10px;margin-top:24px">Generated by Mercury</div>
</div>
<script>window.onload=function(){setTimeout(function(){try{window.print()}catch(e){}},400)}</script>
</body></html>`;

  const win = window.open("", "_blank");
  if (!win) {
    // Popup blocked → download the report as an HTML file instead.
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mercury-report-${new Date().toISOString().slice(0, 10)}.html`;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}
