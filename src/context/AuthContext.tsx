"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createUserWithEmailAndPassword, GoogleAuthProvider, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signOut, updateProfile, type User } from "firebase/auth";
import { firebaseAuth, firebaseConfigured } from "@/lib/firebase/client";
import type { AuthUser } from "@/lib/types";

type AuthContextValue = { user: AuthUser | null; loading: boolean; signInWithGoogle: () => Promise<AuthUser>; signInWithEmail: (email: string, password: string) => Promise<AuthUser>; signUpWithEmail: (name: string, email: string, password: string) => Promise<AuthUser>; signOutUser: () => Promise<void>; };
const AuthContext = createContext<AuthContextValue | null>(null);
const asUser = (user: User): AuthUser => ({ uid: user.uid, email: user.email ?? "", displayName: user.displayName ?? "MedLens patient", role: "PATIENT" });
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const auth = firebaseAuth();
    if (!auth) { setLoading(false); return; }
    return onAuthStateChanged(auth, current => { setUser(current ? asUser(current) : null); setLoading(false); });
  }, []);
  const value = useMemo<AuthContextValue>(() => ({
    user, loading,
    async signInWithGoogle() { const auth = firebaseAuth(); if (!auth || !firebaseConfigured) throw new Error("Firebase is not configured."); return asUser((await signInWithPopup(auth, new GoogleAuthProvider())).user); },
    async signInWithEmail(email, password) { const auth = firebaseAuth(); if (!auth || !firebaseConfigured) throw new Error("Firebase is not configured."); return asUser((await signInWithEmailAndPassword(auth, email, password)).user); },
    async signUpWithEmail(name, email, password) { const auth = firebaseAuth(); if (!auth || !firebaseConfigured) throw new Error("Firebase is not configured."); const result = await createUserWithEmailAndPassword(auth, email, password); if (name.trim()) await updateProfile(result.user, { displayName: name.trim() }); return asUser(result.user); },
    async signOutUser() { const auth = firebaseAuth(); if (auth) await signOut(auth); },
  }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() { const context = useContext(AuthContext); if (!context) throw new Error("useAuth must be used inside AuthProvider"); return context; }
