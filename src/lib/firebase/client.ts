"use client";
import { getApp, getApps, initializeApp } from "firebase/app";
import { getAnalytics, isSupported as analyticsSupported, type Analytics } from "firebase/analytics";
import { connectAuthEmulator, getAuth, GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup, createUserWithEmailAndPassword } from "firebase/auth";

const config = { apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY, authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID, measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID };
export const firebaseConfigured = Boolean(config.apiKey && config.authDomain && config.projectId && config.storageBucket && config.appId);
let connected = false;
let analytics: Analytics | null = null;
export function firebaseApp() { return firebaseConfigured ? (getApps().length ? getApp() : initializeApp(config)) : null; }
export async function firebaseAnalytics(): Promise<Analytics | null> {
  if (!firebaseConfigured || typeof window === "undefined" || analytics) return analytics;
  if (await analyticsSupported()) { analytics = getAnalytics(firebaseApp()!); }
  return analytics;
}
export function firebaseAuth() {
  if (!firebaseConfigured) return null;
  const auth = getAuth(firebaseApp()!);
  if (process.env.NEXT_PUBLIC_USE_EMULATORS === "true" && !connected) {
    if (!config.projectId?.startsWith("demo-")) throw new Error("Emulators require a demo project");
    connectAuthEmulator(auth, "http://127.0.0.1:9099");
    connected = true;
  }
  return auth;
}
export const signInWithGoogle = () => { const auth = firebaseAuth(); if (!auth) throw new Error("Firebase is not configured."); return signInWithPopup(auth, new GoogleAuthProvider()); };
export const signInWithEmail = (email: string, password: string) => { const auth = firebaseAuth(); if (!auth) throw new Error("Firebase is not configured."); return signInWithEmailAndPassword(auth, email, password); };
export const createEmailAccount = (email: string, password: string) => { const auth = firebaseAuth(); if (!auth) throw new Error("Firebase is not configured."); return createUserWithEmailAndPassword(auth, email, password); };
