import { authenticated, endpoint, HttpError, json, limitedBody, rateLimit } from '@/lib/server/http';
import { ownedPatient } from '@/lib/server/patients';
import { ingestReport, listReports } from '@/features/reports/service';
import { UploadValidationError } from '@/features/reports/validate';
import { MAX_REPORT_BYTES } from '@/features/reports/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
type Context = { params: Promise<{ patientId: string }> };
export async function GET(request: Request, context: Context) { return endpoint(async () => {
  const params = await context.params;
  const uid = await authenticated(request);
  await rateLimit(uid, 'reports-read', 120);
  return json(await listReports(uid, params.patientId, new URL(request.url).searchParams.get('cursor') || undefined));
}); }
export async function POST(request: Request, context: Context) { return endpoint(async () => {
  const params = await context.params;
  const uid = await authenticated(request);
  await ownedPatient(uid, params.patientId);
  await rateLimit(uid, 'reports-upload', 20);
  let filename: string;
  try { filename = decodeURIComponent(request.headers.get('x-report-filename') || ''); }
  catch { throw new HttpError(400, 'Invalid filename.'); }
  if (!filename || filename.length > 512) throw new HttpError(400, 'Invalid filename.');
  const bytes = await limitedBody(request, MAX_REPORT_BYTES);
  try {
    const result = await ingestReport(uid, params.patientId, bytes, filename, request.headers.get('content-type') || '');
    return json(result, result.duplicate ? 200 : 201);
  } catch (error) {
    if (error instanceof UploadValidationError) throw new HttpError(422, error.message);
    throw error;
  }
}); }
