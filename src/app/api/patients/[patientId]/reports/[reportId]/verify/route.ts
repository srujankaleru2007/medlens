import { authenticated, endpoint, json, rateLimit } from '@/lib/server/http';
import { verifyExtraction } from '@/features/verification/service';
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ patientId: string; reportId: string }> };
export async function POST(request: Request, context: Context) { return endpoint(async () => { const params = await context.params; const uid = await authenticated(request); await rateLimit(uid, 'extraction-verify', 60); return json({ extraction: await verifyExtraction(uid, params.patientId, params.reportId, await request.json()) }); }); }
