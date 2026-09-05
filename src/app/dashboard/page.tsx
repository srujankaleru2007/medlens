"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentUser, isFirebaseConfigured, signOut } from "@/lib/auth/client";
import { getPatient, savePatient } from "@/lib/patient-store";
import type { PatientInput } from "@/lib/validation/patient";
import type { AuthUser, PatientProfile } from "@/lib/types";
import { PatientForm } from "@/features/patients/patient-form";
import { ReportWorkspace } from "@/features/reports/report-workspace";
import { IntelligenceOverview } from "@/features/intelligence/intelligence-overview";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [patient, setPatient] = useState<PatientProfile | null>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const identity = await currentUser();
        if (!active) return;
        if (!identity) { router.replace("/sign-in"); return; }
        setUser(identity);
        const record = await getPatient(identity.uid);
        if (active) { setPatient(record); setReady(true); }
      } catch { if (active) setError("Your workspace could not be loaded. Try again."); }
    }
    void load();
    return () => { active = false; };
  }, [router, attempt]);
  async function save(input: PatientInput) {
    if (!user) return;
    setPatient(await savePatient(input, user.uid, patient ?? undefined));
  }
  async function logout() {
    try { await signOut(); setPatient(null); setUser(null); router.replace("/sign-in"); }
    catch { setError("Sign-out failed. Try again."); }
  }
  return <div className="min-h-screen">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
      <Link href="/" className="flex items-center gap-3 font-bold"><span className="grid h-10 w-10 place-items-center rounded-xl bg-teal text-white">M</span>MedLens</Link>
      <nav aria-label="Workspace" className="flex flex-wrap gap-5 text-sm font-bold"><a href="#patient-intake">Patient profile</a><a href="#reports">Reports</a></nav>
      {user && <button onClick={logout} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold">Sign out</button>}
    </div></header>
    <main id="main-content" className="mx-auto max-w-7xl space-y-8 px-6 py-10">
      <div><p className="text-sm font-bold uppercase tracking-widest text-teal">Patient workspace</p><h1 className="mt-2 text-4xl font-bold">Your record, with its sources</h1><p className="mt-3 max-w-2xl text-slate-600">Keep patient-provided information alongside your original reports. Uploaded documents are stored as sources and are not yet extracted or verified.</p></div>
      {!isFirebaseConfigured() && <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">Demo workspace — use synthetic information only. Intake is stored in this browser. Report uploads require Firebase or the local emulators.</p>}
      {process.env.NEXT_PUBLIC_USE_EMULATORS === 'true' && <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">Local emulator workspace — use synthetic information only. Accounts and reports here are local test data and may be cleared when the emulators stop.</p>}
      {error && <div role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error} <button className="underline" onClick={() => { setError(""); setAttempt(n => n + 1); }}>Retry loading</button></div>}
      {!ready && !error && <p role="status">Loading your workspace…</p>}
      {ready && user && <>
        <IntelligenceOverview patient={patient} />
        <ReportWorkspace patient={patient} enabled={isFirebaseConfigured()} />
        <PatientForm patient={patient} onSave={save} />
      </>}
    </main>
  </div>;
}
