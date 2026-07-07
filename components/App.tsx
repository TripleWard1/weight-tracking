"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import type { User } from "firebase/auth";
import WeightChart, { ChartPoint } from "./WeightChart";
import EntrySheet, { EntryInput } from "./EntrySheet";
import SettingsSheet from "./SettingsSheet";
import PhaseSheet from "./PhaseSheet";
import {
  isFirebaseConfigured,
  watchAuth,
  signInWithGoogle,
  signInGuest,
  signOut,
  watchEntries,
  watchSettings,
  addEntry,
  updateEntry,
  removeEntry,
  saveSettings,
} from "@/lib/firebase";
import {
  toDisplay,
  round1,
  summarize,
  movingAverage,
  trendPerWeek,
  projectGoal,
  bmi,
  streak,
  filterRange,
  dailySeries,
  dayKey,
  activePhase,
  estimateTDEE,
  phaseStatus,
  recommendedIntake,
  phaseTypeLabel,
  Entry,
  Settings,
  Summary,
  Projection,
  Bmi,
  Unit,
  Phase,
  PhaseStatus,
  TDEE,
} from "@/lib/stats";

type Tab = "overview" | "history" | "insights";
type Theme = "dark" | "light";

const RANGES = [
  { key: "7", label: "7D" },
  { key: "30", label: "30D" },
  { key: "90", label: "90D" },
  { key: "365", label: "1Y" },
  { key: "all", label: "All" },
];

function Droplet({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 2.5c3.6 4 6 7 6 10.2A6 6 0 0 1 6 12.7c0-3.2 2.4-6.2 6-10.2Z"
        fill="var(--accent)"
      />
      <circle cx="9.6" cy="13.4" r="1.7" fill="var(--accent-ink)" opacity="0.55" />
    </svg>
  );
}

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);

  const [tab, setTab] = useState<Tab>("overview");
  const [range, setRange] = useState("30");
  const [entryOpen, setEntryOpen] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [phaseOpen, setPhaseOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>("dark");
  const [toast, setToast] = useState("");

  const unit: Unit = settings?.unit || "kg";

  useEffect(() => {
    try {
      const t = (localStorage.getItem("mercury-theme") as Theme) || "dark";
      setTheme(t);
      document.documentElement.setAttribute("data-theme", t);
    } catch {}
  }, []);
  const toggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("mercury-theme", next);
    } catch {}
  };

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  useEffect(() => {
    const unsub = watchAuth((u) => {
      setUser(u);
      setAuthReady(true);
    });
    return () => unsub && unsub();
  }, []);

  useEffect(() => {
    if (!user) {
      setEntries([]);
      setSettings(null);
      return;
    }
    const unsubE = watchEntries(user.uid, setEntries);
    const unsubS = watchSettings(user.uid, setSettings);
    return () => {
      unsubE && unsubE();
      unsubS && unsubS();
    };
  }, [user]);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2400);
  }, []);

  const summary = useMemo(() => summarize(entries), [entries]);
  const maAll = useMemo(() => movingAverage(entries, 7), [entries]);
  const phase = useMemo(() => activePhase(settings?.phases), [settings?.phases]);

  // Anchor weight (kg) for the target line: the 7-day average nearest the phase start.
  const phaseAnchorKg = useMemo(() => {
    if (!phase || !maAll.length) return null;
    let best = maAll.find((m) => m.ts >= phase.startTs);
    if (!best) best = maAll[maAll.length - 1];
    return best.avg;
  }, [phase, maAll]);

  const chartData: ChartPoint[] = useMemo(() => {
    const inRange = filterRange(entries, range);
    if (!inRange.length) return [];
    const byDay = new Map(maAll.map((m) => [dayKey(m.ts), m]));
    const daily = dailySeries(inRange);
    return daily.map((d) => {
      const m = byDay.get(dayKey(d.ts));
      let target: number | null = null;
      if (phase && phaseAnchorKg != null && d.ts >= phase.startTs) {
        const weeks = (d.ts - phase.startTs) / (7 * 86400000);
        const targetKg = phaseAnchorKg + phase.targetRatePerWeek * weeks;
        target = round1(toDisplay(targetKg, unit));
      }
      return {
        t: d.ts,
        actual: round1(toDisplay(d.kg, unit)),
        avg: m ? round1(toDisplay(m.avg, unit)) : null,
        target,
      };
    });
  }, [entries, maAll, range, unit, phase, phaseAnchorKg]);

  const ratePerWeekKg = useMemo(() => trendPerWeek(entries, 30), [entries]);
  const goalKg = settings?.goalKg ?? null;
  const projection = useMemo(
    () => projectGoal(summary.current, goalKg, ratePerWeekKg),
    [summary.current, goalKg, ratePerWeekKg]
  );
  const bmiVal = useMemo(
    () => bmi(summary.current, settings?.heightCm),
    [summary.current, settings?.heightCm]
  );
  const currentStreak = useMemo(() => streak(entries), [entries]);
  const tdee = useMemo(() => estimateTDEE(entries, 14), [entries]);
  const pStatus = useMemo(
    () => (phase ? phaseStatus(entries, phase, 21) : null),
    [entries, phase]
  );

  async function handleSaveEntry(entry: EntryInput) {
    if (!user) return;
    try {
      if (editing && editing.id) {
        await updateEntry(user.uid, editing.id, entry);
        flash("Reading updated");
      } else {
        await addEntry(user.uid, entry);
        flash("Reading saved");
      }
      setEntryOpen(false);
      setEditing(null);
    } catch {
      flash("Could not save — check your connection");
    }
  }
  async function handleDeleteEntry(id: string) {
    if (!user) return;
    try {
      await removeEntry(user.uid, id);
      setEntryOpen(false);
      setEditing(null);
      flash("Reading deleted");
    } catch {
      flash("Could not delete");
    }
  }
  async function handleSaveSettings(next: Settings) {
    if (!user) return;
    try {
      await saveSettings(user.uid, { ...(settings || {}), ...next });
      setSettingsOpen(false);
      flash("Profile saved");
    } catch {
      flash("Could not save profile");
    }
  }

  async function handleSavePhase(next: Phase) {
    if (!user) return;
    try {
      const existing = settings?.phases || [];
      const idx = existing.findIndex((p) => p.id === next.id);
      const phases =
        idx >= 0
          ? existing.map((p) => (p.id === next.id ? next : p))
          : [...existing, next];
      await saveSettings(user.uid, { ...(settings || {}), phases });
      setPhaseOpen(false);
      flash(idx >= 0 ? "Phase updated" : `${phaseTypeLabel(next.type)} phase started`);
    } catch {
      flash("Could not save phase");
    }
  }

  async function handleEndPhase() {
    if (!user || !phase) return;
    try {
      const phases = (settings?.phases || []).filter((p) => p.id !== phase.id);
      await saveSettings(user.uid, { ...(settings || {}), phases });
      setPhaseOpen(false);
      flash("Phase ended");
    } catch {
      flash("Could not end phase");
    }
  }

  function exportCsv() {
    const rows: (string | number)[][] = [
      ["date_iso", "weight_kg", "body_fat_pct", "calories", "note"],
    ];
    [...entries]
      .sort((a, b) => a.ts - b.ts)
      .forEach((e) => {
        rows.push([
          new Date(e.ts).toISOString(),
          e.kg,
          e.bodyFat ?? "",
          e.calories ?? "",
          (e.note || "").replace(/"/g, '""'),
        ]);
      });
    const csv = rows.map((r) => r.map((c) => `"${String(c)}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mercury-weights-${dayKey(Date.now())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    flash("Exported CSV");
  }

  function parseCsv(text: string): Omit<Entry, "id" | "createdAt">[] {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
    if (!lines.length) return [];
    const out: Omit<Entry, "id" | "createdAt">[] = [];
    const parseLine = (line: string): string[] => {
      const fields: string[] = [];
      let cur = "";
      let q = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (q) {
          if (c === '"' && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else if (c === '"') q = false;
          else cur += c;
        } else {
          if (c === '"') q = true;
          else if (c === ",") {
            fields.push(cur);
            cur = "";
          } else cur += c;
        }
      }
      fields.push(cur);
      return fields;
    };
    const header = parseLine(lines[0]).map((h) => h.trim().toLowerCase());
    const idxDate = header.findIndex((h) => /date|time/.test(h));
    const idxKg = header.findIndex((h) => /kg|weight/.test(h));
    const idxBf = header.findIndex((h) => /fat/.test(h));
    const idxCal = header.findIndex((h) => /cal|kcal|energy/.test(h));
    const idxNote = header.findIndex((h) => /note/.test(h));
    for (let i = 1; i < lines.length; i++) {
      const f = parseLine(lines[i]);
      const ts = new Date(f[idxDate]).getTime();
      const kg = parseFloat(f[idxKg]);
      if (Number.isNaN(ts) || Number.isNaN(kg)) continue;
      out.push({
        ts,
        kg,
        bodyFat: idxBf >= 0 && f[idxBf] ? parseFloat(f[idxBf]) : null,
        calories: idxCal >= 0 && f[idxCal] ? parseFloat(f[idxCal]) : null,
        note: idxNote >= 0 ? f[idxNote] || "" : "",
      });
    }
    return out;
  }

  async function importCsv(file: File) {
    if (!user) return;
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (!rows.length) {
        flash("No valid rows found");
        return;
      }
      for (const r of rows) {
        await addEntry(user.uid, r);
      }
      flash(`Imported ${rows.length} readings`);
      setSettingsOpen(false);
    } catch {
      flash("Import failed");
    }
  }

  if (!isFirebaseConfigured) return <SetupScreen />;
  if (!authReady) return <Splash label="Waking the instrument…" />;
  if (!user)
    return (
      <SignIn
        onGoogle={() => signInWithGoogle().catch(() => flash("Sign-in cancelled"))}
        onGuest={() => signInGuest().catch(() => flash("Could not start guest session"))}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    );

  const displayName =
    settings?.name || (user.isAnonymous ? "Guest" : user.displayName) || "You";
  const curDisplay = round1(toDisplay(summary.current, unit));
  const goalDisplay = goalKg != null ? round1(toDisplay(goalKg, unit)) : null;
  const last7 = round1(toDisplay(summary.last7Change, unit));
  const ratePerWeek = round1(toDisplay(ratePerWeekKg, unit));

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <Droplet />
          <span>Mercury</span>
        </div>
        <nav className="tabs" aria-label="Sections">
          {(
            [
              ["overview", "Overview"],
              ["history", "History"],
              ["insights", "Insights"],
            ] as [Tab, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              className={tab === k ? "tab on" : "tab"}
              onClick={() => setTab(k)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="topbar-right">
          <button className="icon-btn" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === "dark" ? "☀" : "☾"}
          </button>
          <button
            className="icon-btn"
            onClick={() => setSettingsOpen(true)}
            aria-label="Profile and settings"
          >
            ⚙
          </button>
        </div>
      </header>

      <main className="content">
        {tab === "overview" && (
          <Overview
            displayName={displayName}
            unit={unit}
            curDisplay={curDisplay}
            last7={last7}
            ratePerWeek={ratePerWeek}
            summary={summary}
            goalDisplay={goalDisplay}
            projection={projection}
            chartData={chartData}
            range={range}
            setRange={setRange}
            streakDays={currentStreak}
            onSetGoal={() => setSettingsOpen(true)}
            phase={phase}
            pStatus={pStatus}
            tdee={tdee}
            onManagePhase={() => setPhaseOpen(true)}
          />
        )}
        {tab === "history" && (
          <History
            entries={entries}
            unit={unit}
            onEdit={(e) => {
              setEditing(e);
              setEntryOpen(true);
            }}
          />
        )}
        {tab === "insights" && (
          <Insights
            summary={summary}
            unit={unit}
            ratePerWeek={ratePerWeek}
            bmiVal={bmiVal}
            projection={projection}
            goalDisplay={goalDisplay}
            streakDays={currentStreak}
            heightSet={settings?.heightCm != null}
            onAddHeight={() => setSettingsOpen(true)}
            tdee={tdee}
            phase={phase}
          />
        )}
      </main>

      <button
        className="fab"
        onClick={() => {
          setEditing(null);
          setEntryOpen(true);
        }}
        aria-label="Log weight"
      >
        <span className="fab-plus">＋</span>
        <span className="fab-label">Log weight</span>
      </button>

      <EntrySheet
        open={entryOpen}
        unit={unit}
        editing={editing}
        onClose={() => {
          setEntryOpen(false);
          setEditing(null);
        }}
        onSave={handleSaveEntry}
        onDelete={handleDeleteEntry}
      />
      <SettingsSheet
        open={settingsOpen}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onSave={handleSaveSettings}
        onExport={exportCsv}
        onImportFile={importCsv}
      />
      <PhaseSheet
        open={phaseOpen}
        unit={unit}
        active={phase}
        onClose={() => setPhaseOpen(false)}
        onSave={handleSavePhase}
        onEnd={handleEndPhase}
      />

      <footer className="footer">
        <span>
          Signed in as {displayName}
          {user.isAnonymous ? " (guest — data lives on this account only)" : ""}
        </span>
        <button className="linkish" onClick={() => signOut()}>
          Sign out
        </button>
      </footer>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

/* ---------------- Overview ---------------- */
interface OverviewProps {
  displayName: string;
  unit: Unit;
  curDisplay: number | null;
  last7: number | null;
  ratePerWeek: number | null;
  summary: Summary;
  goalDisplay: number | null;
  projection: Projection | null;
  chartData: ChartPoint[];
  range: string;
  setRange: (r: string) => void;
  streakDays: number;
  onSetGoal: () => void;
  phase: Phase | null;
  pStatus: PhaseStatus | null;
  tdee: TDEE;
  onManagePhase: () => void;
}

function Overview({
  displayName,
  unit,
  curDisplay,
  last7,
  ratePerWeek,
  summary,
  goalDisplay,
  projection,
  chartData,
  range,
  setRange,
  streakDays,
  onSetGoal,
  phase,
  pStatus,
  tdee,
  onManagePhase,
}: OverviewProps) {
  const hasData = summary.count > 0;
  const goalPct = useMemo(() => {
    if (goalDisplay == null || summary.start == null || curDisplay == null) return null;
    const startD = toDisplay(summary.start, unit);
    if (startD == null) return null;
    const total = startD - goalDisplay;
    if (Math.abs(total) < 0.05) return 100;
    const done = startD - curDisplay;
    return Math.max(0, Math.min(100, (done / total) * 100));
  }, [goalDisplay, summary, curDisplay, unit]);

  return (
    <div className="stack">
      <section className="hero card">
        <div className="hero-top">
          <span className="eyebrow">Current weight · {displayName}</span>
          {streakDays > 0 && (
            <span className="streak-chip">🔥 {streakDays}-day streak</span>
          )}
        </div>
        {hasData ? (
          <div className="hero-read">
            <span className="hero-num mono">{curDisplay?.toFixed(1)}</span>
            <span className="hero-unit">{unit}</span>
            {last7 != null && summary.count > 1 && (
              <span className={"delta " + (last7 <= 0 ? "down" : "up")}>
                {last7 <= 0 ? "▼" : "▲"} {Math.abs(last7).toFixed(1)} {unit}
                <em> · 7 days</em>
              </span>
            )}
          </div>
        ) : (
          <div className="hero-empty">
            <p>No readings yet. Tap “Log weight” to record your first.</p>
          </div>
        )}
        {hasData && (
          <div className="hero-stats">
            <MiniStat
              label="Trend"
              value={
                ratePerWeek != null
                  ? `${ratePerWeek > 0 ? "+" : ""}${ratePerWeek.toFixed(2)} ${unit}/wk`
                  : "—"
              }
              tone={ratePerWeek != null && ratePerWeek <= 0 ? "good" : "warn"}
            />
            <MiniStat
              label="Since start"
              value={
                summary.totalChange != null
                  ? `${summary.totalChange <= 0 ? "" : "+"}${(
                      round1(toDisplay(summary.totalChange, unit)) ?? 0
                    ).toFixed(1)} ${unit}`
                  : "—"
              }
              tone={
                summary.totalChange != null && summary.totalChange <= 0 ? "good" : "warn"
              }
            />
            <MiniStat label="Readings" value={String(summary.count)} />
          </div>
        )}
      </section>

      {hasData && (
        <PhaseCard
          phase={phase}
          pStatus={pStatus}
          tdee={tdee}
          unit={unit}
          onManagePhase={onManagePhase}
        />
      )}

      {goalDisplay != null && hasData ? (
        <section className="card goal">
          <div className="goal-head">
            <span className="eyebrow">
              Goal · {goalDisplay.toFixed(1)} {unit}
            </span>
            {projection?.reachable && projection.weeks != null && projection.weeks > 0 && projection.date && (
              <span className="goal-eta">
                ~
                {projection.date.toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            )}
          </div>
          <div className="progress">
            <div className="progress-fill" style={{ width: `${goalPct ?? 0}%` }} />
          </div>
          <p className="goal-note">
            {projection == null
              ? "Add more readings to project a date."
              : projection.reachable
              ? projection.weeks != null && projection.weeks <= 0
                ? "You’ve reached your goal. Nicely done."
                : `At your current pace you’ll reach it in about ${Math.round(
                    projection.weeks ?? 0
                  )} week${Math.round(projection.weeks ?? 0) === 1 ? "" : "s"}.`
              : "Your recent trend is moving away from this goal — worth a look."}
          </p>
        </section>
      ) : hasData ? (
        <button className="card set-goal" onClick={onSetGoal}>
          <span>＋ Set a goal weight to track progress</span>
        </button>
      ) : null}

      <section className="card chart-card">
        <div className="chart-head">
          <span className="eyebrow">Trend</span>
          <div className="segmented small" role="tablist">
            {RANGES.map((r) => (
              <button
                key={r.key}
                className={range === r.key ? "seg on" : "seg"}
                onClick={() => setRange(r.key)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <WeightChart data={chartData} unit={unit} goal={goalDisplay} height={260} />
        <div className="legend">
          <span>
            <i className="dot accent" /> Daily reading
          </span>
          <span>
            <i className="dot accent2" /> 7-day average
          </span>
          {goalDisplay != null && (
            <span>
              <i className="dash warn" /> Goal
            </span>
          )}
          {phase != null && (
            <span>
              <i className="dash muted" /> Target pace
            </span>
          )}
        </div>
      </section>
    </div>
  );
}

/* ---------------- Phase / Coach card ---------------- */
const HEALTH_META: Record<string, { label: string; cls: string }> = {
  "on-track": { label: "On track", cls: "good" },
  faster: { label: "Ahead of pace", cls: "warn" },
  slower: { label: "Behind pace", cls: "muted" },
  "wrong-way": { label: "Off track", cls: "warn" },
  "no-data": { label: "Gathering data", cls: "muted" },
};

function PhaseCard({
  phase,
  pStatus,
  tdee,
  unit,
  onManagePhase,
}: {
  phase: Phase | null;
  pStatus: PhaseStatus | null;
  tdee: TDEE;
  unit: Unit;
  onManagePhase: () => void;
}) {
  if (!phase) {
    return (
      <button className="card set-goal" onClick={onManagePhase}>
        <span>＋ Start a cut, bulk, or maintain phase</span>
      </button>
    );
  }

  const targetDisplay = round1(toDisplay(phase.targetRatePerWeek, unit)) ?? 0;
  const targetText =
    phase.type === "maintain"
      ? "Hold"
      : `${targetDisplay > 0 ? "+" : ""}${targetDisplay.toFixed(2)} ${unit}/wk`;
  const meta = pStatus ? HEALTH_META[pStatus.health] : HEALTH_META["no-data"];
  const recIntake =
    tdee.enoughData && tdee.tdee != null
      ? recommendedIntake(tdee.tdee, phase.targetRatePerWeek)
      : null;

  return (
    <section className="card phase-card">
      <div className="phase-card-head">
        <span className="eyebrow">Phase · {phaseTypeLabel(phase.type)}</span>
        <button className="linkish" onClick={onManagePhase}>
          Manage
        </button>
      </div>
      <div className="phase-target-row">
        <div className="phase-target">
          <span className="phase-big mono">{targetText}</span>
          <span className="phase-sub">target pace</span>
        </div>
        <span className={"phase-badge " + meta.cls}>{meta.label}</span>
      </div>
      {pStatus && <p className="phase-msg">{pStatus.message}</p>}
      {recIntake != null && tdee.tdee != null ? (
        <div className="phase-fuel">
          <div className="fuel-cell">
            <span className="fuel-num mono">{Math.round(tdee.tdee)}</span>
            <span className="fuel-label">maintenance kcal</span>
          </div>
          <div className="fuel-arrow">→</div>
          <div className="fuel-cell">
            <span className="fuel-num mono accent">{Math.round(recIntake)}</span>
            <span className="fuel-label">to hit target</span>
          </div>
        </div>
      ) : (
        <p className="phase-fuel-hint">
          Log calories with your weigh-ins for ~5 days to unlock maintenance &amp;
          target intake estimates.
        </p>
      )}
    </section>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "warn";
}) {
  return (
    <div className="ministat">
      <span className="ministat-label">{label}</span>
      <span className={"ministat-value mono " + (tone || "")}>{value}</span>
    </div>
  );
}

/* ---------------- History ---------------- */
interface HistoryProps {
  entries: Entry[];
  unit: Unit;
  onEdit: (e: Entry) => void;
}

function History({ entries, unit, onEdit }: HistoryProps) {
  const list = useMemo(() => {
    const sorted = [...entries].sort((a, b) => b.ts - a.ts);
    return sorted.map((e, i) => {
      const prev = sorted[i + 1];
      const delta = prev != null ? round1(toDisplay(e.kg - prev.kg, unit)) : null;
      return { ...e, delta };
    });
  }, [entries, unit]);

  if (!list.length) {
    return (
      <div className="empty card">
        <p>Nothing logged yet.</p>
        <span>Your history will appear here, newest first.</span>
      </div>
    );
  }

  return (
    <div className="card list">
      {list.map((e) => (
        <button key={e.id} className="row" onClick={() => onEdit(e)}>
          <div className="row-main">
            <span className="row-weight mono">
              {(round1(toDisplay(e.kg, unit)) ?? 0).toFixed(1)} {unit}
            </span>
            <span className="row-date">
              {new Date(e.ts).toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
              {" · "}
              {new Date(e.ts).toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            {e.note ? <span className="row-note">{e.note}</span> : null}
          </div>
          <div className="row-side">
            {e.delta != null && (
              <span className={"row-delta mono " + (e.delta <= 0 ? "down" : "up")}>
                {e.delta <= 0 ? "▼" : "▲"} {Math.abs(e.delta).toFixed(1)}
              </span>
            )}
            {e.bodyFat != null && <span className="row-bf mono">{e.bodyFat}% bf</span>}
          </div>
        </button>
      ))}
    </div>
  );
}

/* ---------------- Insights ---------------- */
interface InsightsProps {
  summary: Summary;
  unit: Unit;
  ratePerWeek: number | null;
  bmiVal: Bmi | null;
  projection: Projection | null;
  goalDisplay: number | null;
  streakDays: number;
  heightSet: boolean;
  onAddHeight: () => void;
  tdee: TDEE;
  phase: Phase | null;
}

function Insights({
  summary,
  unit,
  ratePerWeek,
  bmiVal,
  projection,
  goalDisplay,
  streakDays,
  heightSet,
  onAddHeight,
  tdee,
  phase,
}: InsightsProps) {
  if (summary.count < 2 || ratePerWeek == null) {
    return (
      <div className="empty card">
        <p>Not enough data yet.</p>
        <span>Log a few readings and insights will unlock here.</span>
      </div>
    );
  }
  const total = round1(toDisplay(summary.totalChange, unit)) ?? 0;
  const min = round1(toDisplay(summary.min, unit)) ?? 0;
  const max = round1(toDisplay(summary.max, unit)) ?? 0;

  const tiles: {
    label: string;
    value: string;
    unit: string;
    tone?: "good" | "warn";
    action?: () => void;
  }[] = [
    {
      label: "Weekly trend",
      value: `${ratePerWeek > 0 ? "+" : ""}${ratePerWeek.toFixed(2)}`,
      unit: `${unit}/wk`,
      tone: ratePerWeek <= 0 ? "good" : "warn",
    },
    {
      label: "Total change",
      value: `${total <= 0 ? "" : "+"}${total.toFixed(1)}`,
      unit,
      tone: total <= 0 ? "good" : "warn",
    },
    { label: "Lowest", value: min.toFixed(1), unit },
    { label: "Highest", value: max.toFixed(1), unit },
    {
      label: "BMI",
      value: bmiVal ? bmiVal.value.toFixed(1) : "—",
      unit: bmiVal ? bmiVal.label : "add height",
      action: bmiVal ? undefined : onAddHeight,
    },
    { label: "Logging streak", value: String(streakDays), unit: "days" },
  ];

  return (
    <div className="stack">
      <section className="tiles">
        {tiles.map((t) => (
          <div
            key={t.label}
            className={"tile card" + (t.action ? " tappable" : "")}
            onClick={t.action}
          >
            <span className="tile-label">{t.label}</span>
            <span className={"tile-value mono " + (t.tone || "")}>{t.value}</span>
            <span className="tile-unit">{t.unit}</span>
          </div>
        ))}
      </section>

      <section className="card energy-card">
        <span className="eyebrow">Energy · maintenance estimate</span>
        {tdee.enoughData && tdee.tdee != null ? (
          <>
            <div className="energy-main">
              <span className="energy-num mono">{Math.round(tdee.tdee)}</span>
              <span className="energy-unit">kcal / day</span>
            </div>
            <p className="energy-note">
              Estimated from your last {tdee.daysOfIntake} days of logged intake
              (avg {Math.round(tdee.avgIntake ?? 0)} kcal) against your weight trend.
              {phase && phase.type !== "maintain" && (
                <>
                  {" "}
                  For your {phaseTypeLabel(phase.type).toLowerCase()}, aim for{" "}
                  <strong className="accent">
                    {Math.round(recommendedIntake(tdee.tdee, phase.targetRatePerWeek))}{" "}
                    kcal/day
                  </strong>
                  .
                </>
              )}
            </p>
          </>
        ) : (
          <p className="energy-note">
            Add a calorie number to your weigh-ins for about 5 days and Mercury will
            estimate your maintenance calories — the intake that holds your weight —
            straight from your own data. It updates as you go.
          </p>
        )}
      </section>

      <section className="card insight-text">
        <span className="eyebrow">Reading of the trend</span>
        <p>
          Over the last month you’re averaging{" "}
          <strong className={ratePerWeek <= 0 ? "good" : "warn"}>
            {ratePerWeek > 0 ? "+" : ""}
            {ratePerWeek.toFixed(2)} {unit} per week
          </strong>
          . Day-to-day weight swings with water and food, so the 7-day average is the
          honest signal — watch that line, not single mornings.
          {goalDisplay != null &&
            projection?.reachable &&
            projection.weeks != null &&
            projection.weeks > 0 &&
            projection.date && (
              <>
                {" "}
                Hold this pace and you’ll meet your {goalDisplay.toFixed(1)} {unit} goal
                around{" "}
                {projection.date.toLocaleDateString(undefined, {
                  month: "long",
                  day: "numeric",
                })}
                .
              </>
            )}
          {goalDisplay != null && projection && !projection.reachable && (
            <> Your recent direction is away from your goal right now.</>
          )}
        </p>
        {!heightSet && (
          <button className="btn ghost" onClick={onAddHeight}>
            Add your height for BMI
          </button>
        )}
      </section>
    </div>
  );
}

/* ---------------- Gates ---------------- */
function Splash({ label }: { label: string }) {
  return (
    <div className="splash">
      <Droplet size={34} />
      <p>{label}</p>
    </div>
  );
}

interface SignInProps {
  onGoogle: () => void;
  onGuest: () => void;
  theme: Theme;
  onToggleTheme: () => void;
}

function SignIn({ onGoogle, onGuest, theme, onToggleTheme }: SignInProps) {
  return (
    <div className="signin">
      <button
        className="icon-btn signin-theme"
        onClick={onToggleTheme}
        aria-label="Toggle theme"
      >
        {theme === "dark" ? "☀" : "☾"}
      </button>
      <div className="signin-card">
        <div className="signin-brand">
          <Droplet size={30} />
          <span>Mercury</span>
        </div>
        <h1>A precise instrument for your weight.</h1>
        <p>
          Log a number, see the honest trend. Your readings sync across every device,
          private to your account.
        </p>
        <button className="btn primary block" onClick={onGoogle}>
          Continue with Google
        </button>
        <button className="btn ghost block" onClick={onGuest}>
          Try as guest
        </button>
        <span className="signin-fine">
          Guest data stays on this anonymous account. Sign in with Google to keep it
          long-term.
        </span>
      </div>
    </div>
  );
}

function SetupScreen() {
  return (
    <div className="signin">
      <div className="signin-card setup">
        <div className="signin-brand">
          <Droplet size={30} />
          <span>Mercury</span>
        </div>
        <h1>Almost there — connect Firebase.</h1>
        <p>
          Add your Firebase web keys to <code>.env.local</code>, then restart:
        </p>
        <pre className="code">
          {`NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...`}
        </pre>
        <p className="signin-fine">
          Enable Google + Anonymous sign-in and create a Firestore database in the
          Firebase console. Full steps are in the README.
        </p>
      </div>
    </div>
  );
}
