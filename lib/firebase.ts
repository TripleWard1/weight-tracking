// lib/firebase.ts
"use client";

import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously,
  onAuthStateChanged,
  signOut as fbSignOut,
  Auth,
  User,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  Firestore,
} from "firebase/firestore";
import type { Entry, Settings } from "./stats";
import type { Workout } from "./workouts";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseConfigured: boolean = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId
);

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

function ensure(): boolean {
  if (!isFirebaseConfigured) return false;
  if (!app) {
    app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    authInstance = getAuth(app);
    dbInstance = getFirestore(app);
  }
  return true;
}

export function getDb(): Firestore {
  ensure();
  return dbInstance as Firestore;
}

// ---- Auth ----
export function watchAuth(callback: (user: User | null) => void): () => void {
  if (!ensure() || !authInstance) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(authInstance, callback);
}

export async function signInWithGoogle() {
  ensure();
  const provider = new GoogleAuthProvider();
  return signInWithPopup(authInstance as Auth, provider);
}

export async function signInGuest() {
  ensure();
  return signInAnonymously(authInstance as Auth);
}

export async function signOut() {
  ensure();
  return fbSignOut(authInstance as Auth);
}

// ---- Firestore data model ----
// users/{uid}                    -> { settings }
// users/{uid}/entries/{entryId}  -> { kg, ts, note, bodyFat, createdAt }

function entriesCol(uid: string) {
  return collection(getDb(), "users", uid, "entries");
}

export function watchEntries(
  uid: string,
  callback: (entries: Entry[]) => void
): () => void {
  if (!ensure() || !uid) {
    callback([]);
    return () => {};
  }
  const q = query(entriesCol(uid), orderBy("ts", "asc"));
  return onSnapshot(q, (snap) => {
    const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Entry, "id">) }));
    callback(rows);
  });
}

export async function addEntry(uid: string, entry: Omit<Entry, "id" | "createdAt">) {
  ensure();
  return addDoc(entriesCol(uid), { ...entry, createdAt: serverTimestamp() });
}

export async function updateEntry(uid: string, id: string, patch: Partial<Entry>) {
  ensure();
  return updateDoc(doc(getDb(), "users", uid, "entries", id), patch);
}

export async function removeEntry(uid: string, id: string) {
  ensure();
  return deleteDoc(doc(getDb(), "users", uid, "entries", id));
}

export function watchSettings(
  uid: string,
  callback: (settings: Settings | null) => void
): () => void {
  if (!ensure() || !uid) {
    callback(null);
    return () => {};
  }
  return onSnapshot(doc(getDb(), "users", uid), (snap) => {
    const data = snap.exists() ? (snap.data() as { settings?: Settings }) : null;
    callback(data?.settings ?? null);
  });
}

export async function saveSettings(uid: string, settings: Settings) {
  ensure();
  return setDoc(doc(getDb(), "users", uid), { settings }, { merge: true });
}

// ---- Workouts ----
// users/{uid}/workouts/{workoutId} -> { ts, title, note, durationMin, exercises[] }

function workoutsCol(uid: string) {
  return collection(getDb(), "users", uid, "workouts");
}

export function watchWorkouts(
  uid: string,
  callback: (workouts: Workout[]) => void
): () => void {
  if (!ensure() || !uid) {
    callback([]);
    return () => {};
  }
  const q = query(workoutsCol(uid), orderBy("ts", "asc"));
  return onSnapshot(q, (snap) => {
    const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Workout, "id">) }));
    callback(rows);
  });
}

export async function addWorkout(uid: string, workout: Omit<Workout, "id" | "createdAt">) {
  ensure();
  return addDoc(workoutsCol(uid), { ...workout, createdAt: serverTimestamp() });
}

export async function updateWorkout(uid: string, id: string, patch: Partial<Workout>) {
  ensure();
  return updateDoc(doc(getDb(), "users", uid, "workouts", id), patch);
}

export async function removeWorkout(uid: string, id: string) {
  ensure();
  return deleteDoc(doc(getDb(), "users", uid, "workouts", id));
}
