"use client";

import { useEffect, useState } from "react";
import {
  toDisplay,
  toKg,
  round1,
  Settings,
  Unit,
  Sex,
  ActivityLevel,
  ACTIVITY_LABELS,
} from "@/lib/stats";

interface SettingsSheetProps {
  open: boolean;
  settings: Settings | null;
  onClose: () => void;
  onSave: (settings: Settings) => void;
  onExport: () => void;
  onImportFile: (file: File) => void;
}

export default function SettingsSheet({
  open,
  settings,
  onClose,
  onSave,
  onExport,
  onImportFile,
}: SettingsSheetProps) {
  const [name, setName] = useState("");
  const [chosenUnit, setChosenUnit] = useState<Unit>("kg");
  const [heightCm, setHeightCm] = useState("");
  const [goal, setGoal] = useState("");
  const [sex, setSex] = useState<Sex | "">("");
  const [birthYear, setBirthYear] = useState("");
  const [activity, setActivity] = useState<ActivityLevel | "">("");
  const [autoActivity, setAutoActivity] = useState(true);

  useEffect(() => {
    if (!open) return;
    const unit: Unit = settings?.unit || "kg";
    setName(settings?.name || "");
    setChosenUnit(unit);
    setHeightCm(settings?.heightCm != null ? String(settings.heightCm) : "");
    setGoal(
      settings?.goalKg != null ? String(round1(toDisplay(settings.goalKg, unit))) : ""
    );
    setSex(settings?.sex ?? "");
    setBirthYear(settings?.birthYear != null ? String(settings.birthYear) : "");
    setActivity(settings?.activityLevel ?? "");
    setAutoActivity(settings?.autoActivity !== false);
  }, [open, settings]);

  if (!open) return null;

  function save() {
    const g = goal === "" ? null : parseFloat(goal.replace(",", "."));
    const h = heightCm === "" ? null : parseFloat(heightCm.replace(",", "."));
    const by = birthYear === "" ? null : parseInt(birthYear, 10);
    onSave({
      name: name.trim(),
      unit: chosenUnit,
      heightCm: h != null && !Number.isNaN(h) ? h : null,
      goalKg: g != null && !Number.isNaN(g) ? toKg(g, chosenUnit) : null,
      sex: sex === "" ? null : sex,
      birthYear: by != null && !Number.isNaN(by) ? by : null,
      activityLevel: activity === "" ? null : activity,
      autoActivity,
    });
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grip" />
        <div className="sheet-head">
          <h2>Profile &amp; goal</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <label className="field">
          <span>Display name</span>
          <input
            type="text"
            value={name}
            placeholder="Your name"
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <div className="field">
          <span>Units</span>
          <div className="segmented" role="tablist">
            <button
              className={chosenUnit === "kg" ? "seg on" : "seg"}
              onClick={() => setChosenUnit("kg")}
            >
              Kilograms
            </button>
            <button
              className={chosenUnit === "lb" ? "seg on" : "seg"}
              onClick={() => setChosenUnit("lb")}
            >
              Pounds
            </button>
          </div>
        </div>

        <div className="field-row">
          <label className="field">
            <span>Height (cm)</span>
            <input
              type="number"
              inputMode="decimal"
              placeholder="e.g. 178"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              className="mono"
            />
          </label>
          <label className="field">
            <span>Goal weight ({chosenUnit})</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              placeholder="Target"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className="mono"
            />
          </label>
        </div>

        <div className="field">
          <span>For calorie estimates (optional)</span>
          <div className="segmented" role="tablist">
            <button
              className={sex === "male" ? "seg on" : "seg"}
              onClick={() => setSex("male")}
            >
              Male
            </button>
            <button
              className={sex === "female" ? "seg on" : "seg"}
              onClick={() => setSex("female")}
            >
              Female
            </button>
          </div>
        </div>

        <div className="field-row">
          <label className="field">
            <span>Birth year</span>
            <input
              type="number"
              inputMode="numeric"
              placeholder="e.g. 1994"
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value)}
              className="mono"
            />
          </label>
          <label className="field">
            <span>Activity level</span>
            <select
              className="select"
              value={activity}
              onChange={(e) => {
                setActivity(e.target.value as ActivityLevel | "");
                setAutoActivity(false);
              }}
            >
              <option value="">Choose…</option>
              {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map((k) => (
                <option key={k} value={k}>
                  {ACTIVITY_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button
          className={"toggle-row" + (autoActivity ? " on" : "")}
          onClick={() => setAutoActivity((v) => !v)}
          role="switch"
          aria-checked={autoActivity}
        >
          <span className="toggle-track">
            <span className="toggle-knob" />
          </span>
          <span className="toggle-text">
            Set activity level automatically from my logged training
          </span>
        </button>

        <div className="field">
          <span>Your data</span>
          <div className="data-actions">
            <button className="btn ghost" onClick={onExport}>
              Export CSV
            </button>
            <label className="btn ghost file-btn">
              Import CSV
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onImportFile(f);
                  e.target.value = "";
                }}
                hidden
              />
            </label>
          </div>
        </div>

        <div className="sheet-actions">
          <button className="btn primary" onClick={save}>
            Save profile
          </button>
        </div>
      </div>
    </div>
  );
}
