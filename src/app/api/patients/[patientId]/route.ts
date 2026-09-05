import { database } from '@/lib/server/firebase';
import { authenticated, endpoint, HttpError, json, limitedBody, rateLimit } from '@/lib/server/http';
import { ownedPatient } from '@/lib/server/patients';
import { patientInputSchema } from '@/lib/validation/patient';
import { patientRecord } from '@/lib/provenance';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function PUT(request: Request, context: { params: Promise<{ patientId: string }> }) { return endpoint(async () => {
  const params = await context.params;
  const uid = await authenticated(request);
  await rateLimit(uid, 'patients-write', 30);
  const existing = await ownedPatient(uid, params.patientId);
  let input: unknown;
  try { input = JSON.parse((await limitedBody(request, 32000)).toString('utf8')); }
  catch (error) { if (error instanceof HttpError) throw error; throw new HttpError(400, 'Invalid patient data.'); }
  const patient = patientRecord(patientInputSchema.parse(input), uid, existing.id, existing);
  await database().collection('patients').doc(existing.id).set(patient);
  return json({ patient });
}); }
