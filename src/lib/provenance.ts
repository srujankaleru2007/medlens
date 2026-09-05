import type { PatientInput } from './validation/patient';
import type { FieldProvenance, PatientProfile } from './types';

export function patientRecord(input: PatientInput, uid: string, id: string, existing?: PatientProfile): PatientProfile {
  const now = new Date().toISOString();
  const fieldProvenance: Record<string, FieldProvenance> = {};
  for (const field of Object.keys(input) as Array<keyof PatientInput>) {
    const previous = existing?.fieldProvenance[field];
    fieldProvenance[field] = previous && existing?.[field] === input[field] ? previous : {
      sourceType: 'USER_PROVIDED', createdAt: previous?.createdAt ?? now,
      updatedAt: now, createdBy: uid, verificationStatus: 'UNVERIFIED',
    };
  }
  return { ...input, id, ownerId: uid, fieldProvenance, createdAt: existing?.createdAt ?? now, updatedAt: now };
}
