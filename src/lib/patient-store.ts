"use client";
import type { PatientInput } from "./validation/patient";
import type { PatientProfile } from "./types";
import { patientRecord } from "./provenance";
import { isFirebaseConfigured } from "./auth/client";
import { api } from "./api-client";

const demoKey = "medlens:patient:v1";
export async function getPatient(uid: string): Promise<PatientProfile | null> {
  if (isFirebaseConfigured()) {
    const result = await api<{ patients: PatientProfile[] }>("/api/patients");
    return result.patients[0] ?? null;
  }
  const raw = window.localStorage.getItem(demoKey);
  if (!raw) return null;
  const value = JSON.parse(raw) as PatientProfile;
  return value.ownerId === uid ? value : null;
}
export async function savePatient(input: PatientInput, uid: string, existing?: PatientProfile): Promise<PatientProfile> {
  if (isFirebaseConfigured()) {
    const { patient } = await api<{ patient: PatientProfile }>(existing ? `/api/patients/${existing.id}` : "/api/patients", {
      method: existing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
    });
    return patient;
  }
  const patient = patientRecord(input, uid, existing?.id ?? crypto.randomUUID(), existing);
  window.localStorage.setItem(demoKey, JSON.stringify(patient));
  return patient;
}
