import { authenticated, endpoint, privateHeaders, rateLimit } from '@/lib/server/http';
import { readReport } from '@/features/reports/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, context: { params: Promise<{ patientId: string; reportId: string }> }) { return endpoint(async () => {
  const params = await context.params;
  const uid = await authenticated(request);
  await rateLimit(uid, 'reports-download', 60);
  const { report, bytes } = await readReport(uid, params.patientId, params.reportId);
  return new Response(new Uint8Array(bytes), { headers: {
    ...privateHeaders, 'Content-Type': report.mimeType, 'Content-Length': String(bytes.length),
    'Content-Disposition': `attachment; filename="${report.originalFilename}"`,
    'Content-Security-Policy': "sandbox; default-src 'none'",
  } });
}); }
