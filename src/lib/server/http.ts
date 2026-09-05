import 'server-only';
import { ZodError } from 'zod';
import { createHash } from 'node:crypto';
import { adminAuth, database } from './firebase';

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export const privateHeaders = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };
export const json = (body: unknown, status = 200) => Response.json(body, { status, headers: privateHeaders });
export async function endpoint(work: () => Promise<Response>): Promise<Response> {
  try { return await work(); } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status);
    if (error instanceof ZodError) return json({ error: 'Invalid request. Check the supplied fields.' }, 400);
    // Never log report content, filenames, tokens, or SDK error messages.
    console.error(JSON.stringify({ event: 'request_failed', category: 'internal' }));
    return json({ error: 'The service is temporarily unavailable. Your original files are unchanged. Try again.' }, 503);
  }
}

export async function authenticated(request: Request): Promise<string> {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ') || authorization.length > 8192) throw new HttpError(401, 'Sign in to continue.');
  try { return (await adminAuth().verifyIdToken(authorization.slice(7), true)).uid; }
  catch { throw new HttpError(401, 'Your session is invalid or expired. Sign in again.'); }
}

// Firestore transaction makes the limit shared across server instances.
export async function rateLimit(uid: string, action: string, limit: number) {
  const id = createHash('sha256').update(`${uid}:${action}`).digest('hex');
  const ref = database().collection('requestLimits').doc(id);
  await database().runTransaction(async (tx) => {
    const data = (await tx.get(ref)).data();
    const now = Date.now();
    const start = typeof data?.start === 'number' && now - data.start < 60000 ? data.start : now;
    const count = start === data?.start ? Number(data.count) : 0;
    if (count >= limit) throw new HttpError(429, 'Too many requests. Wait a minute and try again.');
    tx.set(ref, { start, count: count + 1 });
  });
}

export async function limitedBody(request: Request, max: number): Promise<Buffer> {
  const length = request.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > max)) throw new HttpError(413, 'File or request exceeds the size limit.');
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'An empty upload cannot be saved.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > max) { await reader.cancel(); throw new HttpError(413, 'File or request exceeds the size limit.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}
