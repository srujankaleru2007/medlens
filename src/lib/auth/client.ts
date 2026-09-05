"use client";
import { signOut as firebaseSignOut } from "firebase/auth";
import type { AuthUser } from "../types";
import { firebaseAuth, firebaseConfigured } from "../firebase/client";

const key = "medlens:auth:v1";
const demoUser: AuthUser = { uid: "demo-patient", email: "patient@demo.medlens", displayName: "Demo Patient", role: "PATIENT" };
// Cached identity is display-only. Server routes trust only verified Firebase ID tokens.
export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(window.localStorage.getItem(key) || "null") as AuthUser | null; } catch { return null; }
}
export const signInDemo = (): AuthUser => {
  if (firebaseConfigured) throw new Error("Demo sign-in is disabled when Firebase is configured.");
  window.localStorage.setItem(key, JSON.stringify(demoUser)); return demoUser;
};
export async function signOut(): Promise<void> {
  const auth = firebaseAuth();
  if (auth) await firebaseSignOut(auth);
  window.localStorage.removeItem(key);
}
export const isFirebaseConfigured = () => firebaseConfigured;
export const storeFirebaseUser = (user: { uid: string; email: string | null; displayName: string | null }): AuthUser => {
  const current: AuthUser = { uid: user.uid, email: user.email ?? "", displayName: user.displayName ?? "MedLens patient", role: "PATIENT" };
  window.localStorage.setItem(key, JSON.stringify(current)); return current;
};
export async function currentUser(): Promise<AuthUser | null> {
  const auth = firebaseAuth();
  if (!auth) { const user = getStoredUser(); return user?.uid === demoUser.uid ? user : null; }
  await auth.authStateReady();
  return auth.currentUser ? storeFirebaseUser(auth.currentUser) : null;
}
export async function authHeaders(): Promise<Record<string, string>> {
  const auth = firebaseAuth();
  if (!auth) throw new Error("Connect Firebase or the local emulators to store reports.");
  await auth.authStateReady();
  if (!auth.currentUser) throw new Error("Sign in to continue.");
  return { Authorization: `Bearer ${await auth.currentUser.getIdToken()}` };
}
