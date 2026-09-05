import { randomUUID } from 'node:crypto';
import { database } from '@/lib/server/firebase';
import { authenticated, endpoint, HttpError, json, limitedBody, rateLimit } from '@/lib/server/http';
import { patientInputSchema } from '@/lib/validation/patient';
import { patientRecord } from '@/lib/provenance';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) { return endpoint(async () => {
  const uid = await authenticated(request);
  await rateLimit(uid, 'patients-read', 120);
  const results = await database().collection('patients').where('ownerId', '==', uid).limit(50).get();
  return json({ patients: results.docs.map(doc => doc.data()) });
}); }
export async function POST(request: Request) { return endpoint(async () => {
  const uid = await authenticated(request);
  await rateLimit(uid, 'patients-write', 30);
  let input: unknown;
  try { input = JSON.parse((await limitedBody(request, 32000)).toString('utf8')); }
  catch (error) { if (error instanceof HttpError) throw error; throw new HttpError(400, 'Invalid patient data.'); }
  const patient = patientRecord(patientInputSchema.parse(input), uid, randomUUID());
  await database().collection('patients').doc(patient.id).create(patient);
  return json({ patient }, 201);
}); }
