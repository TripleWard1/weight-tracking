# Mercury — Weight Ledger

A mobile-first weight tracker that renders equally well on phone and desktop. Log a
number, see the honest trend. Built with **Next.js 14 (App Router)**, **Firebase**
(Auth + Firestore), and **Recharts**. Installable as a **PWA**.

## Features

- **Live sync** — Firestore keeps every device up to date in real time.
- **Trend-first charts** — noisy daily readings plus a 7-day moving average (the line that actually tells the truth), with a goal reference line.
- **Training phases** — run a cut, bulk, or maintain phase with a target weekly pace. Mercury compares your real trend to the target and tells you if you're on track, ahead, or behind, and draws your target pace on the chart.
- **Energy / TDEE** — log calories with your weigh-ins and Mercury estimates your maintenance calories from your own weight trend, then recommends the intake to hit your phase's target pace.
- **Goal projection** — least-squares trend estimates when you'll hit your target.
- **Insights** — weekly rate, total change, min/max, BMI, logging streak.
- **kg / lb** everywhere, converted at the edge (data always stored in kg).
- **Google + guest sign-in**, per-user private data.
- **CSV export / import** (now includes calories), dark & light themes, offline shell.

## How phases & energy work

Weight is noisy day to day, so both features lean on the trend rather than single readings:

- A **phase** stores a type and a target weekly rate (e.g. −0.4 kg/week for a cut). Status compares the least-squares trend since the phase started against that target, with a tolerance band, and flags the wrong direction (e.g. gaining during a cut).
- **TDEE** uses the standard ~7700 kcal/kg relationship: maintenance = average logged intake − the daily energy imbalance implied by your weight trend. It needs about 5 days of calorie entries before it shows, and sharpens with more. Recommended intake = TDEE + (target rate ÷ 7) × 7700.

These are estimates, not medical advice — they're meant to give you a data-driven starting point that you adjust as real results come in.

## Quick start (StackBlitz)

1. Open [stackblitz.com](https://stackblitz.com) → **Create** → import this folder (or drag it in).
2. StackBlitz installs dependencies automatically and runs `npm run dev`.
3. Add your Firebase keys as environment variables (see below). In StackBlitz you can
   create a `.env.local` file directly in the file tree.

Locally instead:

```bash
npm install
cp .env.local.example .env.local   # then fill in your keys
npm run dev
```

Until keys are present the app shows a friendly setup screen instead of crashing.

## Firebase setup (once)

1. [console.firebase.google.com](https://console.firebase.google.com) → **Add project**.
2. **Build → Authentication → Get started** → enable **Google** and **Anonymous**.
3. **Build → Firestore Database → Create database** (start in production mode).
4. **Project settings → General → Your apps → Web app** → copy the config values into
   `.env.local`:

```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

5. Paste these **Firestore security rules** (Firestore → Rules) so each person only
   ever touches their own data:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
      match /entries/{entryId} {
        allow read, write: if request.auth != null && request.auth.uid == uid;
      }
    }
  }
}
```

6. When you deploy, add your Vercel domain under **Authentication → Settings →
   Authorized domains** so Google sign-in works in production.

## Deploy to Vercel

1. Push the project to a Git repo (or import directly).
2. [vercel.com](https://vercel.com) → **Add New → Project** → import the repo.
3. Add the six `NEXT_PUBLIC_FIREBASE_*` variables under **Settings → Environment
   Variables**.
4. Deploy. Vercel auto-detects Next.js — no extra config needed.

## Data model

```
users/{uid}                      { settings: { name, unit, heightCm, goalKg } }
users/{uid}/entries/{entryId}    { kg, ts, bodyFat, note, createdAt }
```

Weights are stored in **kilograms**; the UI converts to your chosen unit for display
and back to kg on save.

## CSV format

Export produces `date_iso, weight_kg, body_fat_pct, note`. Import is flexible — it
matches columns by name (anything containing *date/time*, *weight/kg*, *fat*, *note*),
so exports from other trackers usually import cleanly.

## Notes

- The moving average and trend are computed from the full history, so the smoothing
  stays accurate even at the left edge of a zoomed-in range.
- If two readings share a calendar day, the later one wins for the daily series.
- Guest (anonymous) accounts keep data tied to that browser's anonymous session;
  sign in with Google to keep it long-term and sync across devices.
