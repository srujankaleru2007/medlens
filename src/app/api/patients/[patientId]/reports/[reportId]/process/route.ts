import { authenticated, endpoint, json, rateLimit } from '@/lib/server/http';
import { getExtraction, processReport } from '@/features/extraction/service';
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'; export const maxDuration = 120;
type Context = { params: Promise<{ patientId: string; reportId: string }> };
export async function POST(request: Request, context: Context) { return endpoint(async () => { const params = await context.params; const uid = await authenticated(request); await rateLimit(uid, 'document-process', 20); return json({ extraction: await processReport(uid, params.patientId, params.reportId) }, 201); }); }
export async function GET(request: Request, context: Context) { return endpoint(async () => { const params = await context.params; const uid = await authenticated(request); await rateLimit(uid, 'extraction-read', 120); return json({ extraction: await getExtraction(uid, params.patientId, params.reportId) }); }); }
