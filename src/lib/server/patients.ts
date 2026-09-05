import 'server-only';
import { z } from 'zod';
import { database } from './firebase';
import { HttpError } from './http';
import type { PatientProfile } from '../types';

export const resourceId = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
export async function ownedPatient(uid: string, patientId: string): Promise<PatientProfile> {
  resourceId.parse(patientId);
  const data = (await database().collection('patients').doc(patientId).get()).data();
  if (!data || data.ownerId !== uid) throw new HttpError(404, 'Patient not found.');
  return data as PatientProfile;
}
